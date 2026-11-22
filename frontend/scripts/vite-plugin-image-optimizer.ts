import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import sharp from 'sharp'
import type { Plugin, ResolvedConfig } from 'vite'

export interface ImageOptimizerOptions {
  /** Host tambahan yang boleh diambil gambarnya (host:port). */
  allowedHosts?: string[]
  /** Lebar maksimum hasil resize. */
  maxWidth?: number
  /** Batas ukuran gambar sumber. */
  maxSourceBytes?: number
  /** Lama fetch gambar sumber sebelum dibatalkan. */
  timeoutMs?: number
}

const CACHE_VERSION = 1
const MEMORY_CACHE_LIMIT = 48

const DEFAULTS = {
  allowedHosts: ['127.0.0.1:9000', 'localhost:9000'],
  maxWidth: 1920,
  maxSourceBytes: 30 * 1024 * 1024,
  timeoutMs: 12_000,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function hostnameOf(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return null
  }
}

function parseHostList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Optimasi gambar on-demand untuk Vite dev & preview.
 *
 * URL contoh:
 *   /media?url=https%3A%2F%2Fstorage%2Ffoto.png&w=480&q=70
 *
 * Gambar sumber diambil sekali, di-resize, lalu dikonversi ke WebP.
 * Hasil disimpan di cache disk (node_modules/.vite/image-optimizer) sehingga
 * request berikutnya tidak mengambil file 2 MB lagi.
 */
export function imageOptimizerPlugin(options: ImageOptimizerOptions = {}): Plugin {
  let resolved: ResolvedConfig
  let cacheDir = ''
  let allowedHosts = new Set<string>()
  const memoryCache = new Map<string, Buffer>()

  function remember(key: string, body: Buffer) {
    if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
      const oldest = memoryCache.keys().next().value
      if (oldest) memoryCache.delete(oldest)
    }
    memoryCache.set(key, body)
  }

  function fail(res: ServerResponse, status: number, message: string, redirectTo?: string) {
    if (redirectTo) {
      res.statusCode = 302
      res.setHeader('Location', redirectTo)
      res.setHeader('Cache-Control', 'no-store')
      res.end()
      return
    }
    res.statusCode = status
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(message)
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD')
      fail(res, 405, 'Method not allowed')
      return
    }

    const requestUrl = new URL(req.url || '/', 'http://localhost')
    const target = requestUrl.searchParams.get('url')
    if (!target) {
      fail(res, 400, 'Parameter url wajib diisi.')
      return
    }

    let source: URL
    try {
      source = new URL(target)
    } catch {
      fail(res, 400, 'URL gambar tidak valid.')
      return
    }

    if (source.protocol !== 'http:' && source.protocol !== 'https:') {
      fail(res, 400, 'Hanya URL http/https yang didukung.')
      return
    }

    if (!allowedHosts.has(source.host.toLowerCase())) {
      fail(res, 403, 'Host gambar tidak diizinkan.')
      return
    }

    const width = clamp(Number(requestUrl.searchParams.get('w')) || 640, 64, options.maxWidth ?? DEFAULTS.maxWidth)
    const quality = clamp(Number(requestUrl.searchParams.get('q')) || 70, 35, 90)

    const key = createHash('sha256')
      .update(`${CACHE_VERSION}|${source.href}|${width}|${quality}`)
      .digest('hex')
      .slice(0, 40)
    const cacheFile = join(cacheDir, `${key}.webp`)

    const cachedMemory = memoryCache.get(key)
    if (cachedMemory) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'image/webp')
      res.setHeader('Content-Length', cachedMemory.byteLength)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.setHeader('X-Image-Optimizer', 'memory')
      if (req.method === 'HEAD') res.end()
      else res.end(cachedMemory)
      return
    }

    try {
      const cachedDisk = await readFile(cacheFile)
      remember(key, cachedDisk)
      res.statusCode = 200
      res.setHeader('Content-Type', 'image/webp')
      res.setHeader('Content-Length', cachedDisk.byteLength)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.setHeader('X-Image-Optimizer', 'disk')
      if (req.method === 'HEAD') res.end()
      else res.end(cachedDisk)
      return
    } catch {
      // Cache belum ada, lanjut ambil dari sumber.
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULTS.timeoutMs)
      let upstream: Response
      try {
        upstream = await fetch(source, {
          signal: controller.signal,
          headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!upstream.ok) {
        fail(res, 502, `Gambar sumber gagal dimuat (${upstream.status}).`, target)
        return
      }

      const contentType = upstream.headers.get('content-type') || ''
      if (!contentType.toLowerCase().startsWith('image/')) {
        fail(res, 415, 'URL sumber bukan gambar.', target)
        return
      }

      const declaredSize = Number(upstream.headers.get('content-length')) || 0
      if (declaredSize > (options.maxSourceBytes ?? DEFAULTS.maxSourceBytes)) {
        fail(res, 413, 'Gambar sumber terlalu besar.', target)
        return
      }

      const input = Buffer.from(await upstream.arrayBuffer())
      if (input.byteLength > (options.maxSourceBytes ?? DEFAULTS.maxSourceBytes)) {
        fail(res, 413, 'Gambar sumber terlalu besar.', target)
        return
      }

      const output = await sharp(input, { failOn: 'none', limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 4, smartSubsample: true })
        .toBuffer()

      await mkdir(cacheDir, { recursive: true })
      await writeFile(cacheFile, output)
      remember(key, output)

      res.statusCode = 200
      res.setHeader('Content-Type', 'image/webp')
      res.setHeader('Content-Length', output.byteLength)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.setHeader('X-Image-Optimizer', 'generated')
      if (req.method === 'HEAD') res.end()
      else res.end(output)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Gagal mengoptimasi gambar.'
      resolved.logger.warn(`[image-optimizer] ${source.href} -> ${reason}`)
      // Fallback: biarkan browser memuat gambar asli daripada ikon rusak.
      fail(res, 502, 'Optimasi gambar gagal.', target)
    }
  }

  return {
    name: 'mochibako-image-optimizer',
    apply: 'serve',
    configResolved(config) {
      resolved = config
      cacheDir = join(config.cacheDir, 'image-optimizer')

      const fromEnv = [
        ...parseHostList(config.env.VITE_IMAGE_ALLOWED_HOSTS),
        hostnameOf(config.env.VITE_MEDIA_BASE_URL),
        hostnameOf(config.env.VITE_API_ORIGIN),
        hostnameOf(config.env.VITE_API_BASE_URL),
      ].filter((host): host is string => Boolean(host))

      allowedHosts = new Set([
        ...(options.allowedHosts ?? DEFAULTS.allowedHosts),
        ...fromEnv,
      ])
    },
    configureServer(server) {
      server.middlewares.use('/media', (req, res) => { void handle(req, res) })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/media', (req, res) => { void handle(req, res) })
    },
  }
}

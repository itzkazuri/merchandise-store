import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

/**
 * `vite preview` hanya melayani `dist/index.html` sebagai fallback SPA,
 * sehingga URL bersih seperti `/produk/<slug>` tidak menampilkan HTML hasil
 * prerender (`dist/produk/<slug>/index.html`). Plugin ini menambahkan
 * middleware kecil supaya preview benar-benar menyajikan hasil SSG/SSR.
 */
export function prerenderPreviewPlugin(): Plugin {
  return {
    name: 'mochibako:prerender-preview',
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir)

      server.middlewares.use((req, _res, next) => {
        if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
          next()
          return
        }

        const queryIndex = req.url.indexOf('?')
        const rawPath = queryIndex === -1 ? req.url : req.url.slice(0, queryIndex)
        const query = queryIndex === -1 ? '' : req.url.slice(queryIndex)

        if (!rawPath || rawPath === '/' || rawPath.endsWith('/index.html') || rawPath.includes('.')) {
          next()
          return
        }

        let pathname: string
        try {
          pathname = decodeURIComponent(rawPath)
        } catch {
          pathname = rawPath
        }

        const normalized = pathname.replace(/\/+$/, '')
        const file = resolve(outDir, `.${normalized}`, 'index.html')
        // Lindungi dari path traversal di luar folder build.
        if (!file.startsWith(`${outDir}${sep}`) || !existsSync(file)) {
          next()
          return
        }

        req.url = `${normalized}/index.html${query}`
        next()
      })
    },
  }
}

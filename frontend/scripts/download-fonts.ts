import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const distDir = join(scriptDir, '..', 'dist')
const fontsDir = join(distDir, 'fonts')
const fontCssUrl = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400..700&family=Nunito:wght@400..800&display=swap'
const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

interface FontFace {
  family: string
  subset: string
  weight: string
  style: string
  unicodeRange: string
  url: string
}

await rm(fontsDir, { recursive: true, force: true })

try {
  const response = await fetch(fontCssUrl, {
    headers: { 'User-Agent': userAgent },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Google Fonts returned ${response.status}`)
  const css = await response.text()
  const faces: FontFace[] = []
  const facePattern = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/gi

  for (const match of css.matchAll(facePattern)) {
    const subset = match[1].trim().toLowerCase()
    if (!['latin', 'latin-ext'].includes(subset)) continue
    const block = match[2]
    const family = block.match(/font-family:\s*['"]([^'"]+)['"]/i)?.[1]
    const url = block.match(/url\((https?:[^)]+)\)\s*format\(['"]woff2['"]\)/i)?.[1]
    const weight = block.match(/font-weight:\s*([^;]+);/i)?.[1]?.trim()
    const style = block.match(/font-style:\s*([^;]+);/i)?.[1]?.trim() || 'normal'
    const unicodeRange = block.match(/unicode-range:\s*([^;]+);/i)?.[1]?.trim()
    if (!family || !url || !weight || !unicodeRange) continue
    faces.push({ family, subset, weight, style, unicodeRange, url })
  }

  const uniqueFaces = [...new Map(faces.map((face) => [`${face.family}:${face.subset}:${face.weight}:${face.style}`, face])).values()]
  if (!uniqueFaces.length) throw new Error('Google Fonts returned no Latin WOFF2 font faces')
  await mkdir(fontsDir, { recursive: true })

  const fontRules = await Promise.all(uniqueFaces.map(async (face) => {
    const fileHash = createHash('sha256').update(face.url).digest('hex').slice(0, 12)
    const filename = `${face.family.toLowerCase()}-${face.subset}-${fileHash}.woff2`
    const fontResponse = await fetch(face.url, { signal: AbortSignal.timeout(15000) })
    if (!fontResponse.ok) throw new Error(`Could not download ${face.family} (${fontResponse.status})`)
    await writeFile(join(fontsDir, filename), new Uint8Array(await fontResponse.arrayBuffer()))
    return {
      family: face.family,
      subset: face.subset,
      filename,
      css: `@font-face{font-family:'${face.family}';font-style:${face.style};font-weight:${face.weight};font-display:swap;src:url('/fonts/${filename}') format('woff2');unicode-range:${face.unicodeRange}}`,
    }
  }))

  const fontCss = `${fontRules.map((rule) => rule.css).join('\n')}\n`
  const indexPath = join(distDir, 'index.html')
  let html = await readFile(indexPath, 'utf8')
  const preloads = fontRules
    .filter((rule) => rule.subset === 'latin')
    .map((rule) => `<link rel="preload" href="/fonts/${rule.filename}" as="font" type="font/woff2" crossorigin>`)
  const tags = [
    ...preloads,
    `<style>${fontCss}</style>`,
  ].join('\n    ')
  html = html.replace(/\s*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.googleapis\.com"\s*>/i, '')
  html = html.replace(/\s*<link\s+rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"\s+crossorigin\s*>/i, '')
  html = html.replace(/\s*<link\s+rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^>]+>/i, '')
  html = html.replace('</head>', `    ${tags}\n  </head>`)
  await writeFile(indexPath, html)
  console.info(`[Font download] Downloaded ${fontRules.length} local WOFF2 subsets for Fredoka and Nunito.`)
} catch (error) {
  console.warn(`[Font download] Local fonts were skipped; system fallbacks will be used: ${error instanceof Error ? error.message : String(error)}`)
}

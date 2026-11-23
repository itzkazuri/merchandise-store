import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface ProductImage {
  object_key: string
  url?: string | null
  alt_text?: string | null
  is_primary?: boolean
  sort_order?: number
}

interface CatalogProduct {
  id: number
  name: string
  slug?: string
  sku?: string
  description?: string | null
  price: number | string
  stock: number
  updated_at?: string
  images?: ProductImage[]
}

interface ProductPage {
  items: CatalogProduct[]
  pages: number
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const outDir = join(scriptDir, '..', 'dist')
const apiBase = (process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')
const siteUrl = (process.env.VITE_SITE_URL || '').trim().replace(/\/$/, '')
const mediaBase = (process.env.VITE_MEDIA_BASE_URL || '').trim().replace(/\/$/, '')
const imageOptimizerTemplate = (process.env.VITE_IMAGE_OPTIMIZER_URL_TEMPLATE || '').trim()
const imageQuality = Math.min(90, Math.max(35, Number(process.env.VITE_IMAGE_QUALITY) || 75))

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char)
}

function absoluteImage(product: CatalogProduct): string | null {
  const image = [...(product.images || [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return (a.sort_order || 0) - (b.sort_order || 0)
  })[0]
  const stored = image?.url?.trim() || image?.object_key?.trim()
  if (!stored) return null
  if (/^https?:\/\//i.test(stored)) return stored
  if (!mediaBase) return null
  return `${mediaBase}/${stored.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`
}

function optimizedImage(url: string, width: number): string {
  if (!imageOptimizerTemplate) return url
  return imageOptimizerTemplate
    .replaceAll('{url}', encodeURIComponent(url))
    .replaceAll('{width}', String(width))
    .replaceAll('{quality}', String(imageQuality))
    .replaceAll('{format}', 'auto')
}

function validSlug(product: CatalogProduct): string | null {
  const slug = product.slug?.trim()
  return slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) ? slug : null
}

function asJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function renderedHead(template: string, product: CatalogProduct, canonical: string, image: string | null, displayImage: string | null, imageSrcSet?: string): string {
  const title = `${product.name} · Mochibako`
  const description = product.description?.trim()
    || `Beli ${product.name} di Mochibako. Lihat harga dan ketersediaan produk.`
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    sku: product.sku || undefined,
    image: image ? [image] : undefined,
    brand: { '@type': 'Brand', name: 'Mochibako' },
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: process.env.VITE_CURRENCY || 'IDR',
      price: Number(product.price),
      availability: Number(product.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }
  const tags = [
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    '<meta name="robots" content="index,follow">',
    `<meta property="og:type" content="product">`,
    '<meta property="og:site_name" content="Mochibako">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    ...(image ? [
      `<meta property="og:image" content="${escapeHtml(image)}">`,
      `<meta property="og:image:alt" content="${escapeHtml(product.name)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    ] : ['<meta name="twitter:card" content="summary">']),
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<script type="application/ld+json">${asJsonLd(ld)}</script>`,
  ].join('\n    ')

  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace('</head>', `    ${tags}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app"><main><h1>${escapeHtml(product.name)}</h1>${displayImage ? `<img src="${escapeHtml(displayImage)}"${imageSrcSet ? ` srcset="${escapeHtml(imageSrcSet)}" sizes="(max-width: 1024px) 92vw, 560px"` : ''} alt="${escapeHtml(product.images?.find((item) => item.is_primary)?.alt_text || product.name)}" width="960" height="960" fetchpriority="high">` : ''}<p>${escapeHtml(description)}</p><p>Harga: Rp${new Intl.NumberFormat('id-ID').format(Number(product.price))}</p><p>${Number(product.stock) > 0 ? 'Tersedia' : 'Stok habis'}</p><a href="/">Lihat produk lainnya di Mochibako</a></main></div>`)
}

function xmlEscape(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] || char)
}

async function fetchProducts(): Promise<CatalogProduct[]> {
  const firstUrl = new URL(`${apiBase}/products`)
  firstUrl.searchParams.set('page', '1')
  firstUrl.searchParams.set('size', '100')
  const firstResponse = await fetch(firstUrl, { signal: AbortSignal.timeout(8000) })
  if (!firstResponse.ok) throw new Error(`Products API returned ${firstResponse.status}`)
  const first = await firstResponse.json() as ProductPage
  const products = [...(first.items || [])]

  for (let page = 2; page <= (first.pages || 1); page += 1) {
    const url = new URL(`${apiBase}/products`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('size', '100')
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`Products API page ${page} returned ${response.status}`)
    const data = await response.json() as ProductPage
    products.push(...(data.items || []))
  }
  return products
}

async function main() {
  const robotsPath = join(outDir, 'robots.txt')
  const robots = await readFile(robotsPath, 'utf8').catch(() => 'User-agent: *\nDisallow: /admin/\n')
  const cleanRobots = robots.split('\n').filter((line: string) => !line.startsWith('Sitemap:')).join('\n').trim()
  await writeFile(robotsPath, `${cleanRobots}\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`)

  if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) {
    console.warn('[SEO prerender] VITE_SITE_URL belum diisi dengan URL publik; sitemap dan halaman produk dilewati.')
    return
  }

  try {
    const products = await fetchProducts()
    const template = await readFile(join(outDir, 'index.html'), 'utf8')
    const sitemapEntries = [`  <url><loc>${xmlEscape(`${siteUrl}/`)}</loc></url>`]
    let rendered = 0

    for (const product of products) {
      const slug = validSlug(product)
      if (!slug) continue
      const path = `/produk/${slug}`
      const canonical = `${siteUrl}${path}`
      const sourceImage = absoluteImage(product)
      const displayImage = sourceImage ? optimizedImage(sourceImage, 960) : null
      const imageSrcSet = sourceImage
        ? [320, 640, 960].map((width) => `${optimizedImage(sourceImage, width)} ${width}w`).join(', ')
        : undefined
      const pageDir = join(outDir, 'produk', slug)
      await mkdir(pageDir, { recursive: true })
      await writeFile(
        join(pageDir, 'index.html'),
        renderedHead(template, product, canonical, sourceImage, displayImage, imageSrcSet),
      )
      const lastmod = product.updated_at ? `\n    <lastmod>${xmlEscape(product.updated_at.slice(0, 10))}</lastmod>` : ''
      const imageEntry = sourceImage
        ? `\n    <image:image><image:loc>${xmlEscape(sourceImage)}</image:loc><image:title>${xmlEscape(product.name)}</image:title></image:image>`
        : ''
      sitemapEntries.push(`  <url><loc>${xmlEscape(canonical)}</loc>${lastmod}${imageEntry}\n  </url>`)
      rendered += 1
    }

    const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
      + `${sitemapEntries.join('\n')}\n</urlset>\n`
    await writeFile(join(outDir, 'sitemap.xml'), sitemap)
    console.info(`[SEO prerender] Generated ${rendered} product pages and sitemap.xml.`)
  } catch (error) {
    const fallbackSitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + `  <url><loc>${xmlEscape(`${siteUrl}/`)}</loc></url>\n</urlset>\n`
    await writeFile(join(outDir, 'sitemap.xml'), fallbackSitemap)
    console.warn(`[SEO prerender] Product pages were not generated: ${error instanceof Error ? error.message : String(error)}`)
  }
}

await main()

import type { CatalogImage, CatalogProduct, Category } from '@/types/catalog'

/**
 * Visual fallback untuk produk yang belum punya gambar.
 * Warna & ikon dipilih dari jenis produk supaya katalog tetap konsisten
 * meskipun data gambar belum diisi admin.
 */
export interface ProductVisual {
  color: string
  icon: string
}

const MEDIA_BASE = ((import.meta.env.VITE_MEDIA_BASE_URL as string | undefined) || '')
  .trim()
  .replace(/\/+$/, '')
const IMAGE_OPTIMIZER_TEMPLATE = ((import.meta.env.VITE_IMAGE_OPTIMIZER_URL_TEMPLATE as string | undefined) || '').trim()
const IMAGE_QUALITY = Number(import.meta.env.VITE_IMAGE_QUALITY) || 75

interface VisualRule {
  match: RegExp
  color: string
  icon: string
}

const RULES: VisualRule[] = [
  { match: /figure|figur|nendoroid|scale|statue/i, color: 'bg-lilac', icon: 'wand-sparkles' },
  { match: /gantungan|keychain|key-chain|kunci/i, color: 'bg-pinky', icon: 'key-round' },
  { match: /plush|boneka|doll/i, color: 'bg-mint', icon: 'cat' },
  { match: /blind|gacha|box|mystery/i, color: 'bg-sky', icon: 'gift' },
  { match: /acrylic|akrilik|stand/i, color: 'bg-banner-sky', icon: 'star' },
  { match: /poster|print|cetak|art/i, color: 'bg-sky', icon: 'image' },
  { match: /sticker|stiker/i, color: 'bg-mint', icon: 'sticker' },
  { match: /kaos|apparel|shirt|baju|hoodie|jaket/i, color: 'bg-sun', icon: 'shirt' },
  { match: /aksesori|accessor|mug|tumbler|coffee|gelang|kalung/i, color: 'bg-banner-pink', icon: 'coffee' },
  { match: /merch|koleksi|official/i, color: 'bg-sun', icon: 'sparkles' },
]

const FALLBACK: ProductVisual[] = [
  { color: 'bg-sun', icon: 'box' },
  { color: 'bg-pinky', icon: 'heart' },
  { color: 'bg-mint', icon: 'sparkles' },
  { color: 'bg-sky', icon: 'star' },
  { color: 'bg-lilac', icon: 'gift' },
]

const BASE: ProductVisual = { color: 'bg-sun', icon: 'box' }

function ruleFor(label: string): ProductVisual | null {
  if (!label) return null
  const found = RULES.find((rule) => rule.match.test(label))
  return found ? { color: found.color, icon: found.icon } : null
}

export function visualForCategory(category?: Pick<Category, 'name' | 'slug'> | null): ProductVisual {
  return (
    ruleFor(category?.slug || '') ||
    ruleFor(category?.name || '') || { color: 'bg-sun', icon: 'layout-grid' }
  )
}

export function visualFor(product: CatalogProduct): ProductVisual {
  return (
    ruleFor(product.category?.slug || '') ||
    ruleFor(product.category?.name || '') ||
    ruleFor(product.name || '') ||
    FALLBACK[Math.abs(product.id) % FALLBACK.length] ||
    BASE
  )
}

/** object_key bisa berupa key storage atau URL penuh. */
export function imageUrl(key?: string | null): string | null {
  if (!key) return null
  const value = key.trim()
  if (!value) return null
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:')) return value
  // Aset publik lokal (mis. /banners/foo.svg) tidak butuh MEDIA_BASE.
  if (value.startsWith('/')) return value
  if (!MEDIA_BASE) return null
  return `${MEDIA_BASE}/${value.replace(/^\/+/, '')}`
}

/** Apply the configured CDN/proxy transform without assuming a provider-specific URL syntax. */
export function optimizedImageUrl(url: string | null, width = 640, quality = 75): string | null {
  if (!url || !IMAGE_OPTIMIZER_TEMPLATE) return url
  return IMAGE_OPTIMIZER_TEMPLATE
    .replaceAll('{url}', encodeURIComponent(url))
    .replaceAll('{width}', String(Math.max(64, Math.round(width))))
    .replaceAll('{quality}', String(Math.min(90, Math.max(35, Math.round(quality)))))
    .replaceAll('{format}', 'auto')
}

export function primaryImage(product: CatalogProduct): CatalogImage | null {
  const images = product.images || []
  return images.find((image) => image.is_primary) || images[0] || null
}

export function productImageUrl(product: CatalogProduct, width = 640, quality = IMAGE_QUALITY): string | null {
  return optimizedImageUrl(imageUrl(primaryImage(product)?.object_key), width, quality)
}

export function productImageSrcSet(product: CatalogProduct, maxWidth = 640, quality = IMAGE_QUALITY): string | undefined {
  if (!IMAGE_OPTIMIZER_TEMPLATE) return undefined
  const rawUrl = imageUrl(primaryImage(product)?.object_key)
  if (!rawUrl) return undefined
  const max = Math.max(64, Math.round(maxWidth))
  const widths = [...new Set([160, 256, 320, 480, 640, 960, max].filter((width) => width <= max))]
  return widths
    .map((width) => `${optimizedImageUrl(rawUrl, width, quality)} ${width}w`)
    .join(', ')
}

/** Label seri asal produk: anime, lalu jenis produk, lalu fallback toko. */
export function productSeries(product: CatalogProduct): string {
  return product.anime?.name || product.category?.name || 'Mochibako Collection'
}

export function productCategoryLabel(product: CatalogProduct): string {
  return product.category?.name || (product.product_type === 'handmade' ? 'Handmade' : 'Imported')
}

export function productSpec(product: CatalogProduct): string {
  const description = (product.description || '').trim()
  if (description) return description.length > 70 ? `${description.slice(0, 70).trimEnd()}…` : description
  return product.product_type === 'handmade' ? 'Karya tangan UMKM lokal' : 'Produk impor pilihan'
}

export function productBadge(product: CatalogProduct): string {
  if (product.stock <= 0) return 'Habis'
  if (product.stock <= 3) return `Sisa ${product.stock}`
  return ''
}

/**
 * Lengkapi produk API dengan field presentasi yang dipakai komponen storefront.
 * Tidak mengubah data asli dari server.
 */
export function decorateProduct(product: CatalogProduct): CatalogProduct {
  const visual = visualFor(product)
  return {
    ...product,
    series: productSeries(product),
    cat: productCategoryLabel(product),
    spec: productSpec(product),
    color: visual.color,
    icon: visual.icon,
    badge: productBadge(product),
  }
}

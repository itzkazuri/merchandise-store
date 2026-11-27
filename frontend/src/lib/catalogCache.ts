import type { CatalogProduct } from '@/types/catalog'
import { offlineStorageAllowed } from '@/lib/cookieConsent'

/**
 * indeks produk publik untuk mode offline.
 *
 * Setiap respons katalog yang berhasil disalin ke sini, sehingga pencarian,
 * kategori, dan halaman detail tetap bisa dibuka saat API mati walau respons
 * untuk kombinasi filter tersebut belum pernah di-cache.
 */

const STORAGE_KEY = 'mochibako_offline_catalog'
const MAX_PRODUCTS = 300

interface StoredCatalog {
  savedAt: number
  products: CatalogProduct[]
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readStored(): StoredCatalog {
  if (!offlineStorageAllowed()) return { savedAt: 0, products: [] }

  const store = storage()
  if (!store) return { savedAt: 0, products: [] }
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return { savedAt: 0, products: [] }
    const parsed = JSON.parse(raw) as StoredCatalog
    if (!parsed || !Array.isArray(parsed.products)) return { savedAt: 0, products: [] }
    return {
      savedAt: Number(parsed.savedAt) || 0,
      products: parsed.products.filter((product) => Boolean(product && product.id)),
    }
  } catch {
    return { savedAt: 0, products: [] }
  }
}

export function rememberProducts(
  products: Array<CatalogProduct | null | undefined> | undefined,
): void {
  if (!offlineStorageAllowed()) return

  const incoming = (products || []).filter(
    (product): product is CatalogProduct => Boolean(product && product.id),
  )
  if (!incoming.length) return

  const store = storage()
  if (!store) return

  try {
    const current = readStored()
    const merged = new Map<number, CatalogProduct>(current.products.map((product) => [product.id, product]))
    for (const product of incoming) merged.set(product.id, product)

    const list = [...merged.values()]
    const trimmed = list.length > MAX_PRODUCTS ? list.slice(list.length - MAX_PRODUCTS) : list
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), products: trimmed } satisfies StoredCatalog),
    )
  } catch {
    // Kuota penuh / storage diblokir: mode offline tetap jalan dengan cache API.
  }
}

export function cachedProducts(): CatalogProduct[] {
  return readStored().products
}

/** Hapus seluruh indeks produk offline (dipakai saat pengunjung menolak cookie). */
export function clearCatalogCache(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function cachedCatalogSavedAt(): number {
  return readStored().savedAt
}

export function findCachedProduct(slugOrId: string): CatalogProduct | null {
  const value = decodeURIComponent(slugOrId)
  return (
    cachedProducts().find(
      (product) => product.slug === value || String(product.id) === value,
    ) || null
  )
}

function haystack(product: CatalogProduct): string {
  return [
    product.name,
    product.series,
    product.cat,
    product.spec,
    product.description,
    product.badge,
    product.anime?.name,
    product.anime?.slug,
    product.category?.name,
    product.category?.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function slugify(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function matchesCategory(product: CatalogProduct, category: string): boolean {
  const wanted = slugify(category)
  if (!wanted) return true
  return (
    product.category?.slug === category ||
    slugify(product.category?.slug) === wanted ||
    slugify(product.category?.name) === wanted ||
    slugify(product.cat) === wanted
  )
}

export interface CachedSearchParams {
  q?: string
  category?: string
  sort?: string
  page?: number
  size?: number
}

export interface CachedSearchResult {
  items: CatalogProduct[]
  total: number
  page: number
  size: number
  pages: number
}

/** Filter/sort katalog yang tersimpan, dipakai saat pencarian offline. */
export function searchCachedProducts(params: CachedSearchParams = {}): CachedSearchResult {
  const query = (params.q || '').trim().toLowerCase()
  let list = cachedProducts()
  if (query) list = list.filter((product) => haystack(product).includes(query))
  if (params.category) list = list.filter((product) => matchesCategory(product, params.category as string))

  const sorted = [...list]
  switch (params.sort) {
    case 'price_asc':
      sorted.sort((a, b) => Number(a.price) - Number(b.price))
      break
    case 'price_desc':
      sorted.sort((a, b) => Number(b.price) - Number(a.price))
      break
    case 'best_seller':
      sorted.sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0))
      break
    default:
      sorted.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA || b.id - a.id
      })
  }

  const size = Math.max(1, params.size || 20)
  const page = Math.max(1, params.page || 1)
  const start = (page - 1) * size

  return {
    items: sorted.slice(start, start + size),
    total: sorted.length,
    page,
    size,
    pages: Math.ceil(sorted.length / size),
  }
}

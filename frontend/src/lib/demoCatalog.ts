import type { CatalogProduct, Category } from '@/types/catalog'
import { decorateProduct } from './productVisual'

/**
 * Data demo hanya untuk debugging tampilan saat backend belum punya produk.
 * Production tidak memuat modul data demo kecuali flag ini diaktifkan.
 */
export const DEMO_CATALOG_ENABLED =
  import.meta.env.DEV ||
  String(import.meta.env.VITE_ENABLE_DEMO_CATALOG ?? '').toLowerCase() === 'true'

export interface DemoCatalog {
  products: CatalogProduct[]
  categories: Category[]
}

let cache: DemoCatalog | null = null

/** Dimuat dinamis supaya data dummy tidak ikut ke bundle utama production. */
export async function loadDemoCatalog(): Promise<DemoCatalog | null> {
  if (!DEMO_CATALOG_ENABLED) return null
  if (!cache) {
    const { demoProducts, demoCategories } = await import('@/data/demo/catalog')
    cache = {
      products: demoProducts.map(decorateProduct),
      categories: demoCategories,
    }
  }
  return cache
}

/** Cari produk demo berdasarkan slug atau id, untuk halaman detail statis. */
export async function findDemoProduct(slugOrId: string): Promise<CatalogProduct | null> {
  const catalog = await loadDemoCatalog()
  if (!catalog) return null
  const value = decodeURIComponent(slugOrId)
  return (
    catalog.products.find((product) => product.slug === value || String(product.id) === value) ||
    null
  )
}

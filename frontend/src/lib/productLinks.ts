import type { CatalogProduct } from '@/types/catalog'

export function productDetailLink(product: Pick<CatalogProduct, 'slug'>): string {
  return product.slug ? `/produk/${product.slug}` : '/'
}

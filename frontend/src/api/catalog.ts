import { apiRequest, queryString } from './client'
import type { CatalogProduct, Category, HomeCatalog } from '@/types/catalog'

export interface Page<T> { items: T[]; total: number; page: number; size: number; pages: number; has_next: boolean; has_prev: boolean }
export const catalogApi = {
  home: (params: Record<string, unknown> = {}) => apiRequest<HomeCatalog>(`/catalog/home${queryString(params)}`, { auth: false }),
  products: (params: Record<string, unknown> = {}) => apiRequest<Page<CatalogProduct>>(`/products${queryString(params)}`, { auth: false }),
  search: (params: Record<string, unknown>) => apiRequest<Page<CatalogProduct>>(`/products/search${queryString(params)}`, { auth: false }),
  filters: () => apiRequest<Record<string, unknown>>('/products/filters', { auth: false }),
  categories: (params: Record<string, unknown> = {}) => apiRequest<Category[]>(`/categories${queryString(params)}`, { auth: false }),
  product: (slug: string) => apiRequest<CatalogProduct>(`/products/${encodeURIComponent(slug)}`, { auth: false }),
  liked: (params: Record<string, unknown> = {}) => apiRequest<Page<CatalogProduct>>(`/products/liked${queryString(params)}`),
  like: (id: number) => apiRequest(`/products/${id}/like`, { method: 'POST' }),
  unlike: (id: number) => apiRequest<void>(`/products/${id}/like`, { method: 'DELETE' }),
}

export interface CatalogImage {
  id: number
  object_key: string
  alt_text: string | null
  is_primary: boolean
  sort_order: number
  created_at: string
}

export interface Category {
  id: number
  kind: 'anime' | 'product'
  name: string
  slug: string
  description?: string | null
  is_active: boolean
  sort_order: number
  product_count?: number
  created_at?: string
  updated_at?: string
}

export interface CatalogProduct {
  id: number
  name: string
  slug?: string
  sku?: string
  series?: string
  cat?: string
  spec?: string
  rate?: number
  color?: string
  icon?: string
  badge?: string
  description?: string | null
  product_type?: 'imported' | 'handmade'
  anime_id?: number | null
  category_id?: number | null
  anime?: Category | null
  category?: Category | null
  price: string | number
  stock: number
  sold_count?: number
  status?: 'draft' | 'active' | 'archived'
  images?: CatalogImage[]
  like_count?: number
  is_liked?: boolean
  isLiked?: boolean
  created_at?: string
  updated_at?: string
}

export interface CategoryItem {
  name: string
  icon: string
  bg: string
}

export interface CartLineItem {
  product: CatalogProduct
  quantity: number
}

export interface HomeCatalog {
  total_products: number
  new_arrivals: CatalogProduct[]
  best_sellers: CatalogProduct[]
  handmade: CatalogProduct[]
  imported: CatalogProduct[]
}

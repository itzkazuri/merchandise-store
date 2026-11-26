import type { CatalogProduct } from '@/types/catalog'

/**
 * State awal yang ditanam ke HTML hasil prerender dan dibaca kembali oleh
 * entry client sebelum aplikasi di-mount. Tujuannya supaya render pertama di
 * browser sama persis dengan HTML server (hidrasi tanpa mismatch), bukan
 * menampilkan skeleton lalu mengganti konten.
 */
export interface AppInitialState {
  product?: {
    slug: string
    product: CatalogProduct
  }
}

/** Id elemen `<script type="application/json">` berisi state hasil prerender. */
export const APP_STATE_ELEMENT_ID = 'mochibako-state'

let activeState: AppInitialState = {}

export function setAppState(state: AppInitialState) {
  activeState = state
}

export function getInitialProduct(slug: string): CatalogProduct | null {
  const seed = activeState.product
  if (!seed || seed.slug !== slug) return null
  return seed.product
}

/**
 * Baca state dari dokumen lalu hapus elemennya. Aman dipanggil di server
 * (tidak melakukan apa-apa) dan hanya sekali di client.
 */
export function hydrateAppStateFromDocument() {
  if (typeof document === 'undefined') return
  const element = document.getElementById(APP_STATE_ELEMENT_ID)
  if (!element) return
  try {
    const parsed = JSON.parse(element.textContent || '{}') as AppInitialState
    activeState = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    activeState = {}
  } finally {
    element.remove()
  }
}

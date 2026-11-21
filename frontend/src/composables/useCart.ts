import { computed, ref, watch } from 'vue'
import type { CartLineItem, CatalogProduct } from '@/types/catalog'
import { useToast } from './useToast'

export const FREE_SHIPPING_THRESHOLD = 300000
const STORAGE_KEY = 'mochibako_cart'

const cartState = ref<Record<number, CartLineItem>>({})
const cartOpen = ref(false)

// Load from localStorage if present (dilewati saat SSR / tanpa window)
try {
  const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  if (saved) {
    cartState.value = JSON.parse(saved)
  }
} catch {
  // Ignore localStorage read errors
}

// Persist cart to localStorage
watch(
  cartState,
  (val) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      // Ignore write errors
    }
  },
  { deep: true },
)

export function useCart() {
  const { showToast } = useToast()

  const cartLines = computed(() => Object.values(cartState.value))
  const cartCount = computed(() => cartLines.value.reduce((sum, item) => sum + item.quantity, 0))
  const cartTotal = computed(() =>
    cartLines.value.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
  )

  const isFreeShipping = computed(() => cartTotal.value >= FREE_SHIPPING_THRESHOLD)
  const remainingForFreeShipping = computed(() => Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotal.value))

  function addToCart(product: CatalogProduct, qty = 1) {
    const current = cartState.value[product.id]
    const currentQty = current?.quantity || 0
    const maxStock = product.stock ?? 99
    const newQty = Math.min(maxStock, currentQty + qty)

    cartState.value = {
      ...cartState.value,
      [product.id]: {
        product,
        quantity: newQty,
      },
    }

    showToast(`${product.name} masuk keranjang`)
  }

  function increment(productId: number) {
    const line = cartState.value[productId]
    if (!line) return
    const maxStock = line.product.stock ?? 99
    if (line.quantity >= maxStock) return

    cartState.value = {
      ...cartState.value,
      [productId]: {
        ...line,
        quantity: line.quantity + 1,
      },
    }
  }

  function decrement(productId: number) {
    const line = cartState.value[productId]
    if (!line) return
    const next = { ...cartState.value }
    if (line.quantity <= 1) {
      delete next[productId]
    } else {
      next[productId] = {
        ...line,
        quantity: line.quantity - 1,
      }
    }
    cartState.value = next
  }

  function removeItem(productId: number) {
    const next = { ...cartState.value }
    delete next[productId]
    cartState.value = next
  }

  /**
   * Segarkan snapshot produk di keranjang (harga/stok terbaru dari server).
   * Jumlah otomatis dibatasi stok terbaru supaya checkout tidak gagal.
   */
  function setProduct(product: CatalogProduct) {
    const line = cartState.value[product.id]
    if (!line) return
    const stock = Number(product.stock ?? 0)
    const quantity = stock > 0 ? Math.max(1, Math.min(line.quantity, stock)) : line.quantity
    cartState.value = {
      ...cartState.value,
      [product.id]: {
        product: { ...line.product, ...product, stock },
        quantity,
      },
    }
  }

  function clearCart() {
    cartState.value = {}
  }

  function checkout(): boolean {
    if (cartLines.value.length === 0) {
      showToast('Keranjang masih kosong')
      return false
    }
    clearCart()
    cartOpen.value = false
    showToast('Pesananmu masuk. Terima kasih!')
    return true
  }

  function toggleCart() {
    cartOpen.value = !cartOpen.value
  }

  function openCart() {
    cartOpen.value = true
  }

  function closeCart() {
    cartOpen.value = false
  }

  return {
    cart: cartState,
    cartOpen,
    cartLines,
    cartCount,
    cartTotal,
    isFreeShipping,
    remainingForFreeShipping,
    addToCart,
    increment,
    decrement,
    removeItem,
    setProduct,
    clearCart,
    checkout,
    toggleCart,
    openCart,
    closeCart,
  }
}

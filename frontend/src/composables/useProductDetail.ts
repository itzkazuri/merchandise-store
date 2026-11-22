import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { catalogApi } from '@/api/catalog'
import { ApiError } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { decorateProduct, productImageUrl, productSeries, visualForCategory } from '@/lib/productVisual'
import { findDemoProduct, loadDemoCatalog } from '@/lib/demoCatalog'
import type { CatalogProduct } from '@/types/catalog'

export function useProductDetail() {
  const route = useRoute()
  const router = useRouter()
  const { addToCart, openCart } = useCart()
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()

  const product = ref<CatalogProduct | null>(null)
  const related = ref<CatalogProduct[]>([])
  const loading = ref(true)
  const error = ref('')
  const usingFallback = ref(false)
  const qty = ref(1)
  const liked = ref(false)

  const maxStock = computed(() => Math.max(0, Number(product.value?.stock ?? 0)))
  const soldOut = computed(() => maxStock.value <= 0)
  const lowStock = computed(() => maxStock.value > 0 && maxStock.value <= 5)
  const subtotal = computed(() => Number(product.value?.price || 0) * qty.value)
  const categoryVisual = computed(() => visualForCategory(product.value?.category || null))
  const productImage = computed(() => (product.value ? productImageUrl(product.value) : null))

  function scoreRelated(anchor: CatalogProduct, candidate: CatalogProduct) {
    let score = 0
    if (anchor.category?.id && candidate.category?.id === anchor.category.id) score += 4
    else if (anchor.category?.slug && candidate.category?.slug === anchor.category.slug) score += 3
    if (anchor.series && candidate.series === anchor.series) score += 2
    if (anchor.anime?.id && candidate.anime?.id === anchor.anime.id) score += 2
    if (anchor.product_type && candidate.product_type === anchor.product_type) score += 1
    return score
  }

  function pickRelated(anchor: CatalogProduct, pool: CatalogProduct[], limit = 4) {
    return pool
      .filter((item) => item.id !== anchor.id)
      .map((item) => ({ item, score: scoreRelated(anchor, item) }))
      .sort((a, b) => b.score - a.score || Number(b.item.sold_count || 0) - Number(a.item.sold_count || 0))
      .slice(0, limit)
      .map((entry) => entry.item)
  }

  async function loadRelated(current: CatalogProduct) {
    const params: Record<string, unknown> = { size: 8, sort: 'best_seller' }
    if (current.category?.slug) params.category = current.category.slug
    else if (current.anime?.slug) params.anime = current.anime.slug

    try {
      const data = await catalogApi.products(params)
      const pool = (data.items || []).map(decorateProduct)
      related.value = pickRelated(current, pool)
    } catch {
      related.value = []
    }
  }

  async function loadDemoDetail(slug: string) {
    const demoProduct = await findDemoProduct(slug)
    if (!demoProduct) return false
    const catalog = await loadDemoCatalog()
    product.value = demoProduct
    liked.value = Boolean(demoProduct.isLiked ?? demoProduct.is_liked)
    related.value = catalog ? pickRelated(demoProduct, catalog.products) : []
    usingFallback.value = true
    error.value = ''
    return true
  }

  async function loadProduct() {
    loading.value = true
    error.value = ''
    product.value = null
    related.value = []
    qty.value = 1
    liked.value = false
    usingFallback.value = false

    const slug = String(route.params.slug || '')

    try {
      const data = await catalogApi.product(slug)
      product.value = decorateProduct(data)
      liked.value = Boolean(data.is_liked || data.isLiked)
      await loadRelated(product.value)
    } catch (cause) {
      const shown = await loadDemoDetail(slug)
      if (!shown) {
        error.value =
          cause instanceof ApiError
            ? cause.message
            : 'Detail produk gagal dimuat. Coba lagi sebentar.'
      }
    } finally {
      loading.value = false
    }
  }

  function step(delta: number) {
    qty.value = Math.min(maxStock.value, Math.max(1, qty.value + delta))
  }

  function handleAdd() {
    if (!product.value || soldOut.value) return
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menambah ke keranjang')
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    addToCart(product.value, qty.value)
    openCart()
  }

  function buyNow() {
    if (!product.value || soldOut.value) return
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk membeli')
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    addToCart(product.value, qty.value)
    router.push('/keranjang')
  }

  async function toggleLike() {
    if (!product.value) return
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menyimpan produk favorit')
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }

    if (usingFallback.value) {
      liked.value = !liked.value
      product.value.is_liked = liked.value
      product.value.isLiked = liked.value
      return
    }

    try {
      if (liked.value) await catalogApi.unlike(product.value.id)
      else await catalogApi.like(product.value.id)
      liked.value = !liked.value
      product.value.is_liked = liked.value
      product.value.isLiked = liked.value
    } catch {
      showToast('Gagal menyimpan produk. Coba lagi.')
    }
  }

  function addRelated(item: CatalogProduct) {
    if (Number(item.stock ?? 0) <= 0) {
      showToast(`${item.name} sedang habis`)
      return
    }
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menambah ke keranjang')
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    addToCart(item)
  }

  async function toggleRelatedLike(item: CatalogProduct) {
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menyimpan produk favorit')
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }

    const next = !(item.isLiked ?? item.is_liked)
    if (usingFallback.value) {
      item.is_liked = next
      item.isLiked = next
      return
    }

    try {
      if (next) await catalogApi.like(item.id)
      else await catalogApi.unlike(item.id)
      item.is_liked = next
      item.isLiked = next
    } catch {
      showToast('Gagal menyimpan produk. Coba lagi.')
    }
  }

  watch(() => route.params.slug, loadProduct, { immediate: true })

  return {
    product,
    related,
    loading,
    error,
    usingFallback,
    qty,
    liked,
    maxStock,
    soldOut,
    lowStock,
    subtotal,
    categoryVisual,
    productImage,
    productSeries,
    loadProduct,
    step,
    handleAdd,
    buyNow,
    toggleLike,
    addRelated,
    toggleRelatedLike,
  }
}

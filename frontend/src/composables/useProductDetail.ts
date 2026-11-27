import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { catalogApi } from '@/api/catalog'
import { ApiError } from '@/api/client'
import { isNetworkError } from '@/api/errors'
import { useAuth } from '@/composables/useAuth'
import { openAuthDialog } from '@/composables/useAuthDialog'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { useApiReconnect } from '@/composables/useApiReconnect'
import { getInitialProduct } from '@/lib/appState'
import { cachedProducts, findCachedProduct, rememberProducts } from '@/lib/catalogCache'
import { catalogImageUrl, decorateProduct, primaryImage, productImageUrl, productSeries, visualForCategory } from '@/lib/productVisual'
import { findDemoProduct, loadDemoCatalog } from '@/lib/demoCatalog'
import type { CatalogProduct } from '@/types/catalog'

export function useProductDetail() {
  const route = useRoute()
  const router = useRouter()
  const { addToCart, openCart } = useCart()
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()

  // Produk hasil prerender dipakai sebagai state awal supaya hidrasi cocok.
  const initialSlug = String(route.params.slug || '')
  const seededProduct = getInitialProduct(initialSlug)

  const product = ref<CatalogProduct | null>(seededProduct ? decorateProduct(seededProduct) : null)
  const related = ref<CatalogProduct[]>([])
  const loading = ref(!seededProduct)
  const error = ref('')
  const usingFallback = ref(false)
  const qty = ref(1)
  const liked = ref(Boolean(seededProduct?.isLiked ?? seededProduct?.is_liked))

  const maxStock = computed(() => Math.max(0, Number(product.value?.stock ?? 0)))
  const soldOut = computed(() => maxStock.value <= 0)
  const lowStock = computed(() => maxStock.value > 0 && maxStock.value <= 5)
  const subtotal = computed(() => Number(product.value?.price || 0) * qty.value)
  const categoryVisual = computed(() => visualForCategory(product.value?.category || null))
  const productImage = computed(() => (product.value ? productImageUrl(product.value, 960) : null))
  /** URL asli (bukan hasil optimizer) untuk og:image, JSON-LD, dan canonical. */
  const productImageRaw = computed(() =>
    product.value ? catalogImageUrl(primaryImage(product.value)) : null,
  )

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
      rememberProducts(pool)
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
      rememberProducts([product.value])
      await loadRelated(product.value)
    } catch (cause) {
      // Utamakan salinan produk asli dari cache sebelum data demo.
      const cached = findCachedProduct(slug)
      if (cached) {
        product.value = decorateProduct(cached)
        liked.value = Boolean(cached.is_liked || cached.isLiked)
        const pool = cachedProducts()
        related.value = pool.length > 1 ? pickRelated(product.value, pool) : []
        error.value = ''
      } else {
        const shown = await loadDemoDetail(slug)
        if (!shown) {
          error.value =
            cause instanceof ApiError
              ? cause.message
              : 'Detail produk gagal dimuat. Coba lagi sebentar.'
        }
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
      openAuthDialog(route.fullPath)
      return
    }
    addToCart(product.value, qty.value)
    openCart()
  }

  function buyNow() {
    if (!product.value || soldOut.value) return
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk membeli')
      openAuthDialog(route.fullPath)
      return
    }
    addToCart(product.value, qty.value)
    router.push('/keranjang')
  }

  async function toggleLike() {
    if (!product.value) return
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menyimpan produk favorit')
      openAuthDialog(route.fullPath)
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
    } catch (cause) {
      showToast(
        isNetworkError(cause)
          ? 'Favorit tidak tersimpan saat offline. Coba lagi setelah terhubung.'
          : 'Gagal menyimpan produk. Coba lagi.',
      )
    }
  }

  function addRelated(item: CatalogProduct) {
    if (Number(item.stock ?? 0) <= 0) {
      showToast(`${item.name} sedang habis`)
      return
    }
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menambah ke keranjang')
      openAuthDialog(route.fullPath)
      return
    }
    addToCart(item)
  }

  async function toggleRelatedLike(item: CatalogProduct) {
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menyimpan produk favorit')
      openAuthDialog(route.fullPath)
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
    } catch (cause) {
      showToast(
        isNetworkError(cause)
          ? 'Favorit tidak tersimpan saat offline. Coba lagi setelah terhubung.'
          : 'Gagal menyimpan produk. Coba lagi.',
      )
    }
  }

  /**
   * Setelah hidrasi selesai, segarkan data dari API tanpa mengosongkan layar.
   * Kalau gagal, data hasil prerender tetap ditampilkan.
   */
  async function refreshSeeded(slug: string) {
    try {
      const data = await catalogApi.product(slug)
      if (String(route.params.slug || '') !== slug) return
      product.value = decorateProduct(data)
      liked.value = Boolean(data.is_liked || data.isLiked)
      rememberProducts([product.value])
      await loadRelated(product.value)
    } catch {
      // Diamkan: data hasil prerender masih valid untuk ditampilkan.
    }
  }

  // Lewati pemuatan awal hanya untuk slug yang sudah punya data prerender,
  // supaya render pertama di client identik dengan HTML server.
  let pendingSeedSlug: string | null = seededProduct ? initialSlug : null

  watch(
    () => route.params.slug,
    (slug) => {
      if (pendingSeedSlug && String(slug) === pendingSeedSlug) {
        pendingSeedSlug = null
        return
      }
      pendingSeedSlug = null
      void loadProduct()
    },
    { immediate: true },
  )

  useApiReconnect(() => {
    if (!error.value && !usingFallback.value) return
    pendingSeedSlug = null
    void loadProduct()
  })

  onMounted(() => {
    if (!seededProduct) return
    void refreshSeeded(initialSlug)
  })

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
    productImageRaw,
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

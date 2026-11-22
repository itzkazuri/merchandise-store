import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { catalogApi } from '@/api/catalog'
import { ApiError } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { decorateProduct, isPreorder, visualForCategory } from '@/lib/productVisual'
import { loadDemoCatalog, type DemoCatalog } from '@/lib/demoCatalog'
import type { CatalogProduct, CatalogSort, Category, HomeCatalog } from '@/types/catalog'

const PAGE_SIZE = 24

export function useHomeCatalog() {
  const route = useRoute()
  const router = useRouter()
  const { addToCart } = useCart()
  const { showToast } = useToast()
  const { isAuthenticated } = useAuth()

  const products = ref<CatalogProduct[]>([])
  const heroProducts = ref<CatalogProduct[]>([])
  const categories = ref<Category[]>([])
  const homeFeed = ref<HomeCatalog | null>(null)

  const loading = ref(true)
  const loadingMore = ref(false)
  const error = ref('')
  const usingFallback = ref(false)
  const fallbackNote = ref('')
  const page = ref(1)
  const total = ref(0)
  const hasNext = ref(false)

  const searchQuery = ref(String(route.query.q || ''))
  const selectedCategory = ref(String(route.query.kategori || ''))
  const sortOption = ref<CatalogSort>('newest')

  let demoCatalog: DemoCatalog | null = null

  const categoryChips = computed(() => [
    { name: 'Semua', slug: '', icon: 'layout-grid', color: 'bg-white' },
    ...categories.value.map((category) => {
      const visual = visualForCategory(category)
      return { name: category.name, slug: category.slug, icon: visual.icon, color: visual.color }
    }),
  ])

  const activeFilters = computed(
    () => Boolean(searchQuery.value.trim()) || Boolean(selectedCategory.value),
  )

  /** Kumpulan produk dari endpoint home + katalog, tanpa duplikat. */
  const sectionPool = computed(() => {
    const seen = new Set<number>()
    const result: CatalogProduct[] = []
    const add = (list?: CatalogProduct[]) => {
      for (const product of list || []) {
        if (seen.has(product.id)) continue
        seen.add(product.id)
        result.push(product)
      }
    }
    add(homeFeed.value?.new_arrivals)
    add(homeFeed.value?.best_sellers)
    add(homeFeed.value?.handmade)
    add(homeFeed.value?.imported)
    add(products.value)
    return result
  })

  const newArrivals = computed(() => {
    const feed = homeFeed.value?.new_arrivals || []
    const source = feed.length ? feed : products.value
    return [...source]
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA || b.id - a.id
      })
      .slice(0, 5)
  })

  const hotSale = computed(() => {
    const feed = homeFeed.value?.best_sellers || []
    const source = feed.length
      ? feed
      : [...sectionPool.value].sort(
          (a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0) || b.id - a.id,
        )
    return source.slice(0, 4)
  })

  const preorderProducts = computed(() =>
    sectionPool.value.filter((product) => isPreorder(product)).slice(0, 6),
  )

  const similarAnchor = computed(() => newArrivals.value[0] || sectionPool.value[0] || null)

  const similarProducts = computed(() => {
    const anchor = similarAnchor.value
    if (!anchor) return []

    const scoreFor = (product: CatalogProduct) => {
      let score = 0
      if (anchor.anime?.id && product.anime?.id === anchor.anime.id) score += 4
      else if (anchor.anime?.slug && product.anime?.slug === anchor.anime.slug) score += 3
      if (anchor.category?.id && product.category?.id === anchor.category.id) score += 2
      else if (anchor.category?.slug && product.category?.slug === anchor.category.slug) score += 2
      if (anchor.series && product.series === anchor.series) score += 2
      if (anchor.cat && product.cat === anchor.cat) score += 1
      if (anchor.product_type && product.product_type === anchor.product_type) score += 1
      return score
    }

    const candidates = sectionPool.value.filter((product) => product.id !== anchor.id)
    const ranked = candidates
      .map((product) => ({ product, score: scoreFor(product) }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.product.sold_count || 0) - Number(a.product.sold_count || 0),
      )
      .map((entry) => entry.product)

    const seen = new Set(ranked.map((product) => product.id))
    for (const product of candidates) {
      if (seen.has(product.id)) continue
      ranked.push(product)
      seen.add(product.id)
    }
    return ranked.slice(0, 4)
  })

  function productLiked(product: CatalogProduct) {
    return Boolean(product.isLiked ?? product.is_liked)
  }

  function syncQuery() {
    const query: Record<string, string> = {}
    if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
    if (selectedCategory.value) query.kategori = selectedCategory.value
    router.replace({ name: 'home', query })
  }

  function fallbackHaystack(product: CatalogProduct) {
    return [
      product.name,
      product.series,
      product.cat,
      product.spec,
      product.description,
      product.badge,
      product.anime?.name,
      product.category?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }

  function applyLocalFallback() {
    if (!demoCatalog) return
    const query = searchQuery.value.trim().toLowerCase()
    const category = selectedCategory.value
    let list = [...demoCatalog.products]

    if (query) list = list.filter((product) => fallbackHaystack(product).includes(query))
    if (category) {
      list = list.filter((product) => {
        const slug = product.cat?.toLowerCase().replace(/\s+/g, '-')
        return product.category?.slug === category || slug === category
      })
    }

    const sorted = [...list]
    if (sortOption.value === 'price_asc') sorted.sort((a, b) => Number(a.price) - Number(b.price))
    else if (sortOption.value === 'price_desc') sorted.sort((a, b) => Number(b.price) - Number(a.price))
    else if (sortOption.value === 'best_seller')
      sorted.sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0))
    else sorted.sort((a, b) => b.id - a.id)

    products.value = sorted
    total.value = sorted.length
    hasNext.value = false
  }

  async function useFallback(message: string) {
    demoCatalog = demoCatalog || (await loadDemoCatalog())
    if (!demoCatalog) return false

    usingFallback.value = true
    fallbackNote.value = message
    applyLocalFallback()
    if (!heroProducts.value.length) heroProducts.value = demoCatalog.products.slice(0, 3)
    if (!categories.value.length) categories.value = demoCatalog.categories
    return true
  }

  function ensureCategories() {
    if (categories.value.length) return
    if (usingFallback.value && demoCatalog) {
      categories.value = demoCatalog.categories
      return
    }
    const derived = new Map<string, Category>()
    for (const product of products.value) {
      if (product.category) derived.set(product.category.slug, product.category)
    }
    categories.value = [...derived.values()]
  }

  async function load(reset = true) {
    if (reset) {
      page.value = 1
      loading.value = true
    } else {
      loadingMore.value = true
    }
    error.value = ''

    if (usingFallback.value) {
      applyLocalFallback()
      loading.value = false
      loadingMore.value = false
      return
    }

    try {
      const data = await catalogApi.products({
        page: page.value,
        size: PAGE_SIZE,
        q: searchQuery.value.trim() || undefined,
        category: selectedCategory.value || undefined,
        sort: sortOption.value,
      })
      const items = (data.items || []).map(decorateProduct)
      products.value = reset ? items : [...products.value, ...items]
      total.value = data.total
      hasNext.value = Boolean(data.has_next)
      usingFallback.value = false

      if (reset && data.total === 0 && !activeFilters.value) {
        const used = await useFallback(
          'Belum ada produk aktif di server. Menampilkan contoh katalog untuk melihat tampilan.',
        )
        if (used) error.value = ''
      }

      if (!heroProducts.value.length && items.length) {
        heroProducts.value = items.slice(0, 3)
      }
    } catch (cause) {
      error.value = cause instanceof ApiError ? cause.message : 'Katalog gagal dimuat.'
      if (reset && !products.value.length && !activeFilters.value) {
        const used = await useFallback('Katalog server belum bisa dihubungi. Menampilkan contoh produk.')
        if (used) error.value = ''
      }
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  async function loadMore() {
    if (!hasNext.value || loadingMore.value) return
    page.value += 1
    await load(false)
  }

  async function loadMeta() {
    const [categoriesResult, homeResult] = await Promise.allSettled([
      catalogApi.categories({ kind: 'product' }),
      catalogApi.home({ limit: 12 }),
    ])

    if (categoriesResult.status === 'fulfilled') {
      categories.value = categoriesResult.value || []
    }

    if (homeResult.status === 'fulfilled') {
      const data = homeResult.value
      homeFeed.value = {
        total_products: data.total_products || 0,
        new_arrivals: (data.new_arrivals || []).map(decorateProduct),
        best_sellers: (data.best_sellers || []).map(decorateProduct),
        handmade: (data.handmade || []).map(decorateProduct),
        imported: (data.imported || []).map(decorateProduct),
      }

      const heroItems = (data.new_arrivals || data.best_sellers || [])
        .slice(0, 3)
        .map(decorateProduct)
      if (heroItems.length) heroProducts.value = heroItems
    }
  }

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleSearch() {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      syncQuery()
      void load(true)
    }, 380)
  }

  function runSearch() {
    clearTimeout(searchTimer)
    syncQuery()
    void load(true)
  }

  function resetFilters() {
    searchQuery.value = ''
    selectedCategory.value = ''
    sortOption.value = 'newest'
    runSearch()
  }

  function retryCatalog() {
    usingFallback.value = false
    fallbackNote.value = ''
    void load(true)
  }

  function handleAdd(product: CatalogProduct) {
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menambah ke keranjang')
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }
    if (Number(product.stock ?? 0) <= 0) {
      showToast(`${product.name} sedang habis`)
      return
    }
    addToCart(product)
  }

  function updateLikeState(productId: number, liked: boolean) {
    const lists = [
      products.value,
      heroProducts.value,
      homeFeed.value?.new_arrivals,
      homeFeed.value?.best_sellers,
      homeFeed.value?.handmade,
      homeFeed.value?.imported,
    ].filter((list): list is CatalogProduct[] => Boolean(list))

    for (const list of lists) {
      const found = list.find((item) => item.id === productId)
      if (!found) continue
      found.is_liked = liked
      found.isLiked = liked
    }
  }

  async function handleToggleLike(product: CatalogProduct) {
    if (!isAuthenticated.value) {
      showToast('Masuk dulu untuk menyimpan produk favorit')
      router.push({ name: 'login', query: { redirect: route.fullPath } })
      return
    }

    const liked = productLiked(product)
    if (usingFallback.value) {
      updateLikeState(product.id, !liked)
      return
    }

    try {
      if (liked) await catalogApi.unlike(product.id)
      else await catalogApi.like(product.id)
      updateLikeState(product.id, !liked)
    } catch {
      showToast('Gagal menyimpan produk. Coba lagi.')
    }
  }

  onBeforeUnmount(() => clearTimeout(searchTimer))

  watch([searchQuery, selectedCategory, sortOption], scheduleSearch)
  watch(
    () => route.query.q,
    (value) => {
      const next = typeof value === 'string' ? value : ''
      if (next !== searchQuery.value) {
        searchQuery.value = next
        runSearch()
      }
    },
  )

  onMounted(async () => {
    await Promise.allSettled([loadMeta(), load(true)])
    ensureCategories()
  })

  return {
    products,
    heroProducts,
    categories,
    categoryChips,
    loading,
    loadingMore,
    error,
    usingFallback,
    fallbackNote,
    total,
    hasNext,
    searchQuery,
    selectedCategory,
    sortOption,
    activeFilters,
    newArrivals,
    hotSale,
    preorderProducts,
    similarAnchor,
    similarProducts,
    productLiked,
    runSearch,
    resetFilters,
    retryCatalog,
    loadMore,
    handleAdd,
    handleToggleLike,
  }
}

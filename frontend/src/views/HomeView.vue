<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeo } from '@/composables/useSeo'
import SiteHeader from '@/components/SiteHeader.vue'
import BannerCarousel from '@/components/BannerCarousel.vue'
import ProductCard from '@/components/ProductCard.vue'
import CartDrawer from '@/components/CartDrawer.vue'
import ToastNotice from '@/components/ToastNotice.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import DynamicIcon from '@/components/DynamicIcon.vue'
import GoogleOneTap from '@/components/GoogleOneTap.vue'
import { RotateCcw, SearchX } from 'lucide-vue-next'
import { sampleProducts } from '@/data/sampleProducts'
import { storefrontBanners } from '@/data/banners'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import type { CatalogProduct, Category } from '@/types/catalog'
import { catalogApi } from '@/api/catalog'
import { decorateProduct, visualForCategory } from '@/lib/productVisual'
import { ApiError } from '@/api/client'

useSeo({
  title: 'Katalog Merchandise & Mainan Anime',
  description: 'Temukan koleksi figure, plushie, blind box, cetak art, dan aksesori anime favoritmu di Mochibako.',
  keywords: ['anime merch', 'figure', 'plushie', 'blind box', 'mochibako', 'umkm anime'],
  type: 'website',
})

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'best_seller'

const PAGE_SIZE = 24
const route = useRoute()
const router = useRouter()
const { addToCart } = useCart()
const { showToast } = useToast()
const { isAuthenticated } = useAuth()

const products = ref<CatalogProduct[]>([])
const heroProducts = ref<CatalogProduct[]>([])
const categories = ref<Category[]>([])
const animes = ref<Category[]>([])

const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const usingFallback = ref(false)
const page = ref(1)
const total = ref(0)
const hasNext = ref(false)

const searchQuery = ref(String(route.query.q || ''))
const selectedCategory = ref(String(route.query.kategori || ''))
const selectedAnime = ref(String(route.query.anime || ''))
const sortOption = ref<SortOption>('newest')

const categoryChips = computed(() => [
  { name: 'Semua', slug: '', icon: 'layout-grid', color: 'bg-white' },
  ...categories.value.map((category) => {
    const visual = visualForCategory(category)
    return { name: category.name, slug: category.slug, icon: visual.icon, color: visual.color }
  }),
])

const activeFilters = computed(
  () => Boolean(searchQuery.value.trim()) || Boolean(selectedCategory.value) || Boolean(selectedAnime.value),
)

function syncQuery() {
  const query: Record<string, string> = {}
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (selectedCategory.value) query.kategori = selectedCategory.value
  if (selectedAnime.value) query.anime = selectedAnime.value
  router.replace({ name: 'home', query })
}

async function load(reset = true) {
  if (reset) {
    page.value = 1
    loading.value = true
  } else {
    loadingMore.value = true
  }
  error.value = ''

  try {
    const data = await catalogApi.products({
      page: page.value,
      size: PAGE_SIZE,
      q: searchQuery.value.trim() || undefined,
      category: selectedCategory.value || undefined,
      anime: selectedAnime.value || undefined,
      sort: sortOption.value,
    })
    const items = (data.items || []).map(decorateProduct)
    products.value = reset ? items : [...products.value, ...items]
    total.value = data.total
    hasNext.value = Boolean(data.has_next)
    usingFallback.value = false

    if (!heroProducts.value.length && items.length) {
      heroProducts.value = items.slice(0, 3)
    }
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Katalog gagal dimuat.'
    if (reset && !products.value.length) {
      products.value = sampleProducts.map(decorateProduct)
      total.value = products.value.length
      hasNext.value = false
      usingFallback.value = true
      if (!heroProducts.value.length) {
        heroProducts.value = products.value.slice(0, 3)
        }
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
    catalogApi.home({ limit: 3 }),
  ])

  if (categoriesResult.status === 'fulfilled') {
    categories.value = categoriesResult.value || []
  }
  if (homeResult.status === 'fulfilled') {
    const heroItems = (homeResult.value.new_arrivals || homeResult.value.best_sellers || [])
      .slice(0, 3)
      .map(decorateProduct)
    if (heroItems.length) {
      heroProducts.value = heroItems
    }
  }

  const animeResult = await catalogApi.categories({ kind: 'anime' }).catch(() => [])
  animes.value = animeResult || []
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    syncQuery()
    load(true)
  }, 380)
}
function runSearch() {
  clearTimeout(searchTimer)
  syncQuery()
  load(true)
}
function resetFilters() {
  searchQuery.value = ''
  selectedCategory.value = ''
  selectedAnime.value = ''
  sortOption.value = 'newest'
  runSearch()
}

onBeforeUnmount(() => clearTimeout(searchTimer))

watch([searchQuery, selectedCategory, selectedAnime, sortOption], scheduleSearch)
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

async function handleToggleLike(product: CatalogProduct) {
  if (!isAuthenticated.value) {
    showToast('Masuk dulu untuk menyimpan produk favorit')
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  try {
    const liked = Boolean(product.is_liked || product.isLiked)
    if (liked) await catalogApi.unlike(product.id)
    else await catalogApi.like(product.id)
    const next = !liked
    for (const list of [products.value, heroProducts.value]) {
      const found = list.find((item) => item.id === product.id)
      if (found) {
        found.is_liked = next
        found.isLiked = next
      }
    }
  } catch {
    showToast('Gagal menyimpan produk. Coba lagi.')
  }
}

onMounted(async () => {
  await Promise.allSettled([loadMeta(), load(true)])
})
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col">
    <!-- Header -->
    <SiteHeader v-model:search-model="searchQuery" @search="runSearch" />

    <!-- Hero Banner Carousel -->
    <BannerCarousel
      :banners="storefrontBanners"
      :products="heroProducts"
      @add="handleAdd"
    />

    <!-- Main Products Catalog -->
    <main id="rak" class="max-w-6xl mx-auto px-3.5 sm:px-5 mt-6 sm:mt-10 pb-16 scroll-mt-20 w-full flex-1">
      <!-- Filter and Sort Controls -->
      <div class="flex flex-col md:flex-row md:items-center gap-2.5 sm:gap-3 justify-between">
        <!-- Category chips (Horizontal scrollable with smooth touch) -->
        <div id="cats" class="flex gap-1.5 sm:gap-2 overflow-x-auto py-1 -mx-3.5 px-3.5 sm:-mx-5 sm:px-5 md:mx-0 md:px-0 scrollbar-none">
          <button
            v-for="cat in categoryChips"
            :key="cat.slug || 'all'"
            type="button"
            class="chip text-xs sm:text-sm py-1 pl-1 pr-3 sm:py-1 sm:pl-1 sm:pr-3.5 shrink-0"
            :aria-pressed="selectedCategory === cat.slug"
            @click="selectedCategory = cat.slug"
          >
            <span :class="['ic w-6 h-6 sm:w-7 sm:h-7', cat.color]">
              <DynamicIcon :name="cat.icon" :size="14" class="sm:hidden" />
              <DynamicIcon :name="cat.icon" :size="16" class="hidden sm:block" />
            </span>
            <span>{{ cat.name }}</span>
          </button>
        </div>

        <!-- Anime filter & Sort -->
        <div class="flex items-center gap-2 pt-1 md:pt-0 md:ml-auto">
          <select
            id="anime"
            v-model="selectedAnime"
            aria-label="Filter seri anime"
            class="h-9 sm:h-10 min-w-0 flex-1 md:flex-none rounded-full border-2 border-ink bg-white px-3 sm:px-4 text-xs sm:text-sm font-semibold text-ink focus:outline-none focus:border-sun"
          >
            <option value="">Semua anime</option>
            <option v-for="anime in animes" :key="anime.id" :value="anime.slug">{{ anime.name }}</option>
          </select>
          <select
            id="sort"
            v-model="sortOption"
            aria-label="Urutkan"
            class="h-9 sm:h-10 shrink-0 rounded-full border-2 border-ink bg-white px-3 sm:px-4 text-xs sm:text-sm font-semibold text-ink focus:outline-none focus:border-sun"
          >
            <option value="newest">Terbaru</option>
            <option value="price_asc">Harga terendah</option>
            <option value="price_desc">Harga tertinggi</option>
            <option value="best_seller">Terlaris</option>
          </select>
        </div>
      </div>

      <!-- Result summary -->
      <div class="mt-5 mb-3 flex items-center justify-between gap-3">
        <p id="count" class="text-xs sm:text-sm font-bold text-ink/60" aria-live="polite">
          <template v-if="loading && !products.length">Memuat katalog…</template>
          <template v-else-if="total">{{ total.toLocaleString('id-ID') }} produk{{ activeFilters ? ' cocok' : '' }}</template>
          <template v-else>0 produk</template>
        </p>
        <button
          v-if="activeFilters"
          type="button"
          class="inline-flex items-center gap-1.5 text-xs font-bold text-ink/60 hover:text-ink transition-colors"
          @click="resetFilters"
        >
          <RotateCcw :size="13" /> Reset filter
        </button>
      </div>

      <p
        v-if="usingFallback"
        class="mb-4 rounded-xl border-2 border-ink/15 bg-white/70 px-3.5 py-2.5 text-xs font-semibold text-ink/70"
      >
        Katalog server belum bisa dihubungi. Menampilkan contoh produk.
      </p>

      <!-- Loading skeleton -->
      <div v-if="loading && !products.length" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        <div v-for="n in 8" :key="n" class="nb p-2 sm:p-2.5 animate-pulse">
          <div class="aspect-square rounded-lg sm:rounded-xl bg-soft/70"></div>
          <div class="mt-3 h-3 w-1/2 rounded bg-soft/80"></div>
          <div class="mt-2 h-4 w-4/5 rounded bg-soft/80"></div>
          <div class="mt-2 h-3 w-2/3 rounded bg-soft/70"></div>
          <div class="mt-4 h-8 rounded-full bg-soft/70"></div>
        </div>
      </div>

      <!-- Products Grid (2 cols mobile, 3 cols tablet, 4 cols desktop) -->
      <div
        v-else-if="products.length > 0"
        id="grid"
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5"
      >
        <ProductCard
          v-for="(item, idx) in products"
          :key="item.id"
          :product="item"
          :index="idx"
          @add="handleAdd"
          @toggle-like="handleToggleLike"
        />
      </div>

      <!-- Empty State -->
      <div
        v-else
        id="empty"
        class="nb p-6 sm:p-10 text-center font-semibold text-ink/75 my-8 flex flex-col items-center justify-center gap-2"
      >
        <SearchX :size="40" class="text-ink/40 mb-1" />
        <p class="font-head text-base sm:text-lg text-ink font-bold">Produk tidak ditemukan</p>
        <p class="text-xs sm:text-sm text-ink/65">Coba kata kunci lain atau pilih kategori yang berbeda.</p>
        <button
          v-if="activeFilters"
          type="button"
          class="btn bg-sun text-ink px-4 py-1.5 font-head font-semibold text-xs sm:text-sm mt-2"
          @click="resetFilters"
        >
          Reset Pencarian
        </button>
      </div>

      <!-- Load more -->
      <div v-if="hasNext && products.length" class="mt-8 flex justify-center">
        <button
          type="button"
          class="btn bg-white text-ink px-5 sm:px-6 h-10 font-head font-semibold text-sm"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? 'Memuat…' : 'Muat produk lainnya' }}
        </button>
      </div>

      <p v-if="error && products.length" class="mt-6 text-center text-xs font-semibold text-destructive">{{ error }}</p>
    </main>

    <!-- Cart Drawer -->
    <CartDrawer />

    <!-- Toast Notification -->
    <ToastNotice />

    <!-- Google One Tap Quick Login -->
    <GoogleOneTap />

    <!-- Footer -->
    <SiteFooter />
  </div>
</template>

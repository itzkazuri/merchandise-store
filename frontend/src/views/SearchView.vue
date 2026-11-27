<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, SearchX, RotateCcw, SlidersHorizontal } from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import ProductCard from '@/components/ProductCard.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useSeo } from '@/composables/useSeo'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { openAuthDialog } from '@/composables/useAuthDialog'
import { useApiReconnect } from '@/composables/useApiReconnect'
import { catalogApi } from '@/api/catalog'
import { isNetworkError } from '@/api/errors'
import { rememberProducts, searchCachedProducts } from '@/lib/catalogCache'
import { decorateProduct } from '@/lib/productVisual'
import type { CatalogProduct, Category } from '@/types/catalog'

const route = useRoute()
const router = useRouter()
const { addToCart } = useCart()
const { showToast } = useToast()
const { isAuthenticated } = useAuth()

const q = ref(String(route.query.q || ''))
const selectedCategory = ref(String(route.query.kategori || ''))
const sortOption = ref(String(route.query.sort || 'newest'))

const products = ref<CatalogProduct[]>([])
const categories = ref<Category[]>([])
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const hasNext = ref(false)
const loadingMore = ref(false)
const error = ref('')

const categoryOptions = computed(() => [
  { value: '', label: 'Semua kategori' },
  ...categories.value.map((category) => ({ value: category.slug, label: category.name })),
])

const SORT_OPTIONS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'price_asc', label: 'Harga: Murah dulu' },
  { value: 'price_desc', label: 'Harga: Mahal dulu' },
  { value: 'best_seller', label: 'Terlaris' },
]

const PAGE_SIZE = 20

useSeo({
  title: q.value ? `Hasil: "${q.value}"` : 'Cari Produk',
  description: 'Cari merchandise anime, figure, plushie, dan aksesori favoritmu di Mochibako.',
})

async function search(reset = true) {
  if (reset) { page.value = 1; products.value = [] }
  loading.value = reset
  loadingMore.value = !reset
  error.value = ''

  try {
    const data = await catalogApi.products({
      q: q.value.trim() || undefined,
      category: selectedCategory.value || undefined,
      sort: sortOption.value,
      page: page.value,
      size: PAGE_SIZE,
    })
    const items = (data.items || []).map(decorateProduct)
    rememberProducts(items)
    products.value = reset ? items : [...products.value, ...items]
    total.value = data.total
    hasNext.value = Boolean(data.has_next)
  } catch (cause) {
    if (isNetworkError(cause)) {
      const local = searchCachedProducts({
        q: q.value,
        category: selectedCategory.value,
        sort: sortOption.value,
        page: page.value,
        size: PAGE_SIZE,
      })
      if (local.items.length) {
        const items = local.items.map(decorateProduct)
        products.value = reset ? items : [...products.value, ...items]
        total.value = local.total
        hasNext.value = local.pages > page.value
        error.value = 'Mode offline: hasil diambil dari katalog yang tersimpan di perangkat ini.'
      } else {
        error.value = 'Server tidak bisa dihubungi dan katalog belum tersimpan di perangkat ini.'
      }
      return
    }
    error.value = 'Gagal memuat hasil pencarian. Coba lagi.'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMore() {
  if (!hasNext.value || loadingMore.value) return
  page.value++
  await search(false)
}

function syncQuery() {
  const query: Record<string, string> = {}
  if (q.value.trim()) query.q = q.value.trim()
  if (selectedCategory.value) query.kategori = selectedCategory.value
  if (sortOption.value !== 'newest') query.sort = sortOption.value
  router.replace({ name: 'search', query })
}

function handleAdd(product: CatalogProduct) {
  if (!isAuthenticated.value) {
    showToast('Masuk dulu untuk menambah ke keranjang')
    openAuthDialog(route.fullPath)
    return
  }
  if (Number(product.stock ?? 0) <= 0) { showToast(`${product.name} sedang habis`); return }
  addToCart(product)
}

function reset() {
  q.value = ''
  selectedCategory.value = ''
  sortOption.value = 'newest'
  syncQuery()
  search()
}

let timer: ReturnType<typeof setTimeout> | undefined
watch([q, selectedCategory, sortOption], () => {
  clearTimeout(timer)
  timer = setTimeout(() => { syncQuery(); search() }, 350)
})

watch(() => route.query.q, (val) => {
  const next = typeof val === 'string' ? val : ''
  if (next !== q.value) { q.value = next; search() }
})

onMounted(async () => {
  const [, catResult] = await Promise.allSettled([search(), catalogApi.categories({ kind: 'product' })])
  if (catResult.status === 'fulfilled') categories.value = catResult.value || []
})

useApiReconnect(() => {
  if (!error.value) return
  void search(true)
})
</script>

<template>
  <StoreShell>
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">

      <!-- Heading -->
      <div class="mb-5 sm:mb-7">
        <p class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">Pencarian</p>
        <h1 class="font-head text-2xl sm:text-3xl font-bold text-ink mt-0.5">
          {{ q.trim() ? `Hasil untuk "${q.trim()}"` : 'Cari Produk' }}
        </h1>
        <p v-if="!loading" class="mt-1 text-xs sm:text-sm font-semibold text-ink/55">
          {{ total.toLocaleString('id-ID') }} produk ditemukan
        </p>
      </div>

      <!-- Search Box -->
      <div class="mb-5 flex gap-2 items-center">
        <label class="relative flex-1">
          <Search :size="17" class="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" />
          <input
            v-model="q"
            type="search"
            placeholder="Ketik nama produk atau seri anime…"
            class="w-full h-11 rounded-full border-2 border-ink bg-white pl-9 pr-4 text-sm font-semibold placeholder:text-ink/40 focus:outline-none focus:border-sun"
          />
        </label>
      </div>

      <!-- Filters Bar -->
      <div class="flex flex-wrap gap-2 mb-5 items-center">
        <span class="flex items-center gap-1.5 text-xs font-bold text-ink/60">
          <SlidersHorizontal :size="13" /> Filter:
        </span>

        <!-- Category -->
        <AppSelect
          v-model="selectedCategory"
          :options="categoryOptions"
          aria-label="Kategori"
          size="sm"
          class="max-w-[190px]"
        />

        <!-- Sort -->
        <AppSelect
          v-model="sortOption"
          :options="SORT_OPTIONS"
          aria-label="Urutkan"
          size="sm"
          class="max-w-[170px]"
        />

        <button
          v-if="q || selectedCategory || sortOption !== 'newest'"
          type="button"
          class="h-8 rounded-full border-2 border-ink/30 bg-white px-3 text-xs font-semibold flex items-center gap-1.5 hover:border-ink transition-colors"
          @click="reset"
        >
          <RotateCcw :size="12" /> Reset
        </button>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          v-for="n in 8"
          :key="n"
          class="nb rounded-xl aspect-[3/4] animate-pulse bg-soft"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="nb p-8 text-center max-w-sm mx-auto"
      >
        <SearchX :size="40" class="mx-auto text-ink/30 mb-3" />
        <p class="font-head font-bold text-lg">Ups, ada kesalahan</p>
        <p class="text-sm text-ink/60 mt-1">{{ error }}</p>
        <button
          type="button"
          class="btn bg-ink text-bg mt-4 h-9 px-5 font-head text-sm"
          @click="search()"
        >
          Coba lagi
        </button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="!products.length"
        class="nb p-10 sm:p-14 text-center max-w-sm mx-auto"
      >
        <SearchX :size="44" class="mx-auto text-ink/25 mb-4" />
        <h2 class="font-head font-bold text-xl text-ink">Tidak ada hasil</h2>
        <p class="text-sm text-ink/60 mt-1.5 leading-snug">
          Coba kata kunci lain atau hapus filter yang aktif.
        </p>
        <button
          type="button"
          class="btn bg-ink text-bg mt-5 h-9 px-5 font-head text-sm"
          @click="reset"
        >
          <RotateCcw :size="14" class="mr-1.5" /> Reset pencarian
        </button>
      </div>

      <!-- Results -->
      <template v-else>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <ProductCard
            v-for="(product, i) in products"
            :key="product.id"
            :product="product"
            :index="i"
            @add="handleAdd"
          />
        </div>

        <!-- Load More -->
        <div v-if="hasNext" class="mt-8 text-center">
          <button
            type="button"
            class="btn bg-white border-2 border-ink h-11 px-7 font-head font-semibold text-sm"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? 'Memuat…' : 'Muat lebih banyak' }}
          </button>
        </div>
      </template>
    </div>
  </StoreShell>
</template>

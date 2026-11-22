<script setup lang="ts">
import { RotateCcw, SearchX, Sparkles } from 'lucide-vue-next'
import DynamicIcon from '@/components/DynamicIcon.vue'
import ProductCard from '@/components/ProductCard.vue'
import HomeSectionHeading from './HomeSectionHeading.vue'
import type { CatalogProduct, CatalogSort } from '@/types/catalog'

defineProps<{
  products: CatalogProduct[]
  categoryChips: Array<{ name: string; slug: string; icon: string; color: string }>
  loading: boolean
  loadingMore: boolean
  error: string
  usingFallback: boolean
  fallbackNote: string
  total: number
  activeFilters: boolean
  selectedCategory: string
  sortOption: CatalogSort
  hasNext: boolean
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
  toggleLike: [product: CatalogProduct]
  reset: []
  retry: []
  loadMore: []
  'update:selectedCategory': [value: string]
  'update:sortOption': [value: CatalogSort]
}>()

function selectCategory(slug: string) {
  emit('update:selectedCategory', slug)
}

function changeSort(event: Event) {
  emit('update:sortOption', (event.target as HTMLSelectElement).value as CatalogSort)
}
</script>

<template>
  <section
    id="rak"
    aria-labelledby="katalog-title"
    class="max-w-6xl mx-auto px-3.5 sm:px-5 mt-12 sm:mt-20 pb-16 scroll-mt-24"
  >
    <HomeSectionHeading
      title-id="katalog-title"
      title="Semua produk"
      description="Cari berdasarkan nama, anime, atau kategori lewat kolom pencarian di atas."
    >
      <template #actions>
        <p id="count" class="text-xs sm:text-sm font-bold text-ink/55" aria-live="polite">
          <template v-if="loading && !products.length">Memuat katalog…</template>
          <template v-else-if="total">{{ total.toLocaleString('id-ID') }} produk{{ activeFilters ? ' cocok' : '' }}</template>
          <template v-else>0 produk</template>
        </p>
      </template>
    </HomeSectionHeading>

    <div class="mt-4 flex flex-col md:flex-row md:items-center gap-2.5 sm:gap-3 justify-between">
      <div id="cats" class="flex gap-1.5 sm:gap-2 overflow-x-auto py-1 -mx-3.5 px-3.5 sm:-mx-5 sm:px-5 md:mx-0 md:px-0 scrollbar-none">
        <button
          v-for="cat in categoryChips"
          :key="cat.slug || 'all'"
          type="button"
          class="chip text-xs sm:text-sm py-1 pl-1 pr-3 sm:py-1 sm:pl-1 sm:pr-3.5 shrink-0"
          :aria-pressed="selectedCategory === cat.slug"
          @click="selectCategory(cat.slug)"
        >
          <span :class="['ic w-6 h-6 sm:w-7 sm:h-7', cat.color]">
            <DynamicIcon :name="cat.icon" :size="14" class="sm:hidden" />
            <DynamicIcon :name="cat.icon" :size="16" class="hidden sm:block" />
          </span>
          <span>{{ cat.name }}</span>
        </button>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1 md:pt-0 md:ml-auto">
        <button
          v-if="activeFilters"
          type="button"
          class="inline-flex items-center gap-1.5 text-xs font-bold text-ink/60 hover:text-ink transition-colors"
          @click="emit('reset')"
        >
          <RotateCcw :size="13" /> Reset
        </button>
        <select
          id="sort"
          :value="sortOption"
          aria-label="Urutkan"
          class="h-9 sm:h-10 shrink-0 rounded-full border-2 border-ink bg-white px-3 sm:px-4 text-xs sm:text-sm font-semibold text-ink focus:outline-none focus:border-sun"
          @change="changeSort"
        >
          <option value="newest">Terbaru</option>
          <option value="price_asc">Harga terendah</option>
          <option value="price_desc">Harga tertinggi</option>
          <option value="best_seller">Terlaris</option>
        </select>
      </div>
    </div>

    <div
      v-if="usingFallback"
      class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border-2 border-ink/15 bg-white/75 px-3.5 py-2.5 text-xs font-semibold text-ink/70"
    >
      <Sparkles :size="14" class="shrink-0 text-ink/50" />
      <span>{{ fallbackNote }}</span>
      <button type="button" class="font-extrabold underline underline-offset-2 hover:text-ink" @click="emit('retry')">
        Coba server lagi
      </button>
    </div>

    <div v-if="loading && !products.length" class="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
      <div v-for="n in 8" :key="n" class="nb p-2 sm:p-2.5 animate-pulse">
        <div class="aspect-square rounded-lg sm:rounded-xl bg-soft/70"></div>
        <div class="mt-3 h-3 w-1/2 rounded bg-soft/80"></div>
        <div class="mt-2 h-4 w-4/5 rounded bg-soft/80"></div>
        <div class="mt-2 h-3 w-2/3 rounded bg-soft/70"></div>
        <div class="mt-4 h-8 rounded-full bg-soft/70"></div>
      </div>
    </div>

    <div
      v-else-if="products.length > 0"
      id="grid"
      class="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5"
    >
      <ProductCard
        v-for="(item, idx) in products"
        :key="item.id"
        :product="item"
        :index="idx"
        @add="emit('add', $event)"
        @toggle-like="emit('toggleLike', $event)"
      />
    </div>

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
        @click="emit('reset')"
      >
        Reset pencarian
      </button>
    </div>

    <div v-if="hasNext && products.length" class="mt-8 flex justify-center">
      <button
        type="button"
        class="btn bg-white text-ink px-5 sm:px-6 h-10 font-head font-semibold text-sm"
        :disabled="loadingMore"
        @click="emit('loadMore')"
      >
        {{ loadingMore ? 'Memuat…' : 'Muat produk lainnya' }}
      </button>
    </div>

    <p v-if="error && products.length" class="mt-6 text-center text-xs font-semibold text-destructive">
      {{ error }}
    </p>
  </section>
</template>

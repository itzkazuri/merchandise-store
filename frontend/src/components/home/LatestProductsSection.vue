<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import ProductCard from '@/components/ProductCard.vue'
import FeatureProductCard from './FeatureProductCard.vue'
import HomeSectionHeading from './HomeSectionHeading.vue'
import type { CatalogProduct } from '@/types/catalog'

const props = defineProps<{
  products: CatalogProduct[]
  loading?: boolean
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
  toggleLike: [product: CatalogProduct]
}>()

const featured = computed(() => props.products[0] || null)
const rest = computed(() => props.products.slice(1, 5))

function liked(product: CatalogProduct) {
  return Boolean(product.isLiked ?? product.is_liked)
}
</script>

<template>
  <section aria-labelledby="terbaru-title" class="max-w-6xl mx-auto px-3.5 sm:px-5 mt-10 sm:mt-16">
    <HomeSectionHeading
      title-id="terbaru-title"
      title="Baru mendarat di rak"
      description="Rilisan paling anyar minggu ini, dari figure import sampai karya tangan lokal."
      action-label="Lihat semua produk"
      action-to="/#rak"
    />

    <!-- Skeleton -->
    <div v-if="loading && !featured" class="mt-5 grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="n in 3" :key="n" class="nb p-2.5 animate-pulse">
        <div class="aspect-square rounded-xl bg-soft/70"></div>
        <div class="mt-3 h-4 w-3/4 rounded bg-soft/80"></div>
        <div class="mt-2 h-3 w-1/2 rounded bg-soft/70"></div>
      </div>
    </div>

    <div
      v-else-if="featured"
      class="mt-5 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.7fr)] items-start"
    >
      <FeatureProductCard
        :product="featured"
        :liked="liked(featured)"
        @add="emit('add', $event)"
        @toggle-like="emit('toggleLike', $event)"
      />

      <div v-if="rest.length" class="grid grid-cols-2 gap-3 sm:gap-4">
        <ProductCard
          v-for="(item, idx) in rest"
          :key="item.id"
          :product="item"
          :index="idx"
          @add="emit('add', $event)"
          @toggle-like="emit('toggleLike', $event)"
        />
      </div>

      <div v-else class="nb bg-white p-6 sm:p-8">
        <Sparkles :size="30" class="text-ink/35" />
        <h3 class="mt-2 font-head text-lg font-bold">Rak baru sedang diisi</h3>
        <p class="mt-1 text-sm font-semibold text-ink/60">
          Produk baru akan muncul di sini begitu admin menambahkannya.
        </p>
        <RouterLink to="/#rak" class="btn bg-sun text-ink mt-4 h-9 px-4 text-sm font-head font-semibold">
          Lihat katalog
        </RouterLink>
      </div>
    </div>
  </section>
</template>

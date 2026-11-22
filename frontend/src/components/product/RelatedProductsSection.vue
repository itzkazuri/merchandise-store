<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import ProductCard from '@/components/ProductCard.vue'
import type { CatalogProduct } from '@/types/catalog'

defineProps<{
  products: CatalogProduct[]
  categorySlug?: string | null
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
  toggleLike: [product: CatalogProduct]
}>()
</script>

<template>
  <section class="mt-10 sm:mt-14">
    <div class="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 class="font-head text-xl sm:text-2xl font-bold text-ink">Kamu mungkin suka</h2>
        <p class="text-xs sm:text-sm font-semibold text-ink/55">
          Koleksi lain dari seri dan jenis yang sama.
        </p>
      </div>
      <RouterLink
        :to="categorySlug ? `/?kategori=${categorySlug}` : '/'"
        class="hidden sm:inline-flex items-center gap-1 text-xs font-extrabold text-ink/60 hover:text-ink"
      >
        Lihat semua <ChevronRight :size="13" />
      </RouterLink>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <ProductCard
        v-for="(item, index) in products"
        :key="item.id"
        :product="item"
        :index="index"
        @add="emit('add', $event)"
        @toggle-like="emit('toggleLike', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { productCategoryLabel, productSeries, visualForCategory } from '@/lib/productVisual'
import { rupiah } from '@/lib/format'
import type { CatalogProduct } from '@/types/catalog'

const props = defineProps<{
  product: CatalogProduct
}>()

const categoryVisual = computed(() => visualForCategory(props.product.category || null))
const soldOut = computed(() => Number(props.product.stock ?? 0) <= 0)
const lowStock = computed(() => !soldOut.value && Number(props.product.stock ?? 0) <= 5)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-1.5">
      <span
        v-if="product.anime"
        class="inline-flex items-center rounded-full border-2 border-ink bg-banner-sky px-2.5 py-0.5 text-[11px] font-extrabold"
      >
        {{ product.anime.name }}
      </span>
      <span :class="['inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-extrabold', categoryVisual.color]">
        {{ productCategoryLabel(product) }}
      </span>
      <span
        v-if="product.product_type"
        class="inline-flex items-center rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[11px] font-extrabold"
      >
        {{ product.product_type === 'handmade' ? 'Handmade' : 'Imported' }}
      </span>
      <span
        v-if="product.badge"
        class="inline-flex -rotate-2 items-center rounded-md border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-extrabold shadow-sm"
      >
        {{ product.badge }}
      </span>
    </div>

    <h1 class="mt-2.5 font-head text-2xl sm:text-3xl md:text-4xl font-bold leading-[1.1] text-ink">
      {{ product.name }}
    </h1>

    <p class="mt-1.5 text-sm font-bold text-ink/55">
      {{ productSeries(product) }}
      <template v-if="product.sku"> · SKU {{ product.sku }}</template>
    </p>

    <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="font-head text-3xl sm:text-4xl font-bold text-ink">{{ rupiah(product.price) }}</p>
        <p class="mt-0.5 text-xs font-semibold text-ink/55">
          {{ product.sold_count ? `Terjual ${product.sold_count} · ` : '' }}Harga sudah termasuk pajak
        </p>
      </div>
      <span
        :class="[
          'rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold',
          soldOut ? 'bg-destructive text-white' : lowStock ? 'bg-sun text-ink' : 'bg-mint text-ink',
        ]"
      >
        {{ soldOut ? 'Stok habis' : lowStock ? `Sisa ${product.stock}` : 'Stok tersedia' }}
      </span>
    </div>

    <p
      v-if="product.description"
      class="mt-4 text-sm sm:text-[15px] leading-relaxed font-semibold text-ink/75 whitespace-pre-line"
    >
      {{ product.description }}
    </p>
    <p v-else class="mt-4 text-sm leading-relaxed font-semibold text-ink/60">
      Koleksi {{ productCategoryLabel(product).toLowerCase() }} pilihan dari Mochibako.
      Dikemas rapi dan siap masuk rak koleksimu.
    </p>
  </div>
</template>

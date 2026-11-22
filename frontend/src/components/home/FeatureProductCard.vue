<script setup lang="ts">
import { Heart, Plus } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import ProductArt from '@/components/ProductArt.vue'
import { rupiah } from '@/lib/format'
import { productDetailLink } from '@/lib/productLinks'
import type { CatalogProduct } from '@/types/catalog'

const props = defineProps<{
  product: CatalogProduct
  liked: boolean
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
  toggleLike: [product: CatalogProduct]
}>()

const soldOut = () => Number(props.product.stock ?? 0) <= 0
</script>

<template>
  <article class="nb bg-white overflow-hidden flex flex-col">
    <div class="relative">
      <RouterLink
        :to="productDetailLink(product)"
        :aria-label="`Lihat detail ${product.name}`"
        class="group block aspect-[4/3] overflow-hidden border-b-[2.5px] border-ink"
      >
        <ProductArt
          :product="product"
          :icon-size="76"
          eager
          :image-width="720"
          image-sizes="(max-width: 1024px) 100vw, 420px"
          class="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </RouterLink>

      <span
        v-if="product.badge"
        class="pointer-events-none absolute left-3 top-3 -rotate-3 rounded-md border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-extrabold shadow-sm"
      >
        {{ product.badge }}
      </span>

      <button
        type="button"
        class="wish absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-white text-ink"
        :aria-pressed="liked"
        :aria-label="`Simpan ${product.name}`"
        @click="emit('toggleLike', product)"
      >
        <Heart :size="17" :stroke-width="2.4" />
      </button>
    </div>

    <div class="flex flex-1 flex-col p-4 sm:p-5">
      <p class="text-[11.5px] font-bold text-ink/55">
        {{ product.series || 'Mochibako Collection' }}
      </p>
      <RouterLink :to="productDetailLink(product)" class="mt-0.5">
        <h3 class="font-head text-lg sm:text-xl font-bold leading-snug hover:underline decoration-2 underline-offset-2">
          {{ product.name }}
        </h3>
      </RouterLink>
      <p class="mt-1 line-clamp-2 text-sm font-semibold text-ink/65">
        {{ product.spec || 'Koleksi original pilihan Mochibako' }}
      </p>

      <div class="mt-auto pt-4 flex items-end justify-between gap-3 border-t border-soft/70">
        <div>
          <span class="font-head text-xl sm:text-2xl font-bold tabular-nums">
            {{ rupiah(product.price) }}
          </span>
          <p class="mt-0.5 text-[11px] font-bold text-ink/50">
            <template v-if="product.sold_count">Terjual {{ product.sold_count }}</template>
            <template v-else>Stok {{ product.stock }}</template>
          </p>
        </div>
        <button
          type="button"
          class="btn bg-ink text-bg h-10 px-4 text-sm font-head font-semibold inline-flex items-center gap-1.5"
          :disabled="soldOut()"
          @click="emit('add', product)"
        >
          <Plus :size="16" :stroke-width="2.6" /> Ambil
        </button>
      </div>
    </div>
  </article>
</template>

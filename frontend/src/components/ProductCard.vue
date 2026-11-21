<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Package, Plus, Heart } from 'lucide-vue-next'
import type { CatalogProduct } from '@/types/catalog'
import ProductArt from './ProductArt.vue'
import { rupiah } from '@/lib/format'

const props = defineProps<{
  product: CatalogProduct
  index: number
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
  toggleLike: [product: CatalogProduct]
}>()

const isLiked = ref(props.product.isLiked ?? props.product.is_liked ?? false)
const soldOut = computed(() => Number(props.product.stock ?? 0) <= 0)
const detailLink = computed(() => (props.product.slug ? `/produk/${props.product.slug}` : '/'))

function handleLike() {
  isLiked.value = !isLiked.value
  emit('toggleLike', props.product)
}
</script>

<template>
  <article
    class="nb p-2 sm:p-2.5 flex flex-col rise group"
    :style="{ animationDelay: `${index * 35}ms` }"
  >
    <!-- Artwork container -->
    <div class="relative">
      <RouterLink
        :to="detailLink"
        :aria-label="`Lihat detail ${product.name}`"
        class="block border-2 border-ink rounded-lg sm:rounded-xl overflow-hidden transition-transform group-hover:scale-[1.02]"
      >
        <ProductArt
          :product="product"
          :icon-size="56"
          class="aspect-square w-full"
        />
      </RouterLink>

      <!-- Badge (Pre-order, Baru, Terbatas, etc) -->
      <span
        v-if="product.badge"
        class="pointer-events-none absolute top-1.5 left-1.5 sm:top-2 sm:left-2 -rotate-3 bg-white border-2 border-ink rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-extrabold shadow-sm"
      >
        {{ product.badge }}
      </span>

      <!-- Wishlist Heart Button -->
      <button
        type="button"
        class="wish absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border-2 border-ink grid place-items-center text-ink"
        :aria-pressed="isLiked"
        :aria-label="`Simpan ${product.name}`"
        @click.stop="handleLike"
      >
        <Heart :size="14" :stroke-width="2.4" class="sm:hidden" />
        <Heart :size="16" :stroke-width="2.4" class="hidden sm:block" />
      </button>
    </div>

    <!-- Details -->
    <p class="text-[11px] sm:text-xs font-bold text-ink/55 mt-2 sm:mt-3 truncate">
      {{ product.anime?.name || product.series || 'Mochibako Collection' }}
    </p>

    <RouterLink :to="detailLink" class="block mt-0.5">
      <h3 class="font-head font-semibold text-sm sm:text-[1.05rem] leading-snug line-clamp-2 text-ink min-h-[2.4em] sm:min-h-0 hover:underline decoration-2 underline-offset-2">
        {{ product.name }}
      </h3>
    </RouterLink>

    <p class="text-xs sm:text-sm text-ink/70 mt-0.5 line-clamp-1 font-semibold">
      {{ product.spec || product.description || 'Koleksi original' }}
    </p>

    <!-- Stock / sold info -->
    <p class="mt-1 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-ink/70">
      <Package :size="13" :stroke-width="2.2" class="shrink-0" />
      <span v-if="soldOut" class="text-destructive">Stok habis</span>
      <span v-else-if="product.sold_count">Terjual {{ product.sold_count }}</span>
      <span v-else>Stok {{ product.stock }}</span>
    </p>

    <!-- Price and Ambil CTA -->
    <div class="mt-auto pt-2.5 sm:pt-3 flex items-center justify-between gap-1.5 sm:gap-2 border-t border-soft/60">
      <span class="font-head font-bold text-sm sm:text-base md:text-lg text-ink truncate">
        {{ rupiah(product.price) }}
      </span>

      <button
        type="button"
        class="btn bg-ink text-bg h-8 sm:h-9 px-2 sm:px-3 font-head font-semibold text-xs sm:text-sm inline-flex items-center gap-1 shrink-0"
        :disabled="soldOut"
        :aria-label="soldOut ? `${product.name} habis` : `Ambil ${product.name}`"
        @click="emit('add', product)"
      >
        <Plus :size="14" :stroke-width="2.6" class="sm:hidden" />
        <Plus :size="16" :stroke-width="2.6" class="hidden sm:block" />
        <span>{{ soldOut ? 'Habis' : 'Ambil' }}</span>
      </button>
    </div>
  </article>
</template>

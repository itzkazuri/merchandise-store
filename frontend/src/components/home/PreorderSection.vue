<script setup lang="ts">
import { ref } from 'vue'
import { ChevronLeft, ChevronRight, Clock, Sparkles } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import ProductCard from '@/components/ProductCard.vue'
import type { CatalogProduct } from '@/types/catalog'

defineProps<{
  products: CatalogProduct[]
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
  toggleLike: [product: CatalogProduct]
}>()

const rail = ref<HTMLElement | null>(null)

function scrollRail(direction: number) {
  if (!rail.value) return
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  rail.value.scrollBy({
    left: direction * Math.max(260, rail.value.clientWidth * 0.82),
    behavior: reduced ? 'auto' : 'smooth',
  })
}
</script>

<template>
  <section
    aria-labelledby="preorder-title"
    class="mt-12 sm:mt-20 border-y-[2.5px] border-ink bg-lilac"
  >
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-9 sm:py-14">
      <div class="grid gap-7 lg:grid-cols-[minmax(0,.78fr)_minmax(0,1.8fr)] lg:items-start">
        <div>
          <h2 id="preorder-title" class="font-head text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
            Pre-order batch terbatas
          </h2>
          <p class="mt-2 max-w-md text-sm sm:text-base font-semibold leading-relaxed text-ink/70">
            Amankan slot sebelum batch ditutup. Produk pre-order dikirim setelah stok mendarat,
            dan sisa slot selalu diperbarui di halaman ini.
          </p>

          <ul class="mt-4 space-y-2 text-sm font-bold text-ink/75">
            <li class="flex items-start gap-2">
              <Clock :size="16" class="mt-0.5 shrink-0" />
              Slot dibuka selama kuota batch masih tersedia.
            </li>
            <li class="flex items-start gap-2">
              <Sparkles :size="16" class="mt-0.5 shrink-0" />
              Prioritas kirim untuk pemesan paling awal.
            </li>
          </ul>

          <div class="mt-5 flex flex-wrap items-center gap-2">
            <RouterLink to="/#rak" class="btn bg-ink text-bg h-10 px-4 text-sm font-head font-semibold">
              Jelajahi katalog
            </RouterLink>
            <button
              type="button"
              class="hidden sm:inline-flex btn bg-white text-ink h-10 w-10 p-0"
              aria-label="Geser pre-order ke kiri"
              @click="scrollRail(-1)"
            >
              <ChevronLeft :size="17" />
            </button>
            <button
              type="button"
              class="hidden sm:inline-flex btn bg-white text-ink h-10 w-10 p-0"
              aria-label="Geser pre-order ke kanan"
              @click="scrollRail(1)"
            >
              <ChevronRight :size="17" />
            </button>
          </div>
        </div>

        <div
          ref="rail"
          class="flex snap-x snap-mandatory gap-3 sm:gap-4 overflow-x-auto pb-3 -mx-3.5 px-3.5 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0"
        >
          <div
            v-for="(item, idx) in products"
            :key="item.id"
            class="w-[72%] xs:w-[56%] sm:w-[42%] lg:w-[44%] xl:w-[30%] shrink-0 snap-start"
          >
            <ProductCard
              :product="item"
              :index="idx"
              @add="emit('add', $event)"
              @toggle-like="emit('toggleLike', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ArrowRight, Plus } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import ProductArt from '@/components/ProductArt.vue'
import { rupiah } from '@/lib/format'
import { productDetailLink } from '@/lib/productLinks'
import type { CatalogProduct } from '@/types/catalog'

defineProps<{
  anchor: CatalogProduct
  products: CatalogProduct[]
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
}>()
</script>

<template>
  <section aria-labelledby="mirip-title" class="max-w-6xl mx-auto px-3.5 sm:px-5 mt-10 sm:mt-16">
    <div class="nb overflow-hidden bg-white">
      <div class="grid lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.55fr)]">
        <div class="bg-sky/55 p-5 sm:p-6 border-b-[2.5px] lg:border-b-0 lg:border-r-[2.5px] border-ink">
          <h2 id="mirip-title" class="font-head text-2xl sm:text-3xl font-bold leading-tight">
            Mirip-mirip ini
          </h2>
          <p class="mt-1.5 text-sm font-semibold leading-relaxed text-ink/70">
            Karena kamu melihat <span class="font-extrabold text-ink">{{ anchor.name }}</span>,
            ini yang paling dekat dengannya.
          </p>

          <RouterLink
            :to="productDetailLink(anchor)"
            class="mt-4 flex items-center gap-3 rounded-xl border-2 border-ink bg-white p-2.5 transition-transform hover:-translate-y-0.5"
          >
            <span class="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-ink">
              <ProductArt :product="anchor" :icon-size="26" class="h-full w-full" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[11px] font-bold text-ink/55">
                {{ anchor.series || 'Mochibako Collection' }}
              </span>
              <span class="block truncate font-head text-sm font-bold">{{ anchor.name }}</span>
              <span class="block text-xs font-extrabold tabular-nums">{{ rupiah(anchor.price) }}</span>
            </span>
            <ArrowRight :size="16" class="shrink-0 text-ink/45" />
          </RouterLink>
        </div>

        <ul class="divide-y-2 divide-ink/10">
          <li v-for="item in products" :key="item.id">
            <div class="flex items-center gap-3 p-3.5 sm:p-4">
              <RouterLink
                :to="productDetailLink(item)"
                :aria-label="`Lihat detail ${item.name}`"
                class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-ink"
              >
                <ProductArt :product="item" :icon-size="28" class="h-full w-full" />
              </RouterLink>

              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-bold text-ink/50">
                  {{ item.series || 'Mochibako Collection' }}
                </p>
                <RouterLink :to="productDetailLink(item)" class="mt-0.5 block">
                  <h3 class="truncate font-head text-sm sm:text-base font-bold hover:underline decoration-2 underline-offset-2">
                    {{ item.name }}
                  </h3>
                </RouterLink>
                <p class="mt-0.5 truncate text-[11.5px] font-semibold text-ink/55">
                  {{ item.spec || 'Koleksi original' }}
                </p>
                <p class="mt-1 text-xs font-extrabold tabular-nums sm:hidden">
                  {{ rupiah(item.price) }}
                </p>
              </div>

              <span class="hidden sm:block font-head text-sm md:text-base font-bold tabular-nums">
                {{ rupiah(item.price) }}
              </span>

              <button
                type="button"
                class="btn bg-sun text-ink h-9 w-9 shrink-0 p-0"
                :disabled="Number(item.stock ?? 0) <= 0"
                :aria-label="`Ambil ${item.name}`"
                @click="emit('add', item)"
              >
                <Plus :size="16" :stroke-width="2.6" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Plus, TrendingUp } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import ProductArt from '@/components/ProductArt.vue'
import HomeSectionHeading from './HomeSectionHeading.vue'
import { rupiah } from '@/lib/format'
import { productDetailLink } from '@/lib/productLinks'
import type { CatalogProduct } from '@/types/catalog'

defineProps<{
  products: CatalogProduct[]
}>()

const emit = defineEmits<{
  add: [product: CatalogProduct]
}>()
</script>

<template>
  <section
    aria-labelledby="hotsale-title"
    class="mt-12 sm:mt-20 border-y-[2.5px] border-ink bg-ink text-bg"
  >
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-9 sm:py-14">
      <HomeSectionHeading
        title-id="hotsale-title"
        title="Hot sale minggu ini"
        description="Paling sering diburu pembeli Mochibako. Kalau masuk daftar ini, biasanya cepat habis."
        action-label="Lihat semua produk"
        action-to="/#rak"
        inverse
      />

      <ol class="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
        <li
          v-for="(item, index) in products"
          :key="item.id"
          class="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-white p-3 text-ink shadow-[4px_4px_0_#F6F3EC]"
        >
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun font-head text-sm font-bold">
            {{ index + 1 }}
          </span>

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
            <p class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-bold text-ink/55">
              <span class="font-head text-sm font-bold text-ink">{{ rupiah(item.price) }}</span>
              <span class="text-ink/25">·</span>
              <span class="inline-flex items-center gap-1">
                <TrendingUp :size="12" />
                <template v-if="item.sold_count">Terjual {{ item.sold_count }}</template>
                <template v-else>Stok {{ item.stock }}</template>
              </span>
            </p>
          </div>

          <button
            type="button"
            class="btn bg-sun text-ink h-9 w-9 shrink-0 p-0"
            :disabled="Number(item.stock ?? 0) <= 0"
            :aria-label="`Ambil ${item.name}`"
            @click="emit('add', item)"
          >
            <Plus :size="16" :stroke-width="2.6" />
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PackageCheck, Store, Truck } from 'lucide-vue-next'
import ProductArt from '@/components/ProductArt.vue'
import type { CatalogProduct } from '@/types/catalog'

const props = defineProps<{
  product: CatalogProduct
}>()

const soldOut = computed(() => Number(props.product.stock ?? 0) <= 0)
</script>

<template>
  <div class="lg:sticky lg:top-24">
    <div class="nb p-2.5 sm:p-3 rotate-[-0.6deg]">
      <ProductArt
        :product="product"
        :icon-size="132"
        :image-width="960"
        image-sizes="(max-width: 1024px) 92vw, 560px"
        eager
        class="aspect-square w-full rounded-xl border-2 border-ink"
      />
    </div>

    <div class="mt-4 grid grid-cols-3 gap-2">
      <div class="nb p-2.5 sm:p-3 text-center">
        <PackageCheck :size="18" class="mx-auto mb-1 text-ink" />
        <p class="text-[11px] font-extrabold leading-tight">
          {{ soldOut ? 'Stok habis' : `Stok ${product.stock}` }}
        </p>
      </div>
      <div class="nb p-2.5 sm:p-3 text-center">
        <Store :size="18" class="mx-auto mb-1 text-ink" />
        <p class="text-[11px] font-extrabold leading-tight">Ambil di toko</p>
      </div>
      <div class="nb p-2.5 sm:p-3 text-center">
        <Truck :size="18" class="mx-auto mb-1 text-ink" />
        <p class="text-[11px] font-extrabold leading-tight">Bisa dikirim</p>
      </div>
    </div>
  </div>
</template>

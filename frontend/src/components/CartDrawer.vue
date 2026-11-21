<script setup lang="ts">
import { Plus, Minus, X, ShoppingBag, Sparkles } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useCart, FREE_SHIPPING_THRESHOLD } from '@/composables/useCart'
import ProductArt from './ProductArt.vue'

const router = useRouter()
const {
  cartOpen,
  cartLines,
  cartTotal,
  isFreeShipping,
  remainingForFreeShipping,
  increment,
  decrement,
  closeCart,
} = useCart()

function goCheckout() {
  closeCart()
  router.push('/keranjang')
}

function formatRupiah(num: number | string) {
  return 'Rp' + Number(num).toLocaleString('id-ID')
}
</script>

<template>
  <div v-if="cartOpen">
    <!-- Backdrop to close on click outside -->
    <div
      class="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[2px]"
      aria-hidden="true"
      @click="closeCart"
    ></div>

    <!-- Aside Cart Drawer (Responsive on mobile & tablet) -->
    <aside
      id="cart"
      class="nb fixed top-14 sm:top-[4.5rem] right-3 left-3 sm:left-auto sm:right-4 sm:w-88 z-40 p-3.5 sm:p-4 max-h-[82vh] flex flex-col shadow-[5px_5px_0_#1B2430] sm:shadow-[6px_6px_0_#1B2430] rise"
      role="dialog"
      aria-modal="true"
      aria-label="Keranjang Belanja"
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-2 border-b border-soft">
        <div class="flex items-center gap-2">
          <ShoppingBag :size="19" class="text-ink" />
          <h3 class="font-head font-bold text-lg sm:text-xl text-ink">Keranjang</h3>
        </div>
        <button
          type="button"
          class="w-7 h-7 rounded-full border-2 border-ink bg-white grid place-items-center text-ink cursor-pointer hover:bg-soft transition-colors"
          aria-label="Tutup keranjang"
          @click="closeCart"
        >
          <X :size="15" :stroke-width="2.6" />
        </button>
      </div>

      <!-- Shipping notice -->
      <p id="ship" class="text-xs font-semibold text-ink/75 my-2.5 px-2 py-1.5 rounded-lg bg-soft/50 flex items-center gap-1.5">
        <Sparkles v-if="isFreeShipping" :size="14" class="text-sun shrink-0" />
        <span class="leading-snug">
          <template v-if="!cartLines.length">
            Gratis ongkir mulai {{ formatRupiah(FREE_SHIPPING_THRESHOLD) }}
          </template>
          <template v-else-if="isFreeShipping">
            🎉 Ongkirmu gratis!
          </template>
          <template v-else>
            Tambah {{ formatRupiah(remainingForFreeShipping) }} lagi untuk gratis ongkir.
          </template>
        </span>
      </p>

      <!-- Cart Item List -->
      <div class="overflow-y-auto flex-1 pr-1 space-y-2 py-1">
        <template v-if="cartLines.length">
          <div
            v-for="line in cartLines"
            :key="line.product.id"
            class="flex items-center gap-2 border-2 border-soft rounded-xl p-2 bg-white"
          >
            <!-- Product mini visual -->
            <ProductArt
              :product="line.product"
              :icon-size="18"
              class="w-9 h-9 sm:w-10 sm:h-10 border-2 border-ink rounded-lg shrink-0"
            />

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-head font-semibold truncate leading-tight text-ink text-xs sm:text-sm">
                {{ line.product.name }}
              </p>
              <p class="text-[11px] sm:text-xs font-bold text-ink/65">
                {{ formatRupiah(line.product.price) }}
              </p>
            </div>

            <!-- Controls -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                class="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-ink bg-white grid place-items-center cursor-pointer active:scale-95 transition-transform"
                aria-label="Kurangi"
                @click="decrement(line.product.id)"
              >
                <Minus :size="12" :stroke-width="2.6" class="sm:hidden" />
                <Minus :size="14" :stroke-width="2.6" class="hidden sm:block" />
              </button>
              <span class="font-head font-semibold w-4 text-center text-xs sm:text-sm text-ink">
                {{ line.quantity }}
              </span>
              <button
                type="button"
                class="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-ink bg-sun grid place-items-center cursor-pointer active:scale-95 transition-transform"
                aria-label="Tambah"
                @click="increment(line.product.id)"
              >
                <Plus :size="12" :stroke-width="2.6" class="sm:hidden" />
                <Plus :size="14" :stroke-width="2.6" class="hidden sm:block" />
              </button>
            </div>
          </div>
        </template>

        <div v-else class="text-center font-semibold text-ink/55 py-6 sm:py-8 flex flex-col items-center gap-2">
          <ShoppingBag :size="28" class="text-ink/35 sm:hidden" />
          <ShoppingBag :size="32" class="text-ink/35 hidden sm:block" />
          <p class="text-sm">Keranjang masih kosong.</p>
        </div>
      </div>

      <!-- Footer / Total / Checkout -->
      <div class="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t-2 border-dashed border-soft">
        <div class="flex items-center justify-between font-head font-semibold text-base sm:text-lg text-ink">
          <span>Total</span>
          <span id="cartTotal">{{ formatRupiah(cartTotal) }}</span>
        </div>
        <button
          id="checkout"
          type="button"
          class="btn bg-ink text-bg w-full mt-2.5 sm:mt-3 py-2 sm:py-2.5 font-head font-semibold text-sm sm:text-base transition-transform"
          :disabled="!cartLines.length"
          @click="goCheckout"
        >
          Lihat keranjang
        </button>
      </div>
    </aside>
  </div>
</template>

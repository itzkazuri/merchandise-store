<script setup lang="ts">
import { Heart, Minus, Plus, ShieldCheck, ShoppingBag, Store, Truck, Wallet } from 'lucide-vue-next'
import { rupiah } from '@/lib/format'

const props = defineProps<{
  qty: number
  maxStock: number
  subtotal: number
  soldOut: boolean
  liked: boolean
}>()

const emit = defineEmits<{
  'update:qty': [value: number]
  add: []
  buy: []
  toggleLike: []
}>()

function changeQty(next: number) {
  emit('update:qty', Math.min(props.maxStock, Math.max(1, next)))
}
</script>

<template>
  <div class="nb mt-5 p-3.5 sm:p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-bold text-ink/60">Jumlah</p>
        <div class="mt-1.5 inline-flex items-center gap-2">
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-white disabled:opacity-40"
            :disabled="qty <= 1 || soldOut"
            aria-label="Kurangi jumlah"
            @click="changeQty(qty - 1)"
          >
            <Minus :size="14" :stroke-width="2.6" />
          </button>
          <span class="w-9 text-center font-head text-lg font-bold" aria-live="polite">{{ qty }}</span>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-sun disabled:opacity-40"
            :disabled="qty >= maxStock || soldOut"
            aria-label="Tambah jumlah"
            @click="changeQty(qty + 1)"
          >
            <Plus :size="14" :stroke-width="2.6" />
          </button>
        </div>
      </div>
      <div class="text-right">
        <p class="text-xs font-bold text-ink/60">Subtotal</p>
        <p class="font-head text-lg sm:text-xl font-bold tabular-nums">{{ rupiah(subtotal) }}</p>
      </div>
    </div>

    <div class="mt-3.5 grid gap-2 sm:grid-cols-[1fr_auto]">
      <button
        type="button"
        class="btn bg-ink text-bg h-11 px-4 font-head font-semibold text-sm sm:text-base disabled:opacity-50"
        :disabled="soldOut"
        @click="emit('add')"
      >
        <ShoppingBag :size="17" class="mr-1.5" />
        {{ soldOut ? 'Stok habis' : 'Tambah ke keranjang' }}
      </button>
      <button
        type="button"
        class="btn bg-sun text-ink h-11 px-4 font-head font-semibold text-sm sm:text-base disabled:opacity-50"
        :disabled="soldOut"
        @click="emit('buy')"
      >
        Beli sekarang
      </button>
    </div>

    <div class="mt-2.5 flex items-center justify-between gap-3">
      <p class="text-[11px] font-semibold text-ink/55">
        <ShieldCheck :size="13" class="inline -mt-0.5 mr-1" />
        Stok dan harga dicek ulang saat checkout.
      </p>
      <button
        type="button"
        class="wish inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-ink/70 hover:text-ink"
        :aria-pressed="liked"
        @click="emit('toggleLike')"
      >
        <Heart :size="15" :stroke-width="2.4" /> {{ liked ? 'Tersimpan' : 'Simpan' }}
      </button>
    </div>

    <div class="mt-4 grid gap-2 sm:grid-cols-3">
      <div class="rounded-xl border-2 border-ink/15 bg-white/70 p-2.5">
        <Store :size="16" class="mb-1 text-ink" />
        <p class="text-[11px] font-extrabold leading-tight">Ambil di toko</p>
        <p class="mt-0.5 text-[10.5px] font-semibold text-ink/55">Gratis, siap diambil setelah dikonfirmasi.</p>
      </div>
      <div class="rounded-xl border-2 border-ink/15 bg-white/70 p-2.5">
        <Truck :size="16" class="mb-1 text-ink" />
        <p class="text-[11px] font-extrabold leading-tight">Dikirim kurir</p>
        <p class="mt-0.5 text-[10.5px] font-semibold text-ink/55">Ongkir dikonfirmasi admin saat proses.</p>
      </div>
      <div class="rounded-xl border-2 border-ink/15 bg-white/70 p-2.5">
        <Wallet :size="16" class="mb-1 text-ink" />
        <p class="text-[11px] font-extrabold leading-tight">Midtrans</p>
        <p class="mt-0.5 text-[10.5px] font-semibold text-ink/55">QRIS, VA, e-wallet, atau tunai di toko.</p>
      </div>
    </div>
  </div>
</template>

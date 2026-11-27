<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowRight,
  Minus,
  PackageSearch,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import ProductArt from '@/components/ProductArt.vue'
import { useCart, FREE_SHIPPING_THRESHOLD } from '@/composables/useCart'
import { useAuth } from '@/composables/useAuth'
import { openAuthDialog } from '@/composables/useAuthDialog'
import { useSeo } from '@/composables/useSeo'
import { useApiReconnect } from '@/composables/useApiReconnect'
import { useConnectivity } from '@/lib/connectivity'
import { catalogApi } from '@/api/catalog'
import { isNetworkError } from '@/api/errors'
import { rememberProducts } from '@/lib/catalogCache'
import { rupiah } from '@/lib/format'
import { productSeries } from '@/lib/productVisual'
import type { CatalogProduct } from '@/types/catalog'

useSeo({
  title: 'Keranjang Belanja',
  description: 'Periksa produk pilihanmu sebelum checkout di Mochibako.',
})

const router = useRouter()
const { isAuthenticated } = useAuth()
const { apiOnline } = useConnectivity()
const {
  cartLines,
  cartCount,
  cartTotal,
  increment,
  decrement,
  removeItem,
  setProduct,
  isFreeShipping,
  remainingForFreeShipping,
} = useCart()

const refreshing = ref(true)
const unavailable = ref<Record<number, boolean>>({})
const notice = ref('')

const hasUnavailable = computed(
  () => cartLines.value.some((line) => unavailable.value[line.product.id] || Number(line.product.stock ?? 0) <= 0),
)

const freeShippingProgress = computed(() =>
  Math.min(100, Math.round((cartTotal.value / FREE_SHIPPING_THRESHOLD) * 100)),
)

function detailLink(product: CatalogProduct) {
  return product.slug ? `/produk/${product.slug}` : '/'
}

function markUnavailable(productId: number) {
  unavailable.value = { ...unavailable.value, [productId]: true }
}

function clearUnavailable(productId: number) {
  const next = { ...unavailable.value }
  delete next[productId]
  unavailable.value = next
}

function remove(line: { product: CatalogProduct }) {
  removeItem(line.product.id)
  clearUnavailable(line.product.id)
}

async function refreshStock() {
  refreshing.value = true
  const lines = [...cartLines.value]
  const results = await Promise.allSettled(
    lines.map(async (line) => {
      if (!line.product.slug) return
      const fresh = await catalogApi.product(line.product.slug)
      rememberProducts([fresh])
      setProduct(fresh)
      if (Number(fresh.stock ?? 0) <= 0) markUnavailable(line.product.id)
      else clearUnavailable(line.product.id)
    }),
  )

  let offlineFailures = 0
  results.forEach((result, index) => {
    if (result.status !== 'rejected') return
    if (isNetworkError(result.reason)) {
      offlineFailures += 1
      return
    }
    const line = lines[index]
    if (line) markUnavailable(line.product.id)
  })

  if (offlineFailures) {
    notice.value =
      'Server tidak bisa dihubungi. Keranjang tetap tersimpan di perangkat ini; stok akan dicek ulang saat koneksi pulih.'
  }
  refreshing.value = false
}

onMounted(refreshStock)

useApiReconnect(() => {
  void refreshStock()
})

function goCheckout() {
  notice.value = ''
  if (!cartLines.value.length) {
    notice.value = 'Keranjang masih kosong.'
    return
  }
  if (!apiOnline.value) {
    notice.value = 'Checkout membutuhkan koneksi ke server. Sambungkan internet lalu coba lagi.'
    return
  }
  if (hasUnavailable.value) {
    notice.value = 'Hapus produk yang stoknya habis atau tidak tersedia sebelum checkout.'
    return
  }
  if (!isAuthenticated.value) {
    openAuthDialog('/checkout')
    return
  }
  router.push('/checkout')
}
</script>

<template>
  <StoreShell>
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">
      <!-- Heading -->
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">Belanja</p>
          <h1 class="font-head text-2xl sm:text-3xl font-bold text-ink">Keranjang Belanja</h1>
          <p class="mt-1 text-xs sm:text-sm font-semibold text-ink/60">
            {{ cartCount }} item · dicek ulang dengan stok terbaru saat checkout.
            <span v-if="refreshing" class="text-ink/45">Menyegarkan…</span>
          </p>
        </div>
        <RouterLink to="/" class="text-xs sm:text-sm font-extrabold text-ink/60 hover:text-ink">
          ← Lanjut belanja
        </RouterLink>
      </div>

      <!-- Empty -->
      <div v-if="!cartLines.length" class="nb mt-6 p-7 sm:p-12 text-center max-w-xl mx-auto">
        <span class="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-2 border-ink bg-sun shadow-[3px_3px_0_#1B2430]">
          <ShoppingBag :size="28" :stroke-width="2.2" />
        </span>
        <h2 class="mt-4 font-head text-xl sm:text-2xl font-bold text-ink">Keranjangmu masih kosong</h2>
        <p class="mt-1.5 text-sm font-semibold text-ink/60">
          Pilih figure, plushie, atau merchandise anime favoritmu dulu, lalu kembali ke sini.
        </p>
        <RouterLink to="/" class="btn bg-ink text-bg mt-5 h-10 px-5 font-head font-semibold text-sm inline-flex">
          Mulai belanja
        </RouterLink>
      </div>

      <div v-else class="mt-5 grid gap-5 lg:grid-cols-[1.4fr_.6fr] items-start">
        <!-- Lines -->
        <section class="space-y-3" aria-label="Produk di keranjang">
          <article
            v-for="line in cartLines"
            :key="line.product.id"
            class="nb p-2.5 sm:p-3.5 flex gap-3"
            :class="{ 'opacity-75': unavailable[line.product.id] }"
          >
            <RouterLink :to="detailLink(line.product)" class="shrink-0">
              <ProductArt
                :product="line.product"
                :icon-size="34"
                :image-width="256"
                image-sizes="96px"
                class="w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-ink"
              />
            </RouterLink>

            <div class="flex-1 min-w-0">
              <p class="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wide text-ink/45 truncate">
                {{ line.product.anime?.name || productSeries(line.product) }}
              </p>
              <RouterLink :to="detailLink(line.product)" class="block">
                <h2 class="font-head text-sm sm:text-base font-bold leading-snug text-ink line-clamp-2 hover:underline">
                  {{ line.product.name }}
                </h2>
              </RouterLink>
              <p class="mt-0.5 text-[11px] sm:text-xs font-bold text-ink/60">
                {{ rupiah(line.product.price) }} / item
                <span v-if="line.product.sku" class="font-semibold text-ink/40">· {{ line.product.sku }}</span>
              </p>

              <p
                v-if="unavailable[line.product.id]"
                class="mt-1.5 inline-flex rounded-md bg-destructive/10 px-2 py-0.5 text-[10.5px] font-extrabold text-destructive"
              >
                Tidak tersedia — hapus untuk lanjut
              </p>
              <p
                v-else-if="Number(line.product.stock ?? 0) <= 0"
                class="mt-1.5 inline-flex rounded-md bg-destructive/10 px-2 py-0.5 text-[10.5px] font-extrabold text-destructive"
              >
                Stok habis
              </p>
              <p
                v-else-if="line.quantity >= Number(line.product.stock ?? 0)"
                class="mt-1.5 inline-flex rounded-md bg-sun/40 px-2 py-0.5 text-[10.5px] font-extrabold text-ink"
              >
                Maksimal stok ({{ line.product.stock }})
              </p>

              <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div class="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    class="w-7 h-7 rounded-full border-2 border-ink bg-white grid place-items-center disabled:opacity-40"
                    :disabled="line.quantity <= 1"
                    :aria-label="`Kurangi ${line.product.name}`"
                    @click="decrement(line.product.id)"
                  >
                    <Minus :size="12" :stroke-width="2.6" />
                  </button>
                  <span class="w-7 text-center font-head text-sm font-bold">{{ line.quantity }}</span>
                  <button
                    type="button"
                    class="w-7 h-7 rounded-full border-2 border-ink bg-sun grid place-items-center disabled:opacity-40"
                    :disabled="line.quantity >= Number(line.product.stock ?? 0)"
                    :aria-label="`Tambah ${line.product.name}`"
                    @click="increment(line.product.id)"
                  >
                    <Plus :size="12" :stroke-width="2.6" />
                  </button>
                </div>

                <div class="flex items-center gap-2.5">
                  <strong class="font-head text-sm sm:text-base font-bold tabular-nums">
                    {{ rupiah(Number(line.product.price) * line.quantity) }}
                  </strong>
                  <button
                    type="button"
                    class="w-8 h-8 rounded-full border-2 border-ink/20 bg-white grid place-items-center text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                    :aria-label="`Hapus ${line.product.name}`"
                    @click="remove(line)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </article>

          <div v-if="notice" class="rounded-xl border-2 border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs font-bold text-destructive" role="alert">
            {{ notice }}
          </div>
        </section>

        <!-- Summary -->
        <aside class="nb p-4 sm:p-5 lg:sticky lg:top-24" aria-label="Ringkasan keranjang">
          <h2 class="font-head text-lg font-bold text-ink">Ringkasan</h2>

          <div class="mt-3 rounded-xl border-2 border-ink/10 bg-bg/60 p-2.5">
            <div class="flex items-center gap-2 text-[11px] font-extrabold">
              <Sparkles v-if="isFreeShipping" :size="14" class="text-sun shrink-0" />
              <Truck v-else :size="14" class="text-ink/60 shrink-0" />
              <span v-if="isFreeShipping">Ongkir gratis untuk pesanan ini 🎉</span>
              <span v-else>Tambah {{ rupiah(remainingForFreeShipping) }} lagi untuk gratis ongkir.</span>
            </div>
            <div class="mt-2 h-2 rounded-full border-2 border-ink/15 bg-white overflow-hidden">
              <div class="h-full bg-sun transition-all" :style="{ width: `${freeShippingProgress}%` }"></div>
            </div>
          </div>

          <dl class="mt-3.5 space-y-1.5 text-sm">
            <div class="flex justify-between gap-3 font-semibold text-ink/70">
              <dt>Subtotal ({{ cartCount }} item)</dt>
              <dd class="tabular-nums font-bold text-ink">{{ rupiah(cartTotal) }}</dd>
            </div>
            <div class="flex justify-between gap-3 font-semibold text-ink/70">
              <dt>Ongkir</dt>
              <dd class="text-[11px] font-bold text-ink/50 self-center">Dihitung saat checkout</dd>
            </div>
            <div class="flex justify-between gap-3 border-t-2 border-dashed border-soft pt-2 mt-1">
              <dt class="font-head text-base font-bold">Total</dt>
              <dd class="font-head text-lg font-bold tabular-nums">{{ rupiah(cartTotal) }}</dd>
            </div>
          </dl>

          <button
            type="button"
            class="btn bg-ink text-bg w-full mt-4 h-11 font-head font-semibold text-sm sm:text-base"
            :disabled="hasUnavailable"
            @click="goCheckout"
          >
            {{ isAuthenticated ? 'Lanjut ke checkout' : 'Masuk & checkout' }}
            <ArrowRight :size="16" class="ml-1.5" />
          </button>

          <p class="mt-2.5 flex items-start gap-1.5 text-[10.5px] font-semibold text-ink/50 leading-snug">
            <ShieldCheck :size="13" class="mt-0.5 shrink-0" />
            Harga dan stok final dicek ulang oleh server sebelum pesanan dibuat.
          </p>

          <div class="mt-3 grid gap-1.5 text-[10.5px] font-semibold text-ink/55">
            <p class="flex items-center gap-1.5"><PackageSearch :size="13" /> Bisa ambil di toko atau dikirim kurir.</p>
            <p class="flex items-center gap-1.5"><Sparkles :size="13" /> Pembayaran online lewat Midtrans Snap.</p>
          </div>
        </aside>
      </div>
    </div>
  </StoreShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import ProductArt from '@/components/ProductArt.vue'
import { useCart } from '@/composables/useCart'
import { useAuth } from '@/composables/useAuth'
import { useSeo } from '@/composables/useSeo'
import { ordersApi, paymentsApi, syncCartToServer } from '@/api/store'
import { payWithSnap, preloadSnap } from '@/api/midtrans'
import { ApiError } from '@/api/client'
import { rupiah } from '@/lib/format'
import type { CheckoutBody, Order } from '@/types/order'
import type { DeliveryMethod, PaymentMethod } from '@/types/order'

useSeo({
  title: 'Checkout',
  description: 'Lengkapi data penerima dan pilih pembayaran Midtrans atau tunai di toko.',
})

const router = useRouter()
const { user } = useAuth()
const { cartLines, cartCount, cartTotal, clearCart } = useCart()

const recipientName = ref('')
const recipientPhone = ref('')
const deliveryMethod = ref<DeliveryMethod>('store')
const paymentMethod = ref<PaymentMethod>('midtrans')
const shippingAddress = ref('')
const deliveryNote = ref('')

const errors = ref<Record<string, string>>({})
const submitError = ref('')
const step = ref<'idle' | 'syncing' | 'creating' | 'paying'>('idle')
const submitting = computed(() => step.value !== 'idle')

const noteLabel = computed(() => {
  if (deliveryMethod.value === 'custom') return 'Detail event / booth'
  if (deliveryMethod.value === 'courier') return 'Catatan untuk kurir (opsional)'
  return 'Catatan tambahan (opsional)'
})
const notePlaceholder = computed(() => {
  if (deliveryMethod.value === 'custom') return 'Contoh: Ambil di booth Anime Expo hall B no. 12, Sabtu 10.00'
  if (deliveryMethod.value === 'courier') return 'Contoh: Titip ke satpam bila tidak ada orang'
  return 'Contoh: Ambil di toko hari Sabtu siang'
})
const stepLabel = computed(() => {
  if (step.value === 'syncing') return 'Menyegarkan keranjang…'
  if (step.value === 'creating') return 'Membuat pesanan…'
  if (step.value === 'paying') return 'Membuka pembayaran…'
  return paymentMethod.value === 'cash' ? 'Buat pesanan (bayar di toko)' : 'Bayar dengan Midtrans'
})

watch(deliveryMethod, (method) => {
  if (method === 'courier' && paymentMethod.value === 'cash') paymentMethod.value = 'midtrans'
})

watch(paymentMethod, () => {
  submitError.value = ''
})

onMounted(() => {
  preloadSnap()
  if (!cartLines.value.length) {
    router.replace('/keranjang')
    return
  }
  if (user.value?.name) recipientName.value = user.value.name
})

function validate() {
  const next: Record<string, string> = {}
  if (recipientName.value.trim().length < 2) next.name = 'Nama penerima minimal 2 karakter.'
  if (recipientPhone.value.trim().length < 6) next.phone = 'Nomor telepon minimal 6 karakter.'
  if (deliveryMethod.value === 'courier' && shippingAddress.value.trim().length < 5) {
    next.address = 'Alamat pengiriman wajib diisi untuk kirim kurir.'
  }
  if (deliveryMethod.value === 'custom' && deliveryNote.value.trim().length < 3) {
    next.note = 'Isi detail event atau lokasi pengambilan.'
  }
  errors.value = next
  return !Object.keys(next).length
}

function errorMessage(cause: unknown) {
  if (cause instanceof ApiError) return cause.message
  if (cause instanceof Error) return cause.message
  return 'Checkout gagal. Coba lagi sebentar.'
}

async function submit() {
  submitError.value = ''
  if (!validate()) return
  if (!cartLines.value.length) {
    router.replace('/keranjang')
    return
  }

  const body: CheckoutBody = {
    delivery_method: deliveryMethod.value,
    payment_method: paymentMethod.value,
    recipient_name: recipientName.value.trim(),
    recipient_phone: recipientPhone.value.trim(),
    shipping_address: deliveryMethod.value === 'courier' ? shippingAddress.value.trim() : null,
    delivery_note: deliveryNote.value.trim() || null,
  }

  let order: Order
  step.value = 'syncing'
  try {
    await syncCartToServer(
      cartLines.value.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
    )
    step.value = 'creating'
    order = await ordersApi.checkout(body)
    clearCart()
  } catch (cause) {
    submitError.value = errorMessage(cause)
    step.value = 'idle'
    return
  }

  if (paymentMethod.value === 'cash') {
    router.replace({ name: 'order-detail', params: { orderNumber: order.order_number }, query: { baru: '1' } })
    return
  }

  step.value = 'paying'
  try {
    const payment = await paymentsApi.createMidtrans(order.id)
    await payWithSnap(payment, {
      onSuccess: () => router.replace({ name: 'order-detail', params: { orderNumber: order.order_number }, query: { bayar: 'verifikasi' } }),
      onPending: () => router.replace({ name: 'order-detail', params: { orderNumber: order.order_number }, query: { bayar: 'pending' } }),
      onError: () => router.replace({ name: 'order-detail', params: { orderNumber: order.order_number }, query: { bayar: 'gagal' } }),
      onClose: () => router.replace({ name: 'order-detail', params: { orderNumber: order.order_number }, query: { bayar: 'belum' } }),
    })
  } catch {
    router.replace({ name: 'order-detail', params: { orderNumber: order.order_number }, query: { bayar: 'manual' } })
  } finally {
    step.value = 'idle'
  }
}
</script>

<template>
  <StoreShell>
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">Langkah terakhir</p>
          <h1 class="font-head text-2xl sm:text-3xl font-bold text-ink">Checkout</h1>
          <p class="mt-1 text-xs sm:text-sm font-semibold text-ink/60">
            {{ cartCount }} item · isi data penerima, lalu pilih cara bayar.
          </p>
        </div>
        <RouterLink to="/keranjang" class="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-ink/60 hover:text-ink">
          <ArrowLeft :size="14" /> Kembali ke keranjang
        </RouterLink>
      </div>

      <form class="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.65fr] items-start" @submit.prevent="submit">
        <div class="space-y-4">
          <!-- 1. Contact -->
          <section class="nb p-4 sm:p-5">
            <div class="flex items-center gap-2">
              <span class="grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-sun font-head text-xs font-bold">1</span>
              <h2 class="font-head text-base sm:text-lg font-bold">Kontak penerima</h2>
            </div>

            <div class="mt-3.5 grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="text-[11px] font-extrabold uppercase tracking-wide text-ink/55">Nama lengkap</span>
                <input
                  v-model="recipientName"
                  type="text"
                  autocomplete="name"
                  placeholder="Nama penerima"
                  :class="['mt-1 w-full rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold text-ink placeholder:text-ink/35 focus:outline-none focus:border-sun', errors.name ? 'border-destructive' : 'border-ink']"
                />
                <span v-if="errors.name" class="mt-1 block text-[11px] font-bold text-destructive">{{ errors.name }}</span>
              </label>

              <label class="block">
                <span class="text-[11px] font-extrabold uppercase tracking-wide text-ink/55">Nomor WhatsApp / telepon</span>
                <input
                  v-model="recipientPhone"
                  type="tel"
                  inputmode="tel"
                  autocomplete="tel"
                  placeholder="08xxxxxxxxxx"
                  :class="['mt-1 w-full rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold text-ink placeholder:text-ink/35 focus:outline-none focus:border-sun', errors.phone ? 'border-destructive' : 'border-ink']"
                />
                <span v-if="errors.phone" class="mt-1 block text-[11px] font-bold text-destructive">{{ errors.phone }}</span>
              </label>
            </div>

            <p class="mt-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold text-ink/50">
              <ShieldCheck :size="13" /> Konfirmasi pesanan dikirim ke email akun {{ user?.email || 'kamu' }}.
            </p>
          </section>

          <!-- 2. Delivery -->
          <section class="nb p-4 sm:p-5">
            <div class="flex items-center gap-2">
              <span class="grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-sky font-head text-xs font-bold">2</span>
              <h2 class="font-head text-base sm:text-lg font-bold">Cara menerima pesanan</h2>
            </div>

            <div class="mt-3.5 grid gap-2 sm:grid-cols-3">
              <label
                v-for="option in [
                  { value: 'store', title: 'Ambil di toko', desc: 'Gratis, tunggu konfirmasi', icon: Store },
                  { value: 'courier', title: 'Kirim kurir', desc: 'Alamat wajib diisi', icon: Truck },
                  { value: 'custom', title: 'Event / custom', desc: 'Booth, COD, atau janjian', icon: MapPin },
                ]"
                :key="option.value"
                :class="[
                  'flex cursor-pointer items-start gap-2 rounded-xl border-2 p-2.5 transition-colors',
                  deliveryMethod === option.value ? 'border-ink bg-sun/35 shadow-[2px_2px_0_#1B2430]' : 'border-ink/20 bg-white hover:border-ink/50',
                ]"
              >
                <input v-model="deliveryMethod" type="radio" name="delivery" :value="option.value" class="sr-only" />
                <component :is="option.icon" :size="17" class="mt-0.5 shrink-0" />
                <span>
                  <span class="block font-head text-[12.5px] font-bold leading-tight">{{ option.title }}</span>
                  <span class="mt-0.5 block text-[10.5px] font-semibold leading-tight text-ink/55">{{ option.desc }}</span>
                </span>
              </label>
            </div>

            <div v-if="deliveryMethod === 'courier'" class="mt-3">
              <label class="block">
                <span class="text-[11px] font-extrabold uppercase tracking-wide text-ink/55">Alamat pengiriman</span>
                <textarea
                  v-model="shippingAddress"
                  rows="3"
                  placeholder="Nama jalan, nomor rumah, kelurahan, kota, kode pos"
                  :class="['mt-1 w-full rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold text-ink placeholder:text-ink/35 focus:outline-none focus:border-sun', errors.address ? 'border-destructive' : 'border-ink']"
                ></textarea>
                <span v-if="errors.address" class="mt-1 block text-[11px] font-bold text-destructive">{{ errors.address }}</span>
              </label>
              <p class="mt-1.5 rounded-lg bg-soft/40 px-2.5 py-1.5 text-[10.5px] font-semibold text-ink/60">
                Ongkir akan dikonfirmasi admin sebelum pengiriman. Pesanan tetap bisa dilacak lewat nomor resi.
              </p>
            </div>

            <div v-else-if="deliveryMethod === 'store'" class="mt-3 rounded-xl border-2 border-ink/15 bg-bg/70 px-3 py-2.5 text-[11px] font-semibold leading-snug text-ink/65">
              <Store :size="14" class="mr-1 inline -mt-0.5" />
              Ambil di toko Mochibako. Kami hubungi lewat WhatsApp setelah pesanan siap diambil.
            </div>

            <label class="mt-3 block">
              <span class="text-[11px] font-extrabold uppercase tracking-wide text-ink/55">{{ noteLabel }}</span>
              <textarea
                v-model="deliveryNote"
                rows="2"
                :placeholder="notePlaceholder"
                :class="['mt-1 w-full rounded-xl border-2 bg-white px-3 py-2 text-sm font-semibold text-ink placeholder:text-ink/35 focus:outline-none focus:border-sun', errors.note ? 'border-destructive' : 'border-ink']"
              ></textarea>
              <span v-if="errors.note" class="mt-1 block text-[11px] font-bold text-destructive">{{ errors.note }}</span>
            </label>
          </section>

          <!-- 3. Payment -->
          <section class="nb p-4 sm:p-5">
            <div class="flex items-center gap-2">
              <span class="grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-mint font-head text-xs font-bold">3</span>
              <h2 class="font-head text-base sm:text-lg font-bold">Pembayaran</h2>
            </div>

            <div class="mt-3.5 grid gap-2 sm:grid-cols-2">
              <label
                :class="[
                  'flex cursor-pointer items-start gap-2.5 rounded-xl border-2 p-3 transition-colors',
                  paymentMethod === 'midtrans' ? 'border-ink bg-sun/35 shadow-[2px_2px_0_#1B2430]' : 'border-ink/20 bg-white hover:border-ink/50',
                ]"
              >
                <input v-model="paymentMethod" type="radio" name="payment" value="midtrans" class="sr-only" />
                <CreditCard :size="18" class="mt-0.5 shrink-0" />
                <span>
                  <span class="block font-head text-sm font-bold leading-tight">Midtrans (online)</span>
                  <span class="mt-0.5 block text-[10.5px] font-semibold leading-tight text-ink/55">
                    QRIS, virtual account, e-wallet, kartu.
                  </span>
                </span>
              </label>

              <label
                :class="[
                  'flex items-start gap-2.5 rounded-xl border-2 p-3 transition-colors',
                  deliveryMethod === 'courier'
                    ? 'cursor-not-allowed border-ink/10 bg-soft/30 opacity-60'
                    : paymentMethod === 'cash'
                      ? 'cursor-pointer border-ink bg-sun/35 shadow-[2px_2px_0_#1B2430]'
                      : 'cursor-pointer border-ink/20 bg-white hover:border-ink/50',
                ]"
              >
                <input
                  v-model="paymentMethod"
                  type="radio"
                  name="payment"
                  value="cash"
                  class="sr-only"
                  :disabled="deliveryMethod === 'courier'"
                />
                <Banknote :size="18" class="mt-0.5 shrink-0" />
                <span>
                  <span class="block font-head text-sm font-bold leading-tight">Tunai di tempat</span>
                  <span class="mt-0.5 block text-[10.5px] font-semibold leading-tight text-ink/55">
                    {{ deliveryMethod === 'courier' ? 'Tidak tersedia untuk kirim kurir.' : 'Bayar saat ambil di toko / booth.' }}
                  </span>
                </span>
              </label>
            </div>

            <p class="mt-2.5 flex items-start gap-1.5 text-[10.5px] font-semibold leading-snug text-ink/55">
              <MessageSquare :size="13" class="mt-0.5 shrink-0" />
              Setelah pesanan dibuat, kamu diarahkan ke pembayaran Midtrans. Jika pembayaran online belum tersedia, pesanan tetap tersimpan dan bisa dibayar dari halaman pesanan.
            </p>
          </section>
        </div>

        <!-- Summary -->
        <aside class="nb p-4 sm:p-5 lg:sticky lg:top-24" aria-label="Ringkasan pesanan">
          <h2 class="font-head text-lg font-bold">Pesananmu</h2>

          <ul class="mt-3 space-y-2.5">
            <li v-for="line in cartLines" :key="line.product.id" class="flex items-center gap-2.5">
              <ProductArt
                :product="line.product"
                :icon-size="20"
                :image-width="192"
                image-sizes="40px"
                class="h-10 w-10 shrink-0 rounded-lg border-2 border-ink"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-head text-[12px] font-bold leading-tight">{{ line.product.name }}</p>
                <p class="text-[10.5px] font-semibold text-ink/55">{{ line.quantity }} × {{ rupiah(line.product.price) }}</p>
              </div>
              <span class="shrink-0 text-[11.5px] font-bold tabular-nums">{{ rupiah(Number(line.product.price) * line.quantity) }}</span>
            </li>
          </ul>

          <dl class="mt-3.5 space-y-1.5 border-t-2 border-dashed border-soft pt-3 text-sm">
            <div class="flex justify-between gap-3 font-semibold text-ink/70">
              <dt>Subtotal</dt>
              <dd class="tabular-nums font-bold text-ink">{{ rupiah(cartTotal) }}</dd>
            </div>
            <div class="flex justify-between gap-3 font-semibold text-ink/70">
              <dt>Ongkir</dt>
              <dd class="text-[11px] font-bold text-ink/50 self-center">
                {{ deliveryMethod === 'courier' ? 'Dikonfirmasi admin' : 'Gratis' }}
              </dd>
            </div>
            <div class="flex justify-between gap-3 border-t-2 border-ink pt-2 mt-1">
              <dt class="font-head text-base font-bold">Total</dt>
              <dd class="font-head text-lg font-bold tabular-nums">{{ rupiah(cartTotal) }}</dd>
            </div>
          </dl>

          <div v-if="submitError" class="mt-3 rounded-xl border-2 border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] font-bold leading-snug text-destructive" role="alert">
            {{ submitError }}
          </div>

          <button
            type="submit"
            class="btn bg-ink text-bg w-full mt-3.5 h-11 font-head font-semibold text-sm sm:text-base disabled:opacity-60"
            :disabled="submitting"
          >
            <Loader2 v-if="submitting" :size="16" class="mr-1.5 animate-spin" />
            <CheckCircle2 v-else :size="16" class="mr-1.5" />
            {{ stepLabel }}
          </button>

          <p class="mt-2.5 flex items-start gap-1.5 text-[10.5px] font-semibold leading-snug text-ink/50">
            <ShieldCheck :size="13" class="mt-0.5 shrink-0" />
            Dengan melanjutkan, kamu setuju pesanan diproses sesuai stok dan konfirmasi admin.
          </p>

          <p v-if="paymentMethod === 'midtrans'" class="mt-2 rounded-lg bg-banner-sky px-2.5 py-2 text-[10.5px] font-bold text-ink/70">
            💳 Pembayaran online aman diproses oleh Midtrans. Tidak ada data kartu yang disimpan di toko.
          </p>
        </aside>
      </form>
    </div>
  </StoreShell>
</template>

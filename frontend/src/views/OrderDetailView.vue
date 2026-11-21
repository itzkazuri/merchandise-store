<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ClipboardCopy,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Store,
  Truck,
  XCircle,
} from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import { ordersApi, paymentsApi } from '@/api/store'
import { payWithSnap } from '@/api/midtrans'
import { ApiError } from '@/api/client'
import { longDateTime, rupiah, shortDate } from '@/lib/format'
import type { Order } from '@/types/order'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Detail Pesanan',
  description: 'Status pembayaran, pengiriman, dan rincian pesananmu di Mochibako.',
})

const route = useRoute()

const order = ref<Order | null>(null)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const payError = ref('')
const paying = ref(false)
const cancelling = ref(false)

const STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'Menunggu bayar', tone: 'bg-sun text-ink' },
  paid: { label: 'Dibayar', tone: 'bg-mint text-ink' },
  processing: { label: 'Diproses', tone: 'bg-sky text-ink' },
  shipped: { label: 'Dikirim', tone: 'bg-lilac text-ink' },
  completed: { label: 'Selesai', tone: 'bg-mint text-ink' },
  cancelled: { label: 'Dibatalkan', tone: 'bg-soft text-ink/60' },
}

const STEPS = [
  { status: 'pending_payment', label: 'Dibuat' },
  { status: 'paid', label: 'Dibayar' },
  { status: 'processing', label: 'Diproses' },
  { status: 'shipped', label: 'Dikirim' },
  { status: 'completed', label: 'Selesai' },
]

const statusInfo = computed(() => (order.value ? STATUS[order.value.status] || { label: order.value.status, tone: 'bg-soft' } : null))
const currentStep = computed(() => (order.value ? STEPS.findIndex((step) => step.status === order.value?.status) : -1))
const canPay = computed(() => order.value?.status === 'pending_payment' && order.value.payment_method === 'midtrans')
const canCancel = computed(() => order.value?.status === 'pending_payment')
const itemCount = computed(() =>
  (order.value?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
)

const queryNotice = computed<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(() => {
  if (route.query.baru) {
    return { tone: 'ok', text: 'Pesanan berhasil dibuat. Simpan nomor pesanan ini untuk pengecekan.' }
  }
  const bayar = String(route.query.bayar || '')
  if (bayar === 'sukses') return { tone: 'ok', text: 'Pembayaran berhasil dikirim ke Midtrans. Status akan diperbarui otomatis.' }
  if (bayar === 'pending') return { tone: 'warn', text: 'Pembayaran masih menunggu penyelesaian. Selesaikan sesuai instruksi Midtrans.' }
  if (bayar === 'gagal') return { tone: 'error', text: 'Pembayaran gagal atau dibatalkan. Kamu bisa mencoba bayar lagi dari halaman ini.' }
  if (bayar === 'belum') return { tone: 'warn', text: 'Jendela pembayaran ditutup sebelum selesai. Pesanan tetap tersimpan dan bisa dibayar lagi.' }
  if (bayar === 'manual') return { tone: 'warn', text: 'Pembayaran online belum bisa dibuka otomatis. Pesananmu tersimpan — coba tombol Bayar sekarang atau hubungi admin.' }
  return null
})

const deliveryLabel = computed(() => {
  if (!order.value) return '—'
  return { store: 'Ambil di toko', courier: 'Dikirim kurir', custom: 'Event / custom' }[order.value.delivery_method]
})
const paymentLabel = computed(() => {
  if (!order.value) return '—'
  return order.value.payment_method === 'cash' ? 'Tunai di tempat' : 'Midtrans (online)'
})

function errorMessage(cause: unknown) {
  return cause instanceof ApiError ? cause.message : 'Terjadi kesalahan. Coba lagi.'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    order.value = await ordersApi.get(String(route.params.id))
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}

async function copyNumber() {
  if (!order.value) return
  try {
    await navigator.clipboard.writeText(order.value.order_number)
    notice.value = 'Nomor pesanan disalin.'
  } catch {
    notice.value = 'Nomor pesanan tidak bisa disalin otomatis.'
  }
}

async function payNow() {
  if (!order.value || paying.value) return
  paying.value = true
  payError.value = ''
  notice.value = ''
  try {
    const payment = await paymentsApi.createMidtrans(order.value.id)
    await payWithSnap(payment, {
      onSuccess: () => {
        notice.value = 'Pembayaran berhasil. Status pesanan sedang diperbarui…'
        window.setTimeout(load, 1800)
      },
      onPending: () => {
        notice.value = 'Pembayaran menunggu penyelesaian. Cek kembali beberapa saat lagi.'
      },
      onError: () => {
        payError.value = 'Pembayaran gagal atau ditolak Midtrans. Coba lagi.'
      },
    })
  } catch (cause) {
    payError.value = `${errorMessage(cause)} Coba lagi atau hubungi admin.`
  } finally {
    paying.value = false
  }
}

async function cancelOrder() {
  if (!order.value || cancelling.value) return
  if (!window.confirm('Batalkan pesanan ini? Stok produk akan dikembalikan.')) return
  cancelling.value = true
  payError.value = ''
  try {
    order.value = await ordersApi.cancel(order.value.id)
    notice.value = 'Pesanan dibatalkan dan stok dikembalikan.'
  } catch (cause) {
    payError.value = errorMessage(cause)
  } finally {
    cancelling.value = false
  }
}

onMounted(load)
</script>

<template>
  <StoreShell>
    <div class="max-w-5xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">
      <nav class="flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-ink/55" aria-label="Breadcrumb">
        <RouterLink to="/pesanan" class="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft :size="12" /> Pesanan saya</RouterLink>
        <span v-if="order" class="text-ink/30">/</span>
        <span v-if="order" class="truncate text-ink/75">{{ order.order_number }}</span>
      </nav>

      <!-- Loading -->
      <div v-if="loading" class="mt-4 space-y-4 animate-pulse">
        <div class="nb p-5"><div class="h-6 w-1/2 rounded bg-soft/80"></div><div class="mt-3 h-4 w-1/3 rounded bg-soft/70"></div></div>
        <div class="nb p-5"><div class="h-12 rounded bg-soft/60"></div></div>
        <div class="nb p-5"><div class="h-36 rounded bg-soft/60"></div></div>
      </div>

      <!-- Error -->
      <div v-else-if="error || !order" class="nb mt-5 p-7 text-center">
        <XCircle :size="38" class="mx-auto text-destructive/60 mb-2" />
        <h1 class="font-head text-lg font-bold">Pesanan tidak bisa dibuka</h1>
        <p class="mt-1 text-sm font-semibold text-ink/60">{{ error || 'Pesanan tidak ditemukan.' }}</p>
        <div class="mt-4 flex justify-center gap-2">
          <button type="button" class="btn bg-white text-ink h-9 px-4 text-sm font-head font-semibold" @click="load">Coba lagi</button>
          <RouterLink to="/pesanan" class="btn bg-sun text-ink h-9 px-4 text-sm font-head font-semibold">Ke daftar pesanan</RouterLink>
        </div>
      </div>

      <template v-else>
        <!-- Query notice -->
        <div
          v-if="queryNotice"
          :class="[
            'mt-4 rounded-xl border-2 px-3.5 py-2.5 text-xs font-bold leading-snug',
            queryNotice.tone === 'ok' ? 'border-mint bg-mint/30 text-ink' : queryNotice.tone === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-sun bg-sun/25 text-ink',
          ]"
          role="status"
        >
          {{ queryNotice.text }}
        </div>
        <div v-if="notice" class="mt-3 rounded-xl border-2 border-mint bg-mint/25 px-3.5 py-2.5 text-xs font-bold text-ink" role="status">
          {{ notice }}
        </div>

        <!-- Header -->
        <header class="nb mt-4 p-4 sm:p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="font-head text-xl sm:text-2xl font-bold text-ink">{{ order.order_number }}</h1>
                <span :class="['rounded-full border-2 border-ink px-2.5 py-0.5 text-[10.5px] font-extrabold', statusInfo?.tone]">
                  {{ statusInfo?.label }}
                </span>
              </div>
              <p class="mt-1 text-[11px] sm:text-xs font-semibold text-ink/55">
                Dibuat {{ longDateTime(order.created_at) }} · {{ itemCount }} item
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn bg-white text-ink h-8 px-3 text-xs font-head font-semibold inline-flex items-center gap-1"
                @click="copyNumber"
              >
                <ClipboardCopy :size="13" /> Salin
              </button>
              <span class="font-head text-lg sm:text-xl font-bold tabular-nums">{{ rupiah(order.total) }}</span>
            </div>
          </div>
        </header>

        <div class="mt-4 grid gap-4 lg:grid-cols-[1.35fr_.65fr] items-start">
          <div class="space-y-4">
            <!-- Timeline -->
            <section class="nb p-4 sm:p-5">
              <h2 class="font-head text-base font-bold">Status pesanan</h2>
              <div v-if="order.status === 'cancelled'" class="mt-2.5 flex items-start gap-2 rounded-xl border-2 border-destructive/25 bg-destructive/5 px-3 py-2.5">
                <XCircle :size="16" class="mt-0.5 shrink-0 text-destructive" />
                <p class="text-[11px] font-semibold leading-snug text-ink/70">
                  Pesanan dibatalkan. Jika kamu sudah membayar, hubungi admin untuk pengembalian dana.
                </p>
              </div>
              <ol v-else class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <li
                  v-for="(step, index) in STEPS"
                  :key="step.status"
                  :class="[
                    'rounded-lg border-2 px-2 py-1.5',
                    index < currentStep ? 'border-ink bg-mint/60' : index === currentStep ? 'border-ink bg-sun shadow-[2px_2px_0_#1B2430]' : 'border-ink/15 bg-white/60',
                  ]"
                >
                  <span class="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide">
                    <CheckCircle2 v-if="index < currentStep" :size="11" />
                    <span v-else class="grid h-3.5 w-3.5 place-items-center rounded-full border border-ink text-[8px]">{{ index + 1 }}</span>
                    {{ step.label }}
                  </span>
                </li>
              </ol>
            </section>

            <!-- Items -->
            <section class="nb p-4 sm:p-5">
              <h2 class="font-head text-base font-bold">Item pesanan</h2>
              <ul class="mt-2.5 divide-y divide-soft/70">
                <li v-for="item in order.items" :key="item.id" class="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-ink bg-sun">
                    <Package :size="17" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <RouterLink
                      v-if="item.product_slug"
                      :to="`/produk/${item.product_slug}`"
                      class="font-head text-[12.5px] sm:text-sm font-bold leading-tight text-ink hover:underline line-clamp-2"
                    >
                      {{ item.product_name }}
                    </RouterLink>
                    <p v-else class="font-head text-[12.5px] sm:text-sm font-bold leading-tight">{{ item.product_name }}</p>
                    <p class="mt-0.5 text-[10.5px] font-semibold text-ink/50">
                      {{ item.quantity }} × {{ rupiah(item.price) }}<span v-if="item.sku"> · {{ item.sku }}</span>
                    </p>
                  </div>
                  <strong class="shrink-0 font-head text-xs sm:text-sm font-bold tabular-nums">{{ rupiah(item.subtotal) }}</strong>
                </li>
              </ul>

              <dl class="mt-3 space-y-1 border-t-2 border-dashed border-soft pt-2.5 text-xs">
                <div class="flex justify-between gap-3 font-semibold text-ink/65"><dt>Subtotal</dt><dd class="tabular-nums">{{ rupiah(order.subtotal) }}</dd></div>
                <div class="flex justify-between gap-3 font-semibold text-ink/65"><dt>Ongkir</dt><dd class="tabular-nums">{{ rupiah(order.shipping_cost) }}</dd></div>
                <div class="flex justify-between gap-3 border-t border-soft pt-1.5 font-head text-base font-bold text-ink"><dt>Total</dt><dd class="tabular-nums">{{ rupiah(order.total) }}</dd></div>
              </dl>
            </section>

            <!-- Delivery & payment -->
            <div class="grid gap-4 sm:grid-cols-2">
              <section class="nb p-4">
                <h2 class="flex items-center gap-1.5 font-head text-sm font-bold">
                  <Truck :size="15" /> Pengiriman
                </h2>
                <dl class="mt-2 space-y-1.5 text-[11.5px]">
                  <div><dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Metode</dt><dd class="font-semibold">{{ deliveryLabel }}</dd></div>
                  <div><dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Penerima</dt><dd class="font-semibold">{{ order.recipient_name }} · {{ order.recipient_phone }}</dd></div>
                  <div v-if="order.shipping_address"><dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Alamat</dt><dd class="font-semibold leading-snug">{{ order.shipping_address }}</dd></div>
                  <div v-if="order.delivery_note"><dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Catatan</dt><dd class="font-semibold leading-snug">{{ order.delivery_note }}</dd></div>
                  <div v-if="order.tracking_number"><dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Resi</dt><dd class="font-mono font-bold">{{ order.tracking_number }}</dd></div>
                </dl>
              </section>

              <section class="nb p-4">
                <h2 class="flex items-center gap-1.5 font-head text-sm font-bold">
                  <CreditCard v-if="order.payment_method === 'midtrans'" :size="15" />
                  <Banknote v-else :size="15" /> Pembayaran
                </h2>
                <dl class="mt-2 space-y-1.5 text-[11.5px]">
                  <div><dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Metode</dt><dd class="font-semibold">{{ paymentLabel }}</dd></div>
                  <div>
                    <dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Dibayar</dt>
                    <dd class="font-semibold">{{ order.paid_at ? shortDate(order.paid_at) : 'Belum dibayar' }}</dd>
                  </div>
                  <div><dt class="font-extrabold uppercase tracking-wide text-ink/40 text-[9.5px]">Total</dt><dd class="font-head text-sm font-bold">{{ rupiah(order.total) }}</dd></div>
                </dl>
              </section>
            </div>
          </div>

          <!-- Actions -->
          <aside class="nb p-4 sm:p-5 lg:sticky lg:top-24">
            <h2 class="font-head text-base font-bold">Langkah berikutnya</h2>

            <div v-if="order.status === 'pending_payment' && order.payment_method === 'midtrans'" class="mt-2.5">
              <p class="text-[11px] font-semibold leading-snug text-ink/60">
                Selesaikan pembayaran supaya pesanan bisa diproses. Kamu bisa memilih QRIS, VA, atau e-wallet di halaman Midtrans.
              </p>
              <button
                type="button"
                class="btn bg-ink text-bg w-full mt-3 h-11 font-head font-semibold text-sm"
                :disabled="paying"
                @click="payNow"
              >
                <Loader2 v-if="paying" :size="16" class="mr-1.5 animate-spin" />
                <CreditCard v-else :size="16" class="mr-1.5" />
                {{ paying ? 'Membuka pembayaran…' : 'Bayar sekarang' }}
              </button>
            </div>

            <div v-else-if="order.status === 'pending_payment'" class="mt-2.5">
              <p class="flex items-start gap-1.5 rounded-lg bg-sun/25 px-2.5 py-2 text-[11px] font-semibold leading-snug text-ink/70">
                <Store :size="13" class="mt-0.5 shrink-0" /> Pesanan tunai. Bayar saat mengambil di toko atau booth event.
              </p>
            </div>

            <div v-else-if="order.status === 'completed'" class="mt-2.5 flex items-start gap-1.5 rounded-lg bg-mint/40 px-2.5 py-2 text-[11px] font-semibold leading-snug text-ink/70">
              <CheckCircle2 :size="14" class="mt-0.5 shrink-0" /> Pesanan selesai. Terima kasih sudah belanja di Mochibako!
            </div>

            <div v-else class="mt-2.5 flex items-start gap-1.5 rounded-lg bg-sky/30 px-2.5 py-2 text-[11px] font-semibold leading-snug text-ink/70">
              <Truck :size="14" class="mt-0.5 shrink-0" />
              {{ order.status === 'shipped' ? 'Pesanan sedang dikirim. Simpan nomor resi untuk pelacakan.' : 'Pesanan sedang kami siapkan.' }}
            </div>

            <div v-if="payError" class="mt-2.5 rounded-lg border-2 border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[10.5px] font-bold leading-snug text-destructive" role="alert">
              {{ payError }}
            </div>

            <button
              v-if="canCancel"
              type="button"
              class="mt-3 w-full rounded-full border-2 border-destructive/30 bg-white py-2 text-[11px] font-extrabold text-destructive hover:bg-destructive/5 disabled:opacity-50"
              :disabled="cancelling || paying"
              @click="cancelOrder"
            >
              {{ cancelling ? 'Membatalkan…' : 'Batalkan pesanan' }}
            </button>

            <div class="mt-4 border-t-2 border-dashed border-soft pt-3">
              <p class="flex items-start gap-1.5 text-[10.5px] font-semibold leading-snug text-ink/50">
                <ShieldCheck :size="13" class="mt-0.5 shrink-0" />
                Butuh bantuan? Hubungi admin dengan menyertakan nomor pesanan di atas.
              </p>
              <div class="mt-2.5 grid gap-1.5">
                <RouterLink to="/pesanan" class="btn bg-white text-ink h-9 text-xs font-head font-semibold">Daftar pesanan</RouterLink>
                <RouterLink to="/" class="btn bg-sun text-ink h-9 text-xs font-head font-semibold">Belanja lagi</RouterLink>
              </div>
            </div>

            <p class="mt-3 flex items-center gap-1 text-[10px] font-semibold text-ink/40">
              <MapPin :size="11" /> Mochibako · Jakarta, Indonesia
            </p>
          </aside>
        </div>
      </template>
    </div>
  </StoreShell>
</template>

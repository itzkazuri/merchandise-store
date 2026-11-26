<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Package,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import DynamicIcon from '@/components/DynamicIcon.vue'
import { ordersApi } from '@/api/store'
import { ApiError } from '@/api/client'
import { rupiah, shortDate } from '@/lib/format'
import { visualFor } from '@/lib/productVisual'
import type { Order, OrderItem, OrderStatus } from '@/types/order'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Pesanan Saya',
  description: 'Riwayat dan status pesanan merchandise anime kamu di Mochibako.',
})

const route = useRoute()
const router = useRouter()

const STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'Menunggu bayar', tone: 'bg-sun text-ink' },
  paid: { label: 'Dibayar', tone: 'bg-mint text-ink' },
  processing: { label: 'Diproses', tone: 'bg-sky text-ink' },
  shipped: { label: 'Dikirim', tone: 'bg-lilac text-ink' },
  completed: { label: 'Selesai', tone: 'bg-mint text-ink' },
  cancelled: { label: 'Dibatalkan', tone: 'bg-soft text-ink/60' },
}

const TABS: { key: '' | OrderStatus; label: string }[] = [
  { key: '', label: 'Semua' },
  { key: 'pending_payment', label: 'Menunggu bayar' },
  { key: 'paid', label: 'Dibayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
]

const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const pendingTotal = ref(0)
const activeStatus = ref<'' | OrderStatus>(readStatus(route.query.status))

function readStatus(value: unknown): '' | OrderStatus {
  const key = typeof value === 'string' ? value : ''
  return TABS.some((tab) => tab.key === key) ? (key as '' | OrderStatus) : ''
}

const pageNumbers = computed(() => {
  const last = pages.value
  if (last <= 5) return Array.from({ length: last }, (_, index) => index + 1)
  const start = Math.max(1, Math.min(page.value - 2, last - 4))
  return Array.from({ length: 5 }, (_, index) => start + index)
})

const emptyTitle = computed(() =>
  activeStatus.value ? 'Tidak ada pesanan di status ini' : 'Belum ada pesanan',
)

function statusOf(order: Order) {
  return STATUS[order.status] || { label: order.status, tone: 'bg-soft text-ink/60' }
}

function itemCount(order: Order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

function visualForItem(item: OrderItem) {
  return visualFor({
    id: item.product_id ?? item.id,
    name: item.product_name,
    price: item.price,
    stock: 1,
  })
}

function canPayNow(order: Order) {
  return order.status === 'pending_payment' && order.payment_method === 'midtrans'
}

async function load(nextPage = 1) {
  loading.value = true
  error.value = ''
  try {
    const data = await ordersApi.list({
      page: nextPage,
      size: 10,
      status: activeStatus.value || undefined,
    })
    orders.value = data.items || []
    total.value = data.total || 0
    pages.value = data.pages || 1
    page.value = nextPage
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Riwayat pesanan gagal dimuat.'
  } finally {
    loading.value = false
  }
}

async function loadPendingTotal() {
  try {
    const data = await ordersApi.list({ status: 'pending_payment', size: 1, page: 1 })
    pendingTotal.value = data.total || 0
  } catch {
    pendingTotal.value = 0
  }
}

function selectStatus(key: '' | OrderStatus) {
  if (activeStatus.value === key) return
  activeStatus.value = key
  void router.replace({ name: 'orders', query: key ? { status: key } : {} })
  void load(1)
}

function refresh() {
  void Promise.all([load(page.value), loadPendingTotal()])
}

onMounted(() => {
  void load(1)
  void loadPendingTotal()
})
</script>

<template>
  <StoreShell>
    <div class="max-w-5xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">
      <!-- Header -->
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">Akun</p>
          <h1 class="font-head text-2xl sm:text-3xl font-bold text-ink">Pesanan Saya</h1>
          <p class="mt-1 text-xs sm:text-sm font-semibold text-ink/60">
            {{ total ? `${total} pesanan` : 'Belum ada pesanan' }}
            <span v-if="pendingTotal" class="text-ink/80">· {{ pendingTotal }} menunggu pembayaran</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink to="/" class="text-xs sm:text-sm font-extrabold text-ink/60 hover:text-ink">Belanja lagi</RouterLink>
          <button
            type="button"
            class="btn bg-white text-ink h-9 px-3.5 text-xs font-head font-semibold inline-flex items-center gap-1.5"
            :disabled="loading"
            @click="refresh"
          >
            <RefreshCw :size="13" :class="{ 'animate-spin': loading }" /> Muat ulang
          </button>
        </div>
      </header>

      <!-- Filter status -->
      <div class="mt-4 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
        <div class="flex w-max gap-1.5 sm:gap-2 pb-1">
          <button
            v-for="tab in TABS"
            :key="tab.key || 'all'"
            type="button"
            :class="[
              'shrink-0 rounded-full border-2 border-ink px-3 py-1.5 text-[11px] sm:text-xs font-extrabold transition-colors',
              activeStatus === tab.key ? 'bg-ink text-bg' : 'bg-white text-ink hover:bg-soft/50',
            ]"
            :aria-pressed="activeStatus === tab.key"
            @click="selectStatus(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading && !orders.length" class="mt-5 space-y-3">
        <div v-for="n in 3" :key="n" class="nb p-4 animate-pulse">
          <div class="h-4 w-1/3 rounded bg-soft/80"></div>
          <div class="mt-2 h-3 w-1/2 rounded bg-soft/70"></div>
          <div class="mt-3 h-12 w-full rounded bg-soft/60"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="nb mt-5 p-6 text-center">
        <p class="font-head text-base font-bold text-destructive">{{ error }}</p>
        <button type="button" class="btn bg-white text-ink h-9 px-4 mt-3 text-sm font-head font-semibold" @click="refresh">
          Coba lagi
        </button>
      </div>

      <!-- Empty -->
      <div v-else-if="!orders.length" class="nb mt-5 p-7 sm:p-10 text-center">
        <Package :size="38" class="mx-auto text-ink/35 mb-2" />
        <h2 class="font-head text-lg sm:text-xl font-bold">{{ emptyTitle }}</h2>
        <p class="mt-1 text-sm font-semibold text-ink/60 max-w-md mx-auto">
          <template v-if="activeStatus">
            Coba pilih tab lain, atau lihat semua pesananmu.
          </template>
          <template v-else>
            Pesanan yang kamu buat akan muncul di sini.
          </template>
        </p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button v-if="activeStatus" type="button" class="btn bg-white text-ink h-9 px-4 text-sm font-head font-semibold" @click="selectStatus('')">
            Lihat semua
          </button>
          <RouterLink to="/" class="btn bg-sun text-ink h-9 px-4 text-sm font-head font-semibold inline-flex">
            <ShoppingBag :size="15" class="mr-1.5" /> Mulai belanja
          </RouterLink>
        </div>
      </div>

      <!-- List -->
      <div v-else class="mt-4 space-y-3">
        <article v-for="order in orders" :key="order.id" class="nb p-3.5 sm:p-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <RouterLink
                :to="`/pesanan/${order.order_number}`"
                class="font-head text-sm sm:text-base font-bold text-ink hover:underline decoration-2 underline-offset-2"
              >
                {{ order.order_number }}
              </RouterLink>
              <p class="mt-0.5 text-[11px] font-semibold text-ink/55">
                {{ shortDate(order.created_at) }} · {{ itemCount(order) }} item
                <span class="text-ink/35">·</span>
                {{ order.payment_method === 'cash' ? 'Tunai' : 'Midtrans' }}
              </p>
            </div>
            <span :class="['rounded-full border-2 border-ink px-2.5 py-0.5 text-[10.5px] font-extrabold', statusOf(order).tone]">
              {{ statusOf(order).label }}
            </span>
          </div>

          <!-- Item preview -->
          <div class="mt-3 flex items-center gap-2 sm:gap-2.5 border-t border-soft/70 pt-3">
            <div class="flex -space-x-2">
              <span
                v-for="item in order.items.slice(0, 3)"
                :key="item.id"
                :class="['relative grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center overflow-hidden rounded-lg border-2 border-ink', visualForItem(item).color]"
                :title="item.product_name"
              >
                <DynamicIcon :name="visualForItem(item).icon" :size="18" :stroke-width="2.1" />
                <span
                  v-if="item.quantity > 1"
                  class="absolute -right-0.5 -bottom-0.5 rounded-full border border-ink bg-white px-1 text-[8.5px] font-extrabold leading-tight"
                >
                  {{ item.quantity }}
                </span>
              </span>
              <span
                v-if="order.items.length > 3"
                class="relative grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white text-[10px] font-extrabold"
              >
                +{{ order.items.length - 3 }}
              </span>
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-[11.5px] sm:text-xs font-bold text-ink/75">
                {{ order.items[0]?.product_name || 'Tanpa item' }}
                <span v-if="order.items.length > 1" class="font-semibold text-ink/45">
                  + {{ order.items.length - 1 }} lainnya
                </span>
              </p>
              <p class="mt-0.5 truncate text-[10.5px] font-semibold text-ink/45">
                <template v-if="order.tracking_number">
                  <Truck :size="10" class="inline -mt-0.5 mr-0.5" /> Resi {{ order.tracking_number }}
                </template>
                <template v-else-if="order.delivery_method === 'store'">
                  <Store :size="10" class="inline -mt-0.5 mr-0.5" /> Ambil di toko
                </template>
                <template v-else-if="order.delivery_method === 'courier'">
                  <Truck :size="10" class="inline -mt-0.5 mr-0.5" /> Dikirim kurir
                </template>
                <template v-else>
                  <PackageCheck :size="10" class="inline -mt-0.5 mr-0.5" /> Event / custom
                </template>
              </p>
            </div>

            <strong class="shrink-0 font-head text-sm sm:text-base font-bold tabular-nums">
              {{ rupiah(order.total) }}
            </strong>
          </div>

          <!-- Actions -->
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span class="text-[10.5px] font-semibold text-ink/45">
              <template v-if="order.status === 'pending_payment' && order.payment_method === 'cash'">
                Bayar saat ambil di toko / booth.
              </template>
              <template v-else-if="order.status === 'pending_payment'">
                Selesaikan pembayaran sebelum diproses.
              </template>
              <template v-else-if="order.status === 'shipped'">
                Paket sedang dalam perjalanan.
              </template>
              <template v-else-if="order.status === 'completed'">
                Terima kasih sudah belanja!
              </template>
              <template v-else-if="order.status === 'cancelled'">
                Pesanan dibatalkan, stok sudah dikembalikan.
              </template>
              <template v-else>
                Pesanan sedang kami siapkan.
              </template>
            </span>

            <div class="flex items-center gap-1.5 sm:gap-2">
              <RouterLink
                :to="`/pesanan/${order.order_number}`"
                class="btn bg-white text-ink h-8 px-3 text-[11px] sm:text-xs font-head font-semibold"
              >
                Detail
              </RouterLink>
              <RouterLink
                v-if="canPayNow(order)"
                :to="`/pesanan/${order.order_number}`"
                class="btn bg-sun text-ink h-8 px-3 text-[11px] sm:text-xs font-head font-semibold inline-flex items-center gap-1"
              >
                <CreditCard :size="12" /> Bayar
              </RouterLink>
            </div>
          </div>
        </article>

        <!-- Pagination -->
        <div v-if="pages > 1" class="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          <button
            type="button"
            class="btn bg-white text-ink h-8 w-8 grid place-items-center"
            aria-label="Halaman sebelumnya"
            :disabled="page <= 1 || loading"
            @click="load(page - 1)"
          >
            <ChevronLeft :size="15" />
          </button>
          <button
            v-for="number in pageNumbers"
            :key="number"
            type="button"
            :class="[
              'h-8 min-w-8 rounded-full border-2 border-ink px-2 text-xs font-extrabold transition-colors',
              number === page ? 'bg-ink text-bg' : 'bg-white text-ink hover:bg-soft/50',
            ]"
            :aria-current="number === page ? 'page' : undefined"
            @click="load(number)"
          >
            {{ number }}
          </button>
          <button
            type="button"
            class="btn bg-white text-ink h-8 w-8 grid place-items-center"
            aria-label="Halaman berikutnya"
            :disabled="page >= pages || loading"
            @click="load(page + 1)"
          >
            <ChevronRight :size="15" />
          </button>
        </div>
      </div>
    </div>
  </StoreShell>
</template>

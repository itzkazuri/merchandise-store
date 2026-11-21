<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight, Package, RefreshCw, ShoppingBag } from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import { ordersApi } from '@/api/store'
import { ApiError } from '@/api/client'
import { rupiah, shortDate } from '@/lib/format'
import type { Order } from '@/types/order'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Pesanan Saya',
  description: 'Riwayat dan status pesanan merchandise anime kamu di Mochibako.',
})

const STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'Menunggu bayar', tone: 'bg-sun text-ink' },
  paid: { label: 'Dibayar', tone: 'bg-mint text-ink' },
  processing: { label: 'Diproses', tone: 'bg-sky text-ink' },
  shipped: { label: 'Dikirim', tone: 'bg-lilac text-ink' },
  completed: { label: 'Selesai', tone: 'bg-mint text-ink' },
  cancelled: { label: 'Dibatalkan', tone: 'bg-soft text-ink/60' },
}

const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pages = ref(1)
const total = ref(0)

const newOrders = computed(() => orders.value.filter((order) => order.status === 'pending_payment').length)

function statusOf(order: Order) {
  return STATUS[order.status] || { label: order.status, tone: 'bg-soft text-ink/60' }
}

function itemCount(order: Order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

async function load(nextPage = 1) {
  loading.value = true
  error.value = ''
  try {
    const data = await ordersApi.list({ page: nextPage, size: 10 }) as {
      items?: Order[]
      total?: number
      pages?: number
    }
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

onMounted(() => load())
</script>

<template>
  <StoreShell>
    <div class="max-w-4xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/45">Akun</p>
          <h1 class="font-head text-2xl sm:text-3xl font-bold text-ink">Pesanan Saya</h1>
          <p class="mt-1 text-xs sm:text-sm font-semibold text-ink/60">
            {{ total ? `${total} pesanan` : 'Belum ada pesanan' }}
            <span v-if="newOrders" class="text-ink/80">· {{ newOrders }} menunggu pembayaran</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink to="/" class="text-xs sm:text-sm font-extrabold text-ink/60 hover:text-ink">Belanja lagi</RouterLink>
          <button
            type="button"
            class="btn bg-white text-ink h-8 px-3 text-xs font-head font-semibold inline-flex items-center gap-1"
            :disabled="loading"
            @click="load(page)"
          >
            <RefreshCw :size="13" :class="{ 'animate-spin': loading }" /> Muat ulang
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading && !orders.length" class="mt-5 space-y-3">
        <div v-for="n in 3" :key="n" class="nb p-4 animate-pulse">
          <div class="h-4 w-1/3 rounded bg-soft/80"></div>
          <div class="mt-2 h-3 w-1/2 rounded bg-soft/70"></div>
          <div class="mt-3 h-8 w-full rounded bg-soft/60"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="nb mt-5 p-6 text-center">
        <p class="font-head text-base font-bold text-destructive">{{ error }}</p>
        <button type="button" class="btn bg-white text-ink h-9 px-4 mt-3 text-sm font-head font-semibold" @click="load(page)">Coba lagi</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!orders.length" class="nb mt-5 p-7 sm:p-10 text-center">
        <Package :size="38" class="mx-auto text-ink/35 mb-2" />
        <h2 class="font-head text-lg sm:text-xl font-bold">Belum ada pesanan</h2>
        <p class="mt-1 text-sm font-semibold text-ink/60">Pesanan yang kamu buat akan muncul di sini.</p>
        <RouterLink to="/" class="btn bg-sun text-ink mt-4 h-9 px-4 text-sm font-head font-semibold inline-flex">
          <ShoppingBag :size="15" class="mr-1.5" /> Mulai belanja
        </RouterLink>
      </div>

      <!-- List -->
      <div v-else class="mt-5 space-y-3">
        <RouterLink
          v-for="order in orders"
          :key="order.id"
          :to="`/pesanan/${order.id}`"
          class="nb block p-3.5 sm:p-4 hover:-translate-y-0.5 transition-transform"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-head text-sm sm:text-base font-bold text-ink">{{ order.order_number }}</p>
              <p class="mt-0.5 text-[11px] font-semibold text-ink/55">
                {{ shortDate(order.created_at) }} · {{ itemCount(order) }} item
              </p>
            </div>
            <span :class="['rounded-full border-2 border-ink px-2.5 py-0.5 text-[10.5px] font-extrabold', statusOf(order).tone]">
              {{ statusOf(order).label }}
            </span>
          </div>

          <div class="mt-2.5 flex items-center justify-between gap-3 border-t border-soft/70 pt-2.5">
            <p class="truncate text-[11px] font-semibold text-ink/60">
              {{ (order.items || []).map((item) => item.product_name).join(', ') || 'Tanpa item' }}
            </p>
            <div class="flex shrink-0 items-center gap-2">
              <strong class="font-head text-sm font-bold tabular-nums">{{ rupiah(order.total) }}</strong>
              <ChevronRight :size="15" class="text-ink/45" />
            </div>
          </div>
        </RouterLink>

        <div v-if="pages > 1" class="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            class="btn bg-white text-ink h-8 px-3 text-xs font-head font-semibold"
            :disabled="page <= 1 || loading"
            @click="load(page - 1)"
          >
            Sebelumnya
          </button>
          <span class="text-[11px] font-bold text-ink/55">Halaman {{ page }} / {{ pages }}</span>
          <button
            type="button"
            class="btn bg-white text-ink h-8 px-3 text-xs font-head font-semibold"
            :disabled="page >= pages || loading"
            @click="load(page + 1)"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  </StoreShell>
</template>

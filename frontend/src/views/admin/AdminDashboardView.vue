<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowUpRight,
  ShoppingBag,
  Package,
  Boxes,
  Store,
  ChartNoAxesCombined,
  Users,
  UserCog,
  Clock,
  CircleDollarSign,
  ClipboardList,
  Sparkles,
} from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminDataTable from '@/components/ui/AdminDataTable.vue'
import AdminStatus from '@/components/ui/AdminStatus.vue'
import AdminState from '@/components/ui/AdminState.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'

interface Order {
  id: number
  order_number?: string
  customer_name?: string
  customer?: { name?: string; email?: string }
  total?: string | number
  status?: string
  created_at?: string
}

const loading = ref(true)
const error = ref('')
const recentOrders = ref<Order[]>([])
const orderTotal = ref(0)
const revenueAmount = ref(0)
const pendingTotal = ref(0)

const now = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())

const columns = [
  { key: 'order_number', label: 'No. Pesanan' },
  { key: 'customer', label: 'Pelanggan' },
  { key: 'created_at', label: 'Tanggal' },
  { key: 'total', label: 'Total', numeric: true },
  { key: 'status', label: 'Status' },
]

function currency(value: number) {
  return new Intl.NumberFormat(import.meta.env.VITE_LOCALE || 'id-ID', {
    style: 'currency',
    currency: import.meta.env.VITE_CURRENCY || 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function dateLabel(value?: string) {
  return value
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
    : '—'
}

function orderCode(order: Order) {
  return order.order_number || `#${order.id}`
}

function customerName(order: Order) {
  return order.customer_name || order.customer?.name || order.customer?.email || 'Pelanggan'
}

function orderTotalValue(order: Order) {
  return currency(Number(order.total || 0))
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [ordersResult, pendingResult, revenueResult] = await Promise.all([
      adminApi.orders({ page: 1, size: 5 }),
      adminApi.orders({ page: 1, size: 1, status: 'pending_payment' }),
      adminApi.revenue({ group_by: 'day' }),
    ])
    const ordersPayload = ordersResult as { items?: Order[]; total?: number }
    const pendingPayload = pendingResult as { total?: number }
    const revenuePayload = revenueResult as {
      total_revenue?: number | string
      revenue?: number | string
      total?: number | string
      items?: { revenue?: number | string }[]
    }
    recentOrders.value = ordersPayload.items || []
    orderTotal.value = ordersPayload.total || 0
    pendingTotal.value = pendingPayload.total || 0
    revenueAmount.value = Number(
      revenuePayload.total_revenue ??
      revenuePayload.revenue ??
      revenuePayload.total ??
      revenuePayload.items?.reduce((sum, item) => sum + Number(item.revenue || 0), 0) ??
      0,
    )
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Data dashboard tidak dapat dimuat.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <AdminPageHeader
      title="Ringkasan Toko"
      :description="`Aktivitas operasional Mochibako · ${now}`"
    >
      <RouterLink
        to="/admin/pos"
        class="btn bg-sun hover:bg-sun/90 text-ink border-2 border-ink px-4 py-2 rounded-xl font-head font-bold text-xs sm:text-sm flex items-center gap-2 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
      >
        <ShoppingBag :size="16" :stroke-width="2.4" />
        <span>Buka Kasir POS</span>
      </RouterLink>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" @retry="load" />

    <template v-else>
      <!-- 4 Stat Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Stat 1: Total Pesanan -->
        <div class="p-5 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430] flex flex-col justify-between hover:-translate-y-0.5 transition-all">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-ink/60 uppercase tracking-wider">Total Pesanan</span>
            <span class="w-8 h-8 rounded-lg bg-sky/30 border border-ink grid place-items-center">
              <Package :size="16" class="text-ink" />
            </span>
          </div>
          <div class="mt-3">
            <strong class="font-head font-extrabold text-2xl sm:text-3xl text-ink block tabular-nums">
              {{ loading ? '…' : orderTotal.toLocaleString('id-ID') }}
            </strong>
            <small class="text-xs font-semibold text-ink/50 mt-1 block">Sepanjang waktu</small>
          </div>
        </div>

        <!-- Stat 2: Menunggu Pembayaran -->
        <div class="p-5 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430] flex flex-col justify-between hover:-translate-y-0.5 transition-all">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-ink/60 uppercase tracking-wider">Menunggu Bayar</span>
            <span class="w-8 h-8 rounded-lg bg-sun/30 border border-ink grid place-items-center">
              <Clock :size="16" class="text-ink" />
            </span>
          </div>
          <div class="mt-3">
            <strong
              class="font-head font-extrabold text-2xl sm:text-3xl block tabular-nums"
              :class="pendingTotal > 0 ? 'text-amber-600' : 'text-ink'"
            >
              {{ loading ? '…' : pendingTotal.toLocaleString('id-ID') }}
            </strong>
            <small class="text-xs font-semibold text-ink/50 mt-1 block">Perlu verifikasi & pantau</small>
          </div>
        </div>

        <!-- Stat 3: Pendapatan Bersih -->
        <div class="p-5 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430] flex flex-col justify-between hover:-translate-y-0.5 transition-all">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-ink/60 uppercase tracking-wider">Pendapatan Toko</span>
            <span class="w-8 h-8 rounded-lg bg-moss/30 border border-ink grid place-items-center">
              <CircleDollarSign :size="16" class="text-ink" />
            </span>
          </div>
          <div class="mt-3">
            <strong class="font-head font-extrabold text-2xl sm:text-3xl text-ink block truncate tabular-nums">
              {{ loading ? '…' : currency(revenueAmount) }}
            </strong>
            <small class="text-xs font-semibold text-ink/50 mt-1 block">Penjualan produk berhasil</small>
          </div>
        </div>

        <!-- Stat 4: Pesanan Baru -->
        <div class="p-5 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430] flex flex-col justify-between hover:-translate-y-0.5 transition-all">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-ink/60 uppercase tracking-wider">Aktivitas Baru</span>
            <span class="w-8 h-8 rounded-lg bg-pinky/30 border border-ink grid place-items-center">
              <Sparkles :size="16" class="text-ink" />
            </span>
          </div>
          <div class="mt-3">
            <strong class="font-head font-extrabold text-2xl sm:text-3xl text-ink block tabular-nums">
              {{ loading ? '…' : recentOrders.length }}
            </strong>
            <small class="text-xs font-semibold text-ink/50 mt-1 block">Pesanan dalam antrean</small>
          </div>
        </div>
      </div>

      <!-- Main Section: 2 Columns (Orders Table & Quick Links) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Kolom Kiri (2 cols): Pesanan Terbaru -->
        <div class="lg:col-span-2 space-y-3">
          <div class="flex items-center justify-between pb-1">
            <h2 class="font-head font-bold text-lg sm:text-xl text-ink flex items-center gap-2">
              <ClipboardList :size="20" class="text-sun" />
              Pesanan Terbaru
            </h2>
            <RouterLink
              to="/admin/orders"
              class="text-xs sm:text-sm font-bold text-ink hover:text-sun flex items-center gap-1 transition-colors"
            >
              <span>Semua Pesanan</span>
              <ArrowUpRight :size="15" />
            </RouterLink>
          </div>

          <div class="border-2 border-ink rounded-2xl bg-white shadow-[4px_4px_0_#1B2430] overflow-hidden">
            <AdminState v-if="loading" kind="loading" message="Memuat pesanan..." />
            <AdminDataTable v-else :columns="columns" :rows="recentOrders">
              <template #order_number="{ row }">
                <span class="font-head font-bold text-ink text-xs sm:text-sm">
                  {{ orderCode(row) }}
                </span>
              </template>
              <template #customer="{ row }">
                <span class="font-semibold text-ink/80 text-xs sm:text-sm">
                  {{ customerName(row) }}
                </span>
              </template>
              <template #created_at="{ row }">
                <span class="text-xs text-ink/65 font-medium">
                  {{ dateLabel(row.created_at) }}
                </span>
              </template>
              <template #total="{ row }">
                <span class="font-head font-extrabold text-xs sm:text-sm text-ink">
                  {{ orderTotalValue(row) }}
                </span>
              </template>
              <template #status="{ row }">
                <AdminStatus :status="row.status" />
              </template>
              <template #empty>
                <AdminState kind="empty" message="Belum ada pesanan terbaru." />
              </template>
            </AdminDataTable>
          </div>
        </div>

        <!-- Kolom Kanan (1 col): Jalan Pintas & Catatan -->
        <div class="space-y-5">
          <!-- Panel Jalan Pintas -->
          <div class="p-5 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430]">
            <div class="pb-3 mb-3 border-b-2 border-ink/10">
              <h3 class="font-head font-bold text-base text-ink">Jalan Pintas</h3>
              <p class="text-xs font-semibold text-ink/60">Akses cepat menu operasional toko</p>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <RouterLink
                to="/admin/orders"
                class="p-3 rounded-xl border-2 border-ink bg-bg hover:bg-sun/20 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex flex-col justify-between"
              >
                <ClipboardList :size="18" class="text-ink mb-1.5" />
                <strong class="font-head font-bold text-xs text-ink block leading-tight">Kelola Pesanan</strong>
                <span class="text-[10px] text-ink/60 font-medium mt-0.5">Resi & status kirim</span>
              </RouterLink>

              <RouterLink
                to="/admin/products"
                class="p-3 rounded-xl border-2 border-ink bg-bg hover:bg-sun/20 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex flex-col justify-between"
              >
                <Boxes :size="18" class="text-ink mb-1.5" />
                <strong class="font-head font-bold text-xs text-ink block leading-tight">Katalog Produk</strong>
                <span class="text-[10px] text-ink/60 font-medium mt-0.5">Atur stok & harga</span>
              </RouterLink>

              <RouterLink
                to="/admin/pos"
                class="p-3 rounded-xl border-2 border-ink bg-bg hover:bg-sun/20 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex flex-col justify-between"
              >
                <Store :size="18" class="text-ink mb-1.5" />
                <strong class="font-head font-bold text-xs text-ink block leading-tight">Kasir POS</strong>
                <span class="text-[10px] text-ink/60 font-medium mt-0.5">Penjualan event</span>
              </RouterLink>

              <RouterLink
                to="/admin/revenue"
                class="p-3 rounded-xl border-2 border-ink bg-bg hover:bg-sun/20 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex flex-col justify-between"
              >
                <ChartNoAxesCombined :size="18" class="text-ink mb-1.5" />
                <strong class="font-head font-bold text-xs text-ink block leading-tight">Pendapatan</strong>
                <span class="text-[10px] text-ink/60 font-medium mt-0.5">Laporan omset toko</span>
              </RouterLink>

              <RouterLink
                to="/admin/users"
                class="p-3 rounded-xl border-2 border-ink bg-bg hover:bg-sun/20 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex flex-col justify-between"
              >
                <Users :size="18" class="text-ink mb-1.5" />
                <strong class="font-head font-bold text-xs text-ink block leading-tight">Staf & Admin</strong>
                <span class="text-[10px] text-ink/60 font-medium mt-0.5">Kelola pengguna</span>
              </RouterLink>

              <RouterLink
                to="/admin/profile"
                class="p-3 rounded-xl border-2 border-ink bg-bg hover:bg-sun/20 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex flex-col justify-between"
              >
                <UserCog :size="18" class="text-ink mb-1.5" />
                <strong class="font-head font-bold text-xs text-ink block leading-tight">Profil Saya</strong>
                <span class="text-[10px] text-ink/60 font-medium mt-0.5">Nama & kata sandi</span>
              </RouterLink>
            </div>
          </div>

          <!-- Card Catatan / Fokus Hari Ini -->
          <div class="p-4 rounded-2xl border-2 border-ink bg-sun/25 shadow-[4px_4px_0_#1B2430] flex gap-3.5 items-start">
            <span class="w-8 h-8 rounded-xl bg-sun border-2 border-ink grid place-items-center font-head font-extrabold text-sm text-ink shrink-0 shadow-[1px_1px_0_#1B2430]">
              M
            </span>
            <div>
              <strong class="font-head font-bold text-sm text-ink block">Fokus Hari Ini</strong>
              <p class="text-xs font-semibold text-ink/75 mt-1 leading-relaxed">
                Pastikan pesanan berstatus lunas segera dikemas dan nomor resi pengiriman dimasukkan ke sistem.
              </p>
              <RouterLink
                to="/admin/orders"
                class="inline-flex items-center gap-1 text-xs font-extrabold text-ink underline hover:text-amber-800 mt-2"
              >
                <span>Buka antrean pesanan</span>
                <ArrowUpRight :size="13" />
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

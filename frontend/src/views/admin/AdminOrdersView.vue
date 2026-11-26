<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCopy, PackageCheck, RefreshCw, RotateCcw, Search, Truck, X } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminDataTable from '@/components/ui/AdminDataTable.vue'
import AdminDialog from '@/components/ui/AdminDialog.vue'
import AdminStatus from '@/components/ui/AdminStatus.vue'
import AdminState from '@/components/ui/AdminState.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppDatePicker from '@/components/ui/AppDatePicker.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'

type OrderStatus = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled'
type DeliveryMethod = 'store' | 'courier' | 'custom'
type PaymentMethod = 'midtrans' | 'cash'

interface AdminOrderItem {
  id: number
  product_name: string
  sku?: string
  price: string | number
  quantity: number
  subtotal: string | number
}

interface AdminOrder {
  id: number
  order_number: string
  status: OrderStatus
  delivery_method: DeliveryMethod
  delivery_note?: string | null
  tracking_number?: string | null
  recipient_name: string
  recipient_phone: string
  shipping_address?: string | null
  payment_method: PaymentMethod
  paid_at?: string | null
  midtrans_transaction_id?: string | null
  subtotal: string | number
  shipping_cost: string | number
  total: string | number
  items?: AdminOrderItem[]
  user_email?: string | null
  created_at: string
  updated_at?: string
}

interface OrderPage { items: AdminOrder[]; total: number; page: number; size: number; pages: number; has_next: boolean; has_prev: boolean }

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending_payment', label: 'Menunggu bayar' },
  { value: 'paid', label: 'Dibayar' },
  { value: 'processing', label: 'Diproses' },
  { value: 'shipped', label: 'Dikirim' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
]
const DELIVERY_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: 'store', label: 'Ambil di toko' },
  { value: 'courier', label: 'Dikirim kurir' },
  { value: 'custom', label: 'Custom / event' },
]

const statusSelectOptions = computed(() => [
  { value: '', label: 'Semua status' },
  ...STATUS_OPTIONS,
])

const deliverySelectOptions = computed(() => [
  { value: '', label: 'Semua pengiriman' },
  ...DELIVERY_OPTIONS,
])
const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  paid: { status: 'processing', label: 'Proses pesanan' },
  processing: { status: 'shipped', label: 'Kirim pesanan' },
  shipped: { status: 'completed', label: 'Selesaikan pesanan' },
}

const rows = ref<AdminOrder[]>([])
const pageInfo = ref<OrderPage>({ items: [], total: 0, page: 1, size: 20, pages: 0, has_next: false, has_prev: false })
const page = ref(1)
const search = ref('')
const statusFilter = ref('')
const deliveryFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const loading = ref(true)
const error = ref('')
const notice = ref('')

const detailOpen = ref(false)
const selected = ref<AdminOrder | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const actionBusy = ref(false)
const trackingInput = ref('')

const columns = [
  { key: 'order_number', label: 'Pesanan' },
  { key: 'customer', label: 'Pelanggan' },
  { key: 'created_at', label: 'Tanggal' },
  { key: 'total', label: 'Total', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'tracking', label: 'Resi' },
  { key: 'actions', label: '' },
]

const showingRange = computed(() => {
  if (!pageInfo.value.total) return '0 pesanan'
  const first = (pageInfo.value.page - 1) * pageInfo.value.size + 1
  const last = Math.min(pageInfo.value.page * pageInfo.value.size, pageInfo.value.total)
  return `${first}–${last} dari ${pageInfo.value.total.toLocaleString('id-ID')} pesanan`
})
const hasActiveFilters = computed(() => Boolean(search.value.trim()) || Boolean(statusFilter.value) || Boolean(deliveryFilter.value) || Boolean(dateFrom.value) || Boolean(dateTo.value))

const nextStatus = computed(() => (selected.value ? NEXT_STATUS[selected.value.status] : undefined))
const canMarkPaid = computed(() => selected.value?.status === 'pending_payment' && selected.value.payment_method === 'cash')
const canCheckMidtrans = computed(() => selected.value?.payment_method === 'midtrans')
const canCancel = computed(() => Boolean(selected.value && ['pending_payment', 'paid', 'processing'].includes(selected.value.status)))
const canEditTracking = computed(() => Boolean(selected.value && !['pending_payment', 'cancelled'].includes(selected.value.status)))

let searchTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(1), 380)
}
function runSearch() {
  clearTimeout(searchTimer)
  load(1)
}
function clearSearch() {
  search.value = ''
  runSearch()
}
function resetFilters() {
  search.value = ''
  statusFilter.value = ''
  deliveryFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  runSearch()
}
onBeforeUnmount(() => clearTimeout(searchTimer))

async function load(nextPage = 1) {
  page.value = nextPage
  loading.value = true
  error.value = ''
  try {
    const data = await adminApi.orders({
      page: nextPage,
      size: pageInfo.value.size,
      q: search.value.trim() || undefined,
      status: statusFilter.value || undefined,
      delivery_method: deliveryFilter.value || undefined,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
    }) as OrderPage
    rows.value = data.items || []
    pageInfo.value = { ...pageInfo.value, ...data }
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Daftar pesanan gagal dimuat.'
  } finally {
    loading.value = false
  }
}

/* ---------- Format ---------- */
function money(value: unknown) {
  return new Intl.NumberFormat(import.meta.env.VITE_LOCALE || 'id-ID', {
    style: 'currency',
    currency: import.meta.env.VITE_CURRENCY || 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}
function date(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(import.meta.env.VITE_LOCALE || 'id-ID', {
    dateStyle: 'medium',
    timeZone: import.meta.env.VITE_TIMEZONE || 'Asia/Jakarta',
  }).format(new Date(value))
}
function dateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(import.meta.env.VITE_LOCALE || 'id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: import.meta.env.VITE_TIMEZONE || 'Asia/Jakarta',
  }).format(new Date(value))
}
function deliveryLabel(value?: DeliveryMethod) {
  return DELIVERY_OPTIONS.find((item) => item.value === value)?.label || '—'
}
function paymentLabel(value?: PaymentMethod) {
  return value === 'cash' ? 'Tunai' : value === 'midtrans' ? 'Midtrans' : '—'
}
function itemCount(order: AdminOrder) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

/* ---------- Detail ---------- */
async function openOrder(order: AdminOrder) {
  selected.value = order
  detailOpen.value = true
  detailError.value = ''
  trackingInput.value = order.tracking_number || ''
  detailLoading.value = true
  try {
    const fresh = await adminApi.order(order.id) as AdminOrder
    replaceOrder(fresh)
  } catch (cause) {
    detailError.value = cause instanceof ApiError ? cause.message : 'Detail pesanan gagal dimuat.'
  } finally {
    detailLoading.value = false
  }
}

function replaceOrder(order: AdminOrder) {
  selected.value = order
  trackingInput.value = order.tracking_number || ''
  const index = rows.value.findIndex((row) => row.id === order.id)
  if (index >= 0) rows.value[index] = order
}

async function copyNumber() {
  if (!selected.value) return
  try {
    await navigator.clipboard.writeText(selected.value.order_number)
    notice.value = 'Nomor pesanan disalin.'
  } catch {
    notice.value = 'Nomor pesanan tidak bisa disalin otomatis.'
  }
}

function confirmCancel(order: AdminOrder) {
  return window.confirm(`Batalkan pesanan ${order.order_number}? Stok produk akan dikembalikan otomatis.`)
}

async function transition(status: OrderStatus) {
  if (!selected.value) return
  if (status === 'cancelled' && !confirmCancel(selected.value)) return
  actionBusy.value = true
  detailError.value = ''
  notice.value = ''
  try {
    const updated = await adminApi.setOrderStatus(selected.value.id, status) as AdminOrder
    replaceOrder(updated)
    notice.value = status === 'cancelled' ? 'Pesanan dibatalkan dan stok dikembalikan.' : 'Status pesanan diperbarui.'
    await load(page.value)
  } catch (cause) {
    detailError.value = cause instanceof ApiError ? cause.message : 'Status pesanan gagal diubah.'
  } finally {
    actionBusy.value = false
  }
}

async function markPaid() {
  if (!selected.value) return
  actionBusy.value = true
  detailError.value = ''
  notice.value = ''
  try {
    const updated = await adminApi.markPaid(selected.value.id) as AdminOrder
    replaceOrder(updated)
    notice.value = 'Pesanan ditandai lunas.'
    await load(page.value)
  } catch (cause) {
    detailError.value = cause instanceof ApiError ? cause.message : 'Pesanan gagal ditandai lunas.'
  } finally {
    actionBusy.value = false
  }
}

async function checkMidtransStatus() {
  if (!selected.value) return
  actionBusy.value = true
  detailError.value = ''
  notice.value = ''
  try {
    const res = await adminApi.syncMidtrans(selected.value.id) as {
      order?: AdminOrder
      is_settled: boolean
      message?: string
      transaction_status?: string
      fraud_status?: string
      transaction_id?: string
    }
    if (res.order) {
      replaceOrder(res.order)
    }
    notice.value = res.is_settled
      ? 'Pembayaran terverifikasi LUNAS di Midtrans!'
      : `Status Midtrans: ${res.message || res.transaction_status || 'Belum dibayar'}`
    await load(page.value)
  } catch (cause) {
    detailError.value = cause instanceof ApiError ? cause.message : 'Gagal memeriksa status ke Midtrans.'
  } finally {
    actionBusy.value = false
  }
}


async function saveTracking() {
  if (!selected.value) return
  const value = trackingInput.value.trim()
  if (value.length < 3) {
    detailError.value = 'Nomor resi minimal 3 karakter.'
    return
  }
  actionBusy.value = true
  detailError.value = ''
  notice.value = ''
  try {
    const updated = await adminApi.setTracking(selected.value.id, value) as AdminOrder
    replaceOrder(updated)
    notice.value = 'Nomor resi disimpan.'
    await load(page.value)
  } catch (cause) {
    detailError.value = cause instanceof ApiError ? cause.message : 'Nomor resi gagal disimpan.'
  } finally {
    actionBusy.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-4">
    <AdminPageHeader title="Pesanan" description="Pantau pembayaran, proses pesanan, simpan nomor resi, dan selesaikan transaksi.">
      <AdminButton variant="secondary" :disabled="loading" @click="load(page)"><RefreshCw :size="15" :class="{ 'animate-spin': loading }" /> Muat ulang</AdminButton>
    </AdminPageHeader>

    <div v-if="notice" class="rounded-xl border-2 border-mint/40 bg-mint/20 px-3.5 py-2.5 text-xs font-bold text-ink" role="status">{{ notice }}</div>
    <div v-if="error && !loading" class="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs font-bold text-destructive" role="alert">{{ error }}</div>

    <section class="admin-panel overflow-hidden" aria-label="Daftar pesanan">
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-4 py-3 sm:px-5 sm:py-3.5">
        <div>
          <h2 class="font-head text-base font-bold text-ink">Semua pesanan</h2>
          <p class="mt-0.5 text-xs font-semibold text-muted-foreground" aria-live="polite">{{ loading && !rows.length ? 'Memuat…' : showingRange }}</p>
        </div>
        <span class="rounded-full border border-ink/15 bg-ink/5 px-2.5 py-0.5 text-[11px] font-bold text-ink/75 whitespace-nowrap">{{ pageInfo.total.toLocaleString('id-ID') }} pesanan</span>
      </header>

      <form class="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-[#fdfcf8] p-3 sm:px-4" role="search" @submit.prevent="runSearch">
        <div class="relative flex flex-1 items-center gap-2 min-w-[220px] max-w-[360px] h-[38px] rounded-lg border border-ink/20 bg-white px-2.5 text-muted-foreground focus-within:border-sun focus-within:ring-2 focus-within:ring-sun/30">
          <Search :size="16" aria-hidden="true" class="shrink-0 text-muted-foreground" />
          <label class="sr-only" for="admin-order-search">Cari nomor pesanan, nama, telepon, atau email</label>
          <input
            id="admin-order-search"
            v-model="search"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            placeholder="Cari nomor, nama, telepon, email"
            class="w-full h-full border-0 bg-transparent text-xs font-semibold text-ink placeholder:text-muted-foreground/60 focus:outline-none"
            @input="scheduleSearch"
          />
          <button v-if="search" type="button" class="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink/10 text-ink/70 hover:bg-ink/20 transition-colors" aria-label="Hapus pencarian" @click="clearSearch">
            <X :size="12" />
          </button>
        </div>

        <div class="min-w-[145px]">
          <span class="sr-only">Status pesanan</span>
          <AppSelect
            v-model="statusFilter"
            :options="statusSelectOptions"
            variant="admin"
            size="sm"
            aria-label="Filter status pesanan"
            @change="runSearch"
          />
        </div>

        <div class="min-w-[155px]">
          <span class="sr-only">Metode pengiriman</span>
          <AppSelect
            v-model="deliveryFilter"
            :options="deliverySelectOptions"
            variant="admin"
            size="sm"
            aria-label="Filter metode pengiriman"
            @change="runSearch"
          />
        </div>

        <div class="flex items-center gap-1.5 min-w-[130px]">
          <span class="text-[11px] font-bold text-muted-foreground uppercase">Dari</span>
          <AppDatePicker
            v-model="dateFrom"
            variant="admin"
            size="sm"
            placeholder="Mulai"
            aria-label="Tanggal mulai"
            @change="runSearch"
          />
        </div>
        <div class="flex items-center gap-1.5 min-w-[130px]">
          <span class="text-[11px] font-bold text-muted-foreground uppercase">Sampai</span>
          <AppDatePicker
            v-model="dateTo"
            variant="admin"
            size="sm"
            placeholder="Sampai"
            aria-label="Tanggal akhir"
            @change="runSearch"
          />
        </div>

        <button v-if="hasActiveFilters" type="button" class="inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border border-ink/20 bg-white px-2.5 font-body text-xs font-bold text-ink hover:bg-banner-sun transition-colors" @click="resetFilters">
          <RotateCcw :size="13" /> Reset
        </button>
      </form>

      <AdminState v-if="loading && !rows.length" kind="loading" message="Memuat pesanan…" />
      <AdminState v-else-if="error && !rows.length" kind="error" :message="error" @retry="load(page)" />
      <div v-else-if="!rows.length" class="grid justify-items-center gap-2 p-10 text-center text-muted-foreground">
        <PackageCheck :size="24" class="text-ink/40" />
        <strong class="font-head text-base font-bold text-ink">{{ hasActiveFilters ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan masuk' }}</strong>
        <span class="max-w-[36ch] text-xs leading-relaxed text-muted-foreground">{{ hasActiveFilters ? 'Coba kata kunci atau filter lain.' : 'Pesanan dari toko dan kasir akan muncul di sini.' }}</span>
        <button v-if="hasActiveFilters" type="button" class="inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border border-ink/20 bg-white px-3 font-body text-xs font-bold text-ink hover:bg-banner-sun transition-colors" @click="resetFilters">
          <RotateCcw :size="13" /> Reset pencarian &amp; filter
        </button>
      </div>

      <div v-else :class="{ 'opacity-60 transition-opacity': loading }" :aria-busy="loading">
        <AdminDataTable :columns="columns" :rows="rows" row-key="id">
          <template #order_number="{ row }">
            <span class="grid gap-0.5 min-w-0">
              <strong class="font-bold text-xs text-ink">{{ row.order_number }}</strong>
              <small class="text-[11px] font-semibold text-muted-foreground">{{ itemCount(row) }} item · {{ paymentLabel(row.payment_method) }}</small>
            </span>
          </template>
          <template #customer="{ row }">
            <span class="grid gap-0.5 min-w-0">
              <strong class="font-bold text-xs text-ink">{{ row.recipient_name || 'Pembeli' }}</strong>
              <small class="max-w-[200px] truncate text-[11px] font-semibold text-muted-foreground">{{ row.recipient_phone || row.user_email || 'Tanpa kontak' }}</small>
            </span>
          </template>
          <template #created_at="{ row }">
            <span class="text-xs font-semibold text-muted-foreground">{{ date(row.created_at) }}</span>
          </template>
          <template #total="{ row }">
            <span class="grid gap-0.5 justify-items-end min-w-0">
              <strong class="font-bold text-xs text-ink tabular-nums">{{ money(row.total) }}</strong>
              <small class="text-[11px] font-semibold text-muted-foreground">{{ deliveryLabel(row.delivery_method) }}</small>
            </span>
          </template>
          <template #status="{ row }"><AdminStatus :status="row.status" /></template>
          <template #tracking="{ row }">
            <span v-if="row.tracking_number" class="font-mono text-xs font-semibold text-ink/80">{{ row.tracking_number }}</span>
            <span v-else class="text-xs text-muted-foreground">Belum ada</span>
          </template>
          <template #actions="{ row }">
            <button type="button" class="inline-flex h-[30px] cursor-pointer items-center rounded-lg border border-ink/20 bg-white px-2.5 text-xs font-bold text-ink hover:bg-ink/5 transition-colors" @click="openOrder(row)">Detail</button>
          </template>
          <template #empty><AdminState kind="empty" message="Belum ada pesanan masuk." /></template>
        </AdminDataTable>
      </div>

      <footer v-if="pageInfo.pages > 1" class="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 bg-[#fdfcf8] px-4 py-3 text-xs text-muted-foreground">
        <span>Halaman {{ pageInfo.page }} dari {{ pageInfo.pages }}</span>
        <div class="flex gap-2">
          <AdminButton variant="secondary" :disabled="!pageInfo.has_prev || loading" @click="load(pageInfo.page - 1)"><ChevronLeft :size="15" /> Sebelumnya</AdminButton>
          <AdminButton variant="secondary" :disabled="!pageInfo.has_next || loading" @click="load(pageInfo.page + 1)">Berikutnya <ChevronRight :size="15" /></AdminButton>
        </div>
      </footer>
    </section>

    <AdminDialog
      v-model="detailOpen"
      :title="selected ? selected.order_number : 'Detail pesanan'"
      :description="selected ? `Dibuat ${dateTime(selected.created_at)}` : undefined"
    >
      <div v-if="selected" class="grid gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/15 bg-[#fbf8f0] p-3">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Status pesanan</span>
            <AdminStatus :status="selected.status" />
          </div>
          <button type="button" class="inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border border-ink/20 bg-white px-2.5 text-xs font-bold text-ink/80 hover:bg-ink/5 transition-colors" @click="copyNumber">
            <ClipboardCopy :size="13" /> Salin nomor
          </button>
        </div>

        <AdminState v-if="detailLoading" kind="loading" message="Menyegarkan detail pesanan…" />
        <AdminState v-if="detailError" kind="error" :message="detailError" />

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <section class="rounded-xl border border-ink/15 bg-white p-3">
            <h3 class="mb-2 font-head text-xs font-bold uppercase tracking-wider text-muted-foreground">Pelanggan</h3>
            <dl class="space-y-1.5 text-xs">
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama</dt><dd class="font-semibold text-ink">{{ selected.recipient_name || '—' }}</dd></div>
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Telepon</dt><dd class="font-semibold text-ink">{{ selected.recipient_phone || '—' }}</dd></div>
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</dt><dd class="font-semibold text-ink break-all">{{ selected.user_email || '—' }}</dd></div>
            </dl>
          </section>

          <section class="rounded-xl border border-ink/15 bg-white p-3">
            <h3 class="mb-2 font-head text-xs font-bold uppercase tracking-wider text-muted-foreground">Pengiriman</h3>
            <dl class="space-y-1.5 text-xs">
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metode</dt><dd class="font-semibold text-ink">{{ deliveryLabel(selected.delivery_method) }}</dd></div>
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alamat</dt><dd class="font-semibold text-ink leading-snug">{{ selected.shipping_address || '—' }}</dd></div>
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Catatan</dt><dd class="font-semibold text-ink leading-snug">{{ selected.delivery_note || '—' }}</dd></div>
            </dl>
          </section>

          <section class="rounded-xl border border-ink/15 bg-white p-3">
            <h3 class="mb-2 font-head text-xs font-bold uppercase tracking-wider text-muted-foreground">Pembayaran</h3>
            <dl class="space-y-1.5 text-xs">
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metode</dt><dd class="font-semibold text-ink">{{ paymentLabel(selected.payment_method) }}</dd></div>
              <div v-if="selected.midtrans_transaction_id" class="grid gap-0.5">
                <dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID Transaksi Midtrans</dt>
                <dd class="font-mono text-[11px] font-bold text-ink/80">{{ selected.midtrans_transaction_id }}</dd>
              </div>
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dibayar</dt><dd class="font-semibold text-ink">{{ selected.paid_at ? dateTime(selected.paid_at) : 'Belum dibayar' }}</dd></div>
              <div class="grid gap-0.5"><dt class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</dt><dd class="font-head text-sm font-bold text-ink tabular-nums">{{ money(selected.total) }}</dd></div>
            </dl>
          </section>
        </div>

        <section class="rounded-xl border border-ink/15 bg-white p-3 sm:p-4">
          <h3 class="mb-2 font-head text-xs font-bold uppercase tracking-wider text-muted-foreground">Item pesanan</h3>
          <ul class="divide-y divide-dashed divide-ink/15 space-y-2">
            <li v-for="item in selected.items || []" :key="item.id" class="flex items-start justify-between gap-3 pt-2 text-xs">
              <div class="grid gap-0.5 min-w-0">
                <span class="font-bold text-ink">{{ item.product_name }}</span>
                <small class="text-[11px] font-semibold text-muted-foreground">{{ item.quantity }} × {{ money(item.price) }}</small>
              </div>
              <strong class="shrink-0 font-bold text-ink tabular-nums">{{ money(item.subtotal) }}</strong>
            </li>
            <li v-if="!(selected.items || []).length" class="text-xs text-muted-foreground py-2">Belum ada item pada pesanan ini.</li>
          </ul>
          <dl class="mt-3 pt-2.5 border-t border-ink/15 space-y-1 text-xs text-muted-foreground">
            <div class="flex justify-between"><span>Subtotal</span><span class="font-semibold text-ink tabular-nums">{{ money(selected.subtotal) }}</span></div>
            <div class="flex justify-between"><span>Ongkir</span><span class="font-semibold text-ink tabular-nums">{{ money(selected.shipping_cost) }}</span></div>
            <div class="flex justify-between pt-2 border-t border-dashed border-ink/20 font-head text-sm font-bold text-ink"><span>Total</span><span class="tabular-nums">{{ money(selected.total) }}</span></div>
          </dl>
        </section>

        <section v-if="canEditTracking" class="rounded-xl border border-ink/15 bg-[#fbfaf5] p-3 sm:p-4">
          <h3 class="mb-2 font-head text-xs font-bold uppercase tracking-wider text-muted-foreground">Nomor resi</h3>
          <form v-if="selected.delivery_method === 'courier' || selected.tracking_number" class="flex flex-col sm:flex-row gap-2" @submit.prevent="saveTracking">
            <label class="flex flex-1 items-center gap-2 h-[38px] rounded-lg border border-ink/20 bg-white px-3 text-muted-foreground focus-within:border-sun focus-within:ring-2 focus-within:ring-sun/30">
              <Truck :size="15" class="shrink-0" />
              <input v-model="trackingInput" type="text" maxlength="100" autocomplete="off" placeholder="Contoh: JP1234567890" class="w-full border-0 bg-transparent font-mono text-xs font-bold text-ink placeholder:text-muted-foreground/60 focus:outline-none" />
            </label>
            <AdminButton type="submit" variant="secondary" :disabled="actionBusy">Simpan resi</AdminButton>
          </form>
          <p v-else class="text-xs text-muted-foreground">Pesanan ini tidak memakai kurir, jadi nomor resi tidak diperlukan.</p>
        </section>
      </div>

      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <AdminButton variant="secondary" :disabled="actionBusy" @click="detailOpen = false">Tutup</AdminButton>
          <button v-if="canCancel" type="button" class="inline-flex h-[36px] items-center justify-center rounded-lg border border-destructive/30 bg-white px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors" :disabled="actionBusy" @click="transition('cancelled')">Batalkan pesanan</button>
          <AdminButton v-if="canCheckMidtrans" variant="secondary" :disabled="actionBusy" @click="checkMidtransStatus">
            <RefreshCw :size="14" :class="{ 'animate-spin': actionBusy }" /> {{ actionBusy ? 'Memeriksa Midtrans…' : 'Cek Status Midtrans' }}
          </AdminButton>
          <AdminButton v-if="canMarkPaid" variant="primary" :disabled="actionBusy" @click="markPaid">
            <CheckCircle2 :size="15" /> {{ actionBusy ? 'Menyimpan…' : 'Tandai lunas' }}
          </AdminButton>
          <AdminButton v-else-if="nextStatus" variant="primary" :disabled="actionBusy" @click="transition(nextStatus.status)">
            {{ actionBusy ? 'Menyimpan…' : nextStatus.label }}
          </AdminButton>
        </div>
      </template>
    </AdminDialog>
  </div>
</template>


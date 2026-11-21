<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCopy, PackageCheck, RefreshCw, RotateCcw, Search, Truck, X } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminDataTable from '@/components/ui/AdminDataTable.vue'
import AdminDialog from '@/components/ui/AdminDialog.vue'
import AdminStatus from '@/components/ui/AdminStatus.vue'
import AdminState from '@/components/ui/AdminState.vue'
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
  <div class="admin-orders-page">
    <AdminPageHeader title="Pesanan" description="Pantau pembayaran, proses pesanan, simpan nomor resi, dan selesaikan transaksi.">
      <AdminButton variant="secondary" :disabled="loading" @click="load(page)"><RefreshCw :size="15" :class="{ 'is-spinning': loading }" /> Muat ulang</AdminButton>
    </AdminPageHeader>

    <div v-if="notice" class="admin-orders-alert admin-orders-alert--ok" role="status">{{ notice }}</div>
    <div v-if="error && !loading" class="admin-orders-alert" role="alert">{{ error }}</div>

    <section class="admin-panel admin-orders-panel" aria-label="Daftar pesanan">
      <header class="admin-panel__header admin-orders-head">
        <div>
          <h2>Semua pesanan</h2>
          <p aria-live="polite">{{ loading && !rows.length ? 'Memuat…' : showingRange }}</p>
        </div>
        <span class="admin-orders-total">{{ pageInfo.total.toLocaleString('id-ID') }} pesanan</span>
      </header>

      <form class="admin-order-toolbar" role="search" @submit.prevent="runSearch">
        <div class="admin-order-search">
          <Search :size="16" aria-hidden="true" class="admin-order-search__icon" />
          <label class="sr-only" for="admin-order-search">Cari nomor pesanan, nama, telepon, atau email</label>
          <input
            id="admin-order-search"
            v-model="search"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            placeholder="Cari nomor, nama, telepon, email"
            @input="scheduleSearch"
          />
          <button v-if="search" type="button" class="admin-order-search__clear" aria-label="Hapus pencarian" @click="clearSearch">
            <X :size="14" />
          </button>
        </div>

        <label class="admin-order-filter">
          <span class="sr-only">Status pesanan</span>
          <select v-model="statusFilter" aria-label="Filter status pesanan" @change="runSearch">
            <option value="">Semua status</option>
            <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label class="admin-order-filter">
          <span class="sr-only">Metode pengiriman</span>
          <select v-model="deliveryFilter" aria-label="Filter metode pengiriman" @change="runSearch">
            <option value="">Semua pengiriman</option>
            <option v-for="option in DELIVERY_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label class="admin-order-date">
          <span>Dari</span>
          <input v-model="dateFrom" type="date" aria-label="Tanggal mulai" @change="runSearch" />
        </label>
        <label class="admin-order-date">
          <span>Sampai</span>
          <input v-model="dateTo" type="date" aria-label="Tanggal akhir" @change="runSearch" />
        </label>

        <button v-if="hasActiveFilters" type="button" class="admin-order-reset" @click="resetFilters">
          <RotateCcw :size="13" /> Reset
        </button>
      </form>

      <AdminState v-if="loading && !rows.length" kind="loading" message="Memuat pesanan…" />
      <AdminState v-else-if="error && !rows.length" kind="error" :message="error" @retry="load(page)" />
      <div v-else-if="!rows.length" class="admin-orders-empty">
        <PackageCheck :size="22" />
        <strong>{{ hasActiveFilters ? 'Tidak ada pesanan yang cocok' : 'Belum ada pesanan masuk' }}</strong>
        <span>{{ hasActiveFilters ? 'Coba kata kunci atau filter lain.' : 'Pesanan dari toko dan kasir akan muncul di sini.' }}</span>
        <button v-if="hasActiveFilters" type="button" class="admin-order-reset" @click="resetFilters">
          <RotateCcw :size="13" /> Reset pencarian &amp; filter
        </button>
      </div>

      <div v-else class="admin-order-results" :class="{ 'is-refreshing': loading }" :aria-busy="loading">
        <AdminDataTable :columns="columns" :rows="rows" row-key="id">
          <template #order_number="{ row }">
            <span class="admin-order-number">
              <strong>{{ row.order_number }}</strong>
              <small>{{ itemCount(row) }} item · {{ paymentLabel(row.payment_method) }}</small>
            </span>
          </template>
          <template #customer="{ row }">
            <span class="admin-order-customer">
              <strong>{{ row.recipient_name || 'Pembeli' }}</strong>
              <small>{{ row.recipient_phone || row.user_email || 'Tanpa kontak' }}</small>
            </span>
          </template>
          <template #created_at="{ row }">
            <span class="admin-order-date-cell">{{ date(row.created_at) }}</span>
          </template>
          <template #total="{ row }">
            <span class="admin-order-total-cell">
              <strong>{{ money(row.total) }}</strong>
              <small>{{ deliveryLabel(row.delivery_method) }}</small>
            </span>
          </template>
          <template #status="{ row }"><AdminStatus :status="row.status" /></template>
          <template #tracking="{ row }">
            <span v-if="row.tracking_number" class="admin-order-tracking">{{ row.tracking_number }}</span>
            <span v-else class="admin-cell-sub">Belum ada</span>
          </template>
          <template #actions="{ row }">
            <button type="button" class="admin-order-detail" @click="openOrder(row)">Detail</button>
          </template>
          <template #empty><AdminState kind="empty" message="Belum ada pesanan masuk." /></template>
        </AdminDataTable>
      </div>

      <footer v-if="pageInfo.pages > 1" class="admin-order-pagination">
        <span>Halaman {{ pageInfo.page }} dari {{ pageInfo.pages }}</span>
        <div>
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
      <div v-if="selected" class="order-detail">
        <div class="order-detail__banner">
          <div>
            <span class="order-detail__label">Status pesanan</span>
            <AdminStatus :status="selected.status" />
          </div>
          <button type="button" class="order-detail__copy" @click="copyNumber"><ClipboardCopy :size="14" /> Salin nomor</button>
        </div>

        <AdminState v-if="detailLoading" kind="loading" message="Menyegarkan detail pesanan…" />
        <AdminState v-if="detailError" kind="error" :message="detailError" />

        <div class="order-detail__grid">
          <section class="order-detail__card">
            <h3>Pelanggan</h3>
            <dl>
              <div><dt>Nama</dt><dd>{{ selected.recipient_name || '—' }}</dd></div>
              <div><dt>Telepon</dt><dd>{{ selected.recipient_phone || '—' }}</dd></div>
              <div><dt>Email</dt><dd>{{ selected.user_email || '—' }}</dd></div>
            </dl>
          </section>

          <section class="order-detail__card">
            <h3>Pengiriman</h3>
            <dl>
              <div><dt>Metode</dt><dd>{{ deliveryLabel(selected.delivery_method) }}</dd></div>
              <div><dt>Alamat</dt><dd>{{ selected.shipping_address || '—' }}</dd></div>
              <div><dt>Catatan</dt><dd>{{ selected.delivery_note || '—' }}</dd></div>
            </dl>
          </section>

          <section class="order-detail__card">
            <h3>Pembayaran</h3>
            <dl>
              <div><dt>Metode</dt><dd>{{ paymentLabel(selected.payment_method) }}</dd></div>
              <div><dt>Dibayar</dt><dd>{{ selected.paid_at ? dateTime(selected.paid_at) : 'Belum dibayar' }}</dd></div>
              <div><dt>Total</dt><dd class="order-detail__grand">{{ money(selected.total) }}</dd></div>
            </dl>
          </section>
        </div>

        <section class="order-detail__items">
          <h3>Item pesanan</h3>
          <ul>
            <li v-for="item in selected.items || []" :key="item.id">
              <span class="order-detail__item-name">{{ item.product_name }}<small>{{ item.quantity }} × {{ money(item.price) }}</small></span>
              <strong>{{ money(item.subtotal) }}</strong>
            </li>
            <li v-if="!(selected.items || []).length" class="order-detail__item-empty">Belum ada item pada pesanan ini.</li>
          </ul>
          <dl class="order-detail__totals">
            <div><dt>Subtotal</dt><dd>{{ money(selected.subtotal) }}</dd></div>
            <div><dt>Ongkir</dt><dd>{{ money(selected.shipping_cost) }}</dd></div>
            <div class="is-grand"><dt>Total</dt><dd>{{ money(selected.total) }}</dd></div>
          </dl>
        </section>

        <section v-if="canEditTracking" class="order-detail__tracking">
          <h3>Nomor resi</h3>
          <form v-if="selected.delivery_method === 'courier' || selected.tracking_number" class="order-tracking-form" @submit.prevent="saveTracking">
            <label class="order-tracking-field">
              <span class="sr-only">Nomor resi pengiriman</span>
              <Truck :size="15" aria-hidden="true" />
              <input v-model="trackingInput" type="text" maxlength="100" autocomplete="off" placeholder="Contoh: JP1234567890" />
            </label>
            <AdminButton type="submit" variant="secondary" :disabled="actionBusy">Simpan resi</AdminButton>
          </form>
          <p v-else class="order-detail__hint">Pesanan ini tidak memakai kurir, jadi nomor resi tidak diperlukan.</p>
        </section>
      </div>

      <template #footer>
        <div class="order-dialog-footer">
          <AdminButton variant="secondary" :disabled="actionBusy" @click="detailOpen = false">Tutup</AdminButton>
          <button v-if="canCancel" type="button" class="order-danger-button" :disabled="actionBusy" @click="transition('cancelled')">Batalkan pesanan</button>
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

<style scoped>
.admin-orders-panel {
  overflow: hidden;
}

.admin-orders-head {
  padding: 15px 18px;
}

.admin-orders-head h2 {
  font-size: 16px;
}

.admin-orders-head p {
  margin: 3px 0 0;
  color: #68717b;
  font-size: 12px;
}

.admin-orders-total {
  padding: 3px 9px;
  border-radius: 999px;
  background: #f3efe5;
  color: #6d6450;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.admin-orders-alert {
  margin-bottom: 14px;
  padding: 10px 13px;
  border: 1px solid #e4c3bc;
  border-radius: 8px;
  background: #fbefec;
  color: #8a453a;
  font-size: 12.5px;
  font-weight: 600;
}

.admin-orders-alert--ok {
  border-color: #c6ddc9;
  background: #eef5ef;
  color: #2f5b38;
}

/* ---------- Toolbar ---------- */
.admin-order-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 13px 16px;
  border-bottom: 1px solid #e8e5dd;
  background: #fdfcf8;
}

.admin-order-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 240px;
  max-width: 380px;
  height: 38px;
  padding: 0 6px 0 11px;
  border: 1px solid #ddd9ce;
  border-radius: 8px;
  background: #fff;
  color: #69727c;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.admin-order-search:focus-within {
  border-color: #c4a24a;
  box-shadow: 0 0 0 3px #f6e6b3;
  outline: none;
}

.admin-order-search__icon {
  flex: none;
}

.admin-order-search input {
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1b2430;
  font: 400 13px var(--font-body);
}

.admin-order-search input::-webkit-search-cancel-button {
  display: none;
}

.admin-order-search__clear {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: #efece4;
  color: #5f6770;
  cursor: pointer;
}

.admin-order-search__clear:hover {
  background: #e6e1d5;
  color: #1b2430;
}

.admin-order-filter select {
  height: 38px;
  max-width: 168px;
  padding: 0 28px 0 10px;
  border: 1px solid #ddd9ce;
  border-radius: 8px;
  background: #fff;
  color: #3f4852;
  font: 600 12px var(--font-body);
}

.admin-order-filter select:focus-visible,
.admin-order-date input:focus-visible {
  outline: 3px solid #f1d98f;
  outline-offset: 1px;
}

.admin-order-date {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 38px;
  padding: 0 8px;
  border: 1px solid #ddd9ce;
  border-radius: 8px;
  background: #fff;
}

.admin-order-date span {
  color: #828a93;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.admin-order-date input {
  width: 118px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #3f4852;
  font: 600 12px var(--font-body);
}

.admin-order-reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #ddd9ce;
  border-radius: 7px;
  background: #fff;
  color: #6a4a00;
  font: 700 11.5px var(--font-body);
  cursor: pointer;
}

.admin-order-reset:hover {
  background: #fff6dc;
  border-color: #d9bf7c;
}

/* ---------- Sel tabel ---------- */
.admin-order-results.is-refreshing {
  opacity: 0.6;
  transition: opacity 0.15s;
}

.admin-order-number,
.admin-order-customer,
.admin-order-total-cell {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.admin-order-number strong {
  font-weight: 800;
  letter-spacing: 0.01em;
}

.admin-order-number small,
.admin-order-customer small,
.admin-order-total-cell small {
  color: #7c858e;
  font-size: 11px;
}

.admin-order-customer strong {
  font-weight: 700;
}

.admin-order-customer small {
  overflow: hidden;
  max-width: 220px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.admin-order-total-cell {
  justify-items: end;
}

.admin-order-total-cell strong {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.admin-order-tracking {
  font: 600 11.5px ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #415668;
}

.admin-order-detail {
  height: 30px;
  padding: 0 11px;
  border: 1px solid #ddd9ce;
  border-radius: 7px;
  background: #fff;
  color: #3f4852;
  font: 700 11.5px var(--font-body);
  cursor: pointer;
}

.admin-order-detail:hover {
  background: #f6f3ea;
  border-color: #cfc6ae;
}

.admin-orders-empty {
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 40px 20px;
  color: #68717b;
  text-align: center;
}

.admin-orders-empty strong {
  color: #1b2430;
  font: 600 15px var(--font-head);
}

.admin-orders-empty span {
  max-width: 36ch;
  font-size: 12.5px;
  line-height: 1.55;
}

.admin-order-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-top: 1px solid #e8e5dd;
  background: #fdfcf8;
  color: #68717b;
  font-size: 11.5px;
}

.admin-order-pagination > div {
  display: flex;
  gap: 8px;
}

/* ---------- Detail pesanan ---------- */
.order-detail {
  display: grid;
  gap: 16px;
}

.order-detail__banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  border: 1px solid #e6e1d5;
  border-radius: 9px;
  background: #fbf8f0;
}

.order-detail__banner > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.order-detail__label {
  color: #7c858e;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.order-detail__copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid #ddd9ce;
  border-radius: 7px;
  background: #fff;
  color: #505963;
  font: 700 11px var(--font-body);
  cursor: pointer;
}

.order-detail__copy:hover {
  background: #f6f3ea;
}

.order-detail__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 11px;
}

.order-detail__card {
  padding: 12px 13px;
  border: 1px solid #e6e1d5;
  border-radius: 9px;
  background: #fff;
}

.order-detail__card h3,
.order-detail__items h3,
.order-detail__tracking h3 {
  margin: 0 0 8px;
  font: 600 12px var(--font-head);
  letter-spacing: 0.01em;
  color: #3d4651;
}

.order-detail__card dl {
  display: grid;
  gap: 6px;
  margin: 0;
}

.order-detail__card dl > div {
  display: grid;
  gap: 1px;
}

.order-detail__card dt {
  color: #828a93;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.order-detail__card dd {
  margin: 0;
  color: #1b2430;
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.order-detail__grand {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.order-detail__items {
  padding: 12px 13px;
  border: 1px solid #e6e1d5;
  border-radius: 9px;
  background: #fff;
}

.order-detail__items ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.order-detail__items li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #eae5d8;
  font-size: 12.5px;
}

.order-detail__items li:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.order-detail__item-name {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.order-detail__item-name small {
  color: #7c858e;
  font-size: 11px;
}

.order-detail__items li > strong {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.order-detail__item-empty {
  color: #828a93;
  font-size: 12px;
}

.order-detail__totals {
  display: grid;
  gap: 4px;
  margin: 11px 0 0;
  padding-top: 10px;
  border-top: 1px solid #ece7dc;
}

.order-detail__totals > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #5b6470;
}

.order-detail__totals dt,
.order-detail__totals dd {
  margin: 0;
}

.order-detail__totals dd {
  font-variant-numeric: tabular-nums;
}

.order-detail__totals .is-grand {
  margin-top: 3px;
  padding-top: 7px;
  border-top: 1px dashed #e2dccd;
  color: #1b2430;
  font-size: 14px;
  font-weight: 800;
}

.order-detail__tracking {
  padding: 12px 13px;
  border: 1px solid #e6e1d5;
  border-radius: 9px;
  background: #fbfaf5;
}

.order-detail__hint {
  margin: 0;
  color: #7c858e;
  font-size: 11.5px;
  line-height: 1.5;
}

.order-tracking-form {
  display: flex;
  gap: 8px;
}

.order-tracking-field {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 10px;
  border: 1px solid #d8d4ca;
  border-radius: 7px;
  background: #fff;
  color: #828a93;
}

.order-tracking-field:focus-within {
  border-color: #d9b04a;
  box-shadow: 0 0 0 3px #f6e6b3;
}

.order-tracking-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1b2430;
  font: 600 12.5px ui-monospace, SFMono-Regular, Menlo, monospace;
}

/* ---------- Footer dialog ---------- */
.order-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 9px;
  width: 100%;
}

.order-danger-button {
  height: 36px;
  padding: 0 12px;
  border: 1px solid #e0c8c2;
  border-radius: 7px;
  background: #fff;
  color: #8a453a;
  font: 700 12px var(--font-body);
  cursor: pointer;
}

.order-danger-button:hover:not(:disabled) {
  background: #fbf1ee;
}

.order-danger-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ---------- Responsif ---------- */
@media (max-width: 900px) {
  .order-detail__grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .order-detail__card:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 700px) {
  .admin-order-toolbar {
    align-items: stretch;
  }

  .admin-order-search {
    flex: 1 1 100%;
    max-width: none;
  }

  .admin-order-filter {
    flex: 1 1 44%;
  }

  .admin-order-filter select {
    width: 100%;
    max-width: none;
  }

  .admin-order-date {
    flex: 1 1 44%;
  }

  .admin-order-date input {
    width: 100%;
  }

  .order-detail__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .order-detail__card:last-child {
    grid-column: auto;
  }

  .order-tracking-form {
    flex-direction: column;
  }

  .admin-order-pagination {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 560px) {
  .admin-order-pagination > div {
    width: 100%;
  }

  .admin-order-pagination > div :deep(.admin-button) {
    flex: 1;
  }

  .order-dialog-footer {
    flex-direction: column-reverse;
  }

  .order-dialog-footer :deep(.admin-button),
  .order-danger-button {
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowUpRight, ShoppingBag } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminStat from '@/components/ui/AdminStat.vue'
import AdminDataTable from '@/components/ui/AdminDataTable.vue'
import AdminStatus from '@/components/ui/AdminStatus.vue'
import AdminState from '@/components/ui/AdminState.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'

interface Order { id: number; order_number?: string; customer_name?: string; customer?: { name?: string; email?: string }; total?: string | number; status?: string; created_at?: string }
const loading = ref(true)
const error = ref('')
const recentOrders = ref<Order[]>([])
const orderTotal = ref(0)
const revenueAmount = ref(0)
const pendingTotal = ref(0)
const now = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())
const columns = [{ key: 'order_number', label: 'Pesanan' }, { key: 'customer', label: 'Pelanggan' }, { key: 'created_at', label: 'Tanggal' }, { key: 'total', label: 'Total', numeric: true }, { key: 'status', label: 'Status' }]
const stats = computed(() => [
  { label: 'Pesanan tercatat', value: orderTotal.value.toLocaleString('id-ID'), note: 'Sepanjang waktu' },
  { label: 'Menunggu pembayaran', value: pendingTotal.value.toLocaleString('id-ID'), note: 'Perlu dipantau', accent: pendingTotal.value > 0 },
  { label: 'Pendapatan toko', value: currency(revenueAmount.value), note: 'Pendapatan bersih produk' },
  { label: 'Pesanan terbaru', value: recentOrders.value.length.toLocaleString('id-ID'), note: 'Ditampilkan di bawah' },
])

function currency(value: number) { return new Intl.NumberFormat(import.meta.env.VITE_LOCALE || 'id-ID', { style: 'currency', currency: import.meta.env.VITE_CURRENCY || 'IDR', maximumFractionDigits: 0 }).format(value) }
function dateLabel(value?: string) { return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '—' }
function orderCode(order: Order) { return order.order_number || `#${order.id}` }
function customerName(order: Order) { return order.customer_name || order.customer?.name || order.customer?.email || 'Pembeli' }
function orderTotalValue(order: Order) { return currency(Number(order.total || 0)) }

async function load() {
  loading.value = true; error.value = ''
  try {
    const [ordersResult, pendingResult, revenueResult] = await Promise.all([
      adminApi.orders({ page: 1, size: 5 }),
      adminApi.orders({ page: 1, size: 1, status: 'pending_payment' }),
      adminApi.revenue({ group_by: 'day' }),
    ])
    const ordersPayload = ordersResult as { items?: Order[]; total?: number }
    const pendingPayload = pendingResult as { total?: number }
    const revenuePayload = revenueResult as { total_revenue?: number | string; revenue?: number | string; total?: number | string; items?: { revenue?: number | string }[] }
    recentOrders.value = ordersPayload.items || []
    orderTotal.value = ordersPayload.total || 0
    pendingTotal.value = pendingPayload.total || 0
    revenueAmount.value = Number(revenuePayload.total_revenue ?? revenuePayload.revenue ?? revenuePayload.total ?? revenuePayload.items?.reduce((sum, item) => sum + Number(item.revenue || 0), 0) ?? 0)
  } catch (reason) { error.value = reason instanceof ApiError ? reason.message : 'Data admin tidak dapat dimuat. Periksa koneksi API dan hak akses akun.' }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <AdminPageHeader title="Ringkasan toko" :description="`Aktivitas operasional Mochibako · ${now}`">
      <RouterLink to="/admin/pos" class="admin-button admin-button--primary"><ShoppingBag :size="16" /> Transaksi kasir</RouterLink>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" @retry="load" />
    <template v-else>
      <div class="admin-stat-row" aria-label="Ringkasan metrik toko">
        <AdminStat v-for="stat in stats" :key="stat.label" :label="stat.label" :value="loading ? '…' : stat.value" :note="stat.note" :accent="stat.accent" />
      </div>

      <div class="admin-dashboard-grid">
        <section class="admin-section admin-section--flush">
          <div class="admin-section__head"><h2>Pesanan terbaru</h2><RouterLink to="/admin/orders">Semua pesanan <ArrowUpRight :size="14" /></RouterLink></div>
          <div class="admin-panel">
            <AdminState v-if="loading" kind="loading" message="Memuat pesanan…" />
            <AdminDataTable v-else :columns="columns" :rows="recentOrders">
              <template #order_number="{ row }"><strong class="admin-order-id">{{ orderCode(row) }}</strong></template>
              <template #customer="{ row }">{{ customerName(row) }}</template>
              <template #created_at="{ row }">{{ dateLabel(row.created_at) }}</template>
              <template #total="{ row }">{{ orderTotalValue(row) }}</template>
              <template #status="{ row }"><AdminStatus :status="row.status" /></template>
              <template #empty><AdminState kind="empty" message="Belum ada pesanan masuk." /></template>
            </AdminDataTable>
          </div>
        </section>

        <aside class="admin-side-panel">
          <section class="admin-panel admin-section">
            <div class="admin-panel__header"><div><h2>Jalan pintas</h2><p>Kerjakan aktivitas toko</p></div></div>
            <div class="admin-quick-links">
              <RouterLink class="admin-quick-link" to="/admin/orders"><strong>Kelola pesanan</strong><span>Lihat status dan resi</span></RouterLink>
              <RouterLink class="admin-quick-link" to="/admin/products"><strong>Daftar produk</strong><span>Atur katalog dan stok</span></RouterLink>
              <RouterLink class="admin-quick-link" to="/admin/pos"><strong>Kasir acara</strong><span>Catat penjualan langsung</span></RouterLink>
              <RouterLink class="admin-quick-link" to="/admin/revenue"><strong>Laporan pendapatan</strong><span>Tinjau hasil penjualan</span></RouterLink>
            </div>
          </section>
          <section class="admin-section admin-note"><span class="admin-note__mark">M</span><div><strong>Fokus hari ini</strong><p>Pastikan pesanan berbayar diproses dan nomor resi tersimpan sebelum pengiriman.</p><RouterLink to="/admin/orders">Buka daftar pesanan <ArrowUpRight :size="14" /></RouterLink></div></section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.admin-section--flush{margin-top:0}.admin-section__head a{display:inline-flex;align-items:center;gap:3px}.admin-note{display:flex;gap:12px;align-items:flex-start;padding:15px 2px}.admin-note__mark{flex:0 0 30px;height:30px;border-radius:9px;background:#f2e6c7;display:grid;place-items:center;color:#684900;font:700 14px var(--font-head)}.admin-note strong{font:600 14px var(--font-head)}.admin-note p{font-size:12px;color:#68717b;line-height:1.55;margin:4px 0 8px}.admin-note a{display:inline-flex;align-items:center;color:#66501f;text-decoration:none;font-size:12px}
</style>

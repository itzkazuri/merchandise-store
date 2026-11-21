<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminDataTable from '@/components/ui/AdminDataTable.vue'
import AdminStat from '@/components/ui/AdminStat.vue'
import AdminState from '@/components/ui/AdminState.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
const loading = ref(true); const error = ref(''); const entries = ref<Record<string, any>[]>([]); const totalRevenue = ref(0)
const columns = [{ key: 'date', label: 'Periode' }, { key: 'order_count', label: 'Pesanan', numeric: true }, { key: 'revenue', label: 'Pendapatan', numeric: true }]
async function load() { loading.value = true; error.value = ''; try { const data = await adminApi.revenue({ group_by: 'day' }) as any; entries.value = data.items || data.rows || data.breakdown || []; totalRevenue.value = Number(data.total_revenue ?? data.revenue ?? data.total ?? entries.value.reduce((sum, row) => sum + Number(row.revenue || 0), 0)) } catch (e) { error.value = e instanceof ApiError ? e.message : 'Laporan pendapatan gagal dimuat.' } finally { loading.value = false } }
function money(v: unknown) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(v || 0)) }
onMounted(load)
</script>
<template><div><AdminPageHeader title="Pendapatan" description="Ringkasan pendapatan produk. Ongkos kirim tidak dihitung sebagai pendapatan toko."><AdminButton variant="secondary" @click="load"><RefreshCw :size="15"/> Muat ulang</AdminButton></AdminPageHeader><AdminState v-if="error" kind="error" :message="error" @retry="load"/><template v-else><div class="admin-stat-row admin-revenue-stat"><AdminStat label="Pendapatan tercatat" :value="loading ? '…' : money(totalRevenue)" note="Dari pesanan yang memenuhi syarat" accent/></div><div class="admin-panel"><div class="admin-panel__header"><div><h2>Rincian harian</h2><p>Pengelompokan harian dari API pendapatan</p></div></div><AdminState v-if="loading" kind="loading" message="Memuat pendapatan…"/><AdminDataTable v-else :columns="columns" :rows="entries"><template #revenue="{ row }">{{ money(row.revenue) }}</template><template #empty><AdminState kind="empty" message="Belum ada data pendapatan untuk ditampilkan."/></template></AdminDataTable></div></template></div></template>
<style scoped>.admin-revenue-stat{max-width:420px}</style>

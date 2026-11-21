<script setup lang="ts">
defineProps<{ status?: string | null }>()
const labels: Record<string, string> = { pending_payment: 'Menunggu bayar', paid: 'Dibayar', processing: 'Diproses', shipped: 'Dikirim', completed: 'Selesai', cancelled: 'Dibatalkan' }
</script>

<template><span class="admin-status" :data-status="status || 'unknown'">{{ labels[status || ''] || status || '—' }}</span></template>

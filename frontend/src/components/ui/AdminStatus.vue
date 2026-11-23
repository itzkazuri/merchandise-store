<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status?: string }>()

const labels: Record<string, string> = {
  paid: 'Sudah Dibayar',
  pending_payment: 'Menunggu Bayar',
  processing: 'Diproses',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

const statusClass = computed(() => {
  switch (props.status) {
    case 'paid':
    case 'completed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300'
    case 'processing':
    case 'shipped':
      return 'bg-sky-50 text-sky-800 border-sky-300'
    case 'pending_payment':
      return 'bg-amber-50 text-amber-800 border-amber-300'
    case 'cancelled':
      return 'bg-rose-50 text-rose-800 border-rose-300'
    default:
      return 'bg-soft text-ink/70 border-ink/20'
  }
})
</script>

<template>
  <span
    class="inline-flex items-center min-h-[22px] px-2.5 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap"
    :class="statusClass"
    :data-status="status"
  >
    {{ labels[status || ''] || status || '—' }}
  </span>
</template>

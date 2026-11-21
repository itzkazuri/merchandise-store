<script setup lang="ts" generic="T extends Record<string, any>">
defineProps<{ columns: { key: string; label: string; numeric?: boolean }[]; rows: T[]; rowKey?: string }>()
const emit = defineEmits<{ select: [row: T] }>()
</script>

<template>
  <div class="admin-table-wrap">
    <table class="admin-table">
      <thead><tr><th v-for="column in columns" :key="column.key" :class="{ 'is-numeric': column.numeric }">{{ column.label }}</th></tr></thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="String(row[rowKey || 'id'] ?? index)" @click="emit('select', row)">
          <td v-for="column in columns" :key="column.key" :data-label="column.label" :class="{ 'is-numeric': column.numeric }"><slot :name="column.key" :row="row">{{ row[column.key] ?? '—' }}</slot></td>
        </tr>
        <tr v-if="!rows.length"><td :colspan="columns.length"><slot name="empty">Belum ada data.</slot></td></tr>
      </tbody>
    </table>
  </div>
</template>

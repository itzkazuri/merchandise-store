<script setup lang="ts" generic="T extends Record<string, any>">
defineProps<{ columns: { key: string; label: string; numeric?: boolean }[]; rows: T[]; rowKey?: string }>()
const emit = defineEmits<{ select: [row: T] }>()
</script>

<template>
  <div class="overflow-x-auto w-full">
    <table class="w-full text-left text-xs sm:text-sm border-collapse">
      <thead class="bg-soft/70 border-b-2 border-ink text-ink font-head font-bold">
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            class="p-3.5 whitespace-nowrap"
            :class="{ 'text-right': column.numeric }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-ink/10">
        <tr
          v-for="(row, index) in rows"
          :key="String(row[rowKey || 'id'] ?? index)"
          class="hover:bg-soft/25 transition-colors cursor-pointer"
          @click="emit('select', row)"
        >
          <td
            v-for="column in columns"
            :key="column.key"
            :data-label="column.label"
            class="p-3.5 align-middle"
            :class="{ 'text-right tabular-nums': column.numeric }"
          >
            <slot :name="column.key" :row="row">
              {{ row[column.key] ?? '—' }}
            </slot>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length" class="p-6 text-center text-ink/60 font-medium">
            <slot name="empty">Belum ada data.</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

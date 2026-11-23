<script setup lang="ts">
defineProps<{ label: string; value: string | number; note?: string; accent?: boolean }>()
</script>

<template>
  <div class="p-4 sm:p-5 min-w-0 flex flex-col justify-between">
    <p class="text-xs font-bold text-ink/60 uppercase tracking-wider">{{ label }}</p>
    <strong
      class="block text-2xl sm:text-3xl font-head font-extrabold mt-2 tracking-tight tabular-nums"
      :class="accent ? 'text-amber-600' : 'text-ink'"
    >
      {{ value }}
    </strong>
    <small v-if="note" class="block text-xs font-semibold text-ink/50 mt-1.5">{{ note }}</small>
  </div>
</template>

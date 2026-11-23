<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>

<template>
  <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 pb-2">
    <div>
      <h1 class="font-head font-extrabold text-2xl sm:text-3xl text-ink tracking-tight">
        {{ title }}
      </h1>
      <p v-if="description" class="text-xs sm:text-sm font-semibold text-ink/65 mt-1">
        {{ description }}
      </p>
    </div>
    <div class="flex items-center gap-2.5 shrink-0">
      <slot />
    </div>
  </header>
</template>

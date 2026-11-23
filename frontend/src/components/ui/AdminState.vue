<script setup lang="ts">
import { Loader2, AlertCircle, Inbox } from 'lucide-vue-next'

defineProps<{ kind: 'loading' | 'error' | 'empty'; message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    class="p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed border-ink/20 bg-soft/20 flex flex-col items-center justify-center my-3"
    role="status"
  >
    <Loader2 v-if="kind === 'loading'" :size="24" class="animate-spin text-sun mb-2" />
    <AlertCircle v-else-if="kind === 'error'" :size="24" class="text-destructive mb-2" />
    <Inbox v-else :size="24" class="text-ink/40 mb-2" />

    <p class="text-xs sm:text-sm font-semibold text-ink/70 max-w-sm">{{ message }}</p>
    <button
      v-if="kind === 'error'"
      type="button"
      class="mt-3 text-xs font-bold text-ink underline hover:text-sun cursor-pointer"
      @click="$emit('retry')"
    >
      Coba lagi
    </button>
  </div>
</template>

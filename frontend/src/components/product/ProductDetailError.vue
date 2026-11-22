<script setup lang="ts">
import { PackageCheck } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

defineProps<{
  message: string
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="nb mt-6 p-6 sm:p-10 text-center max-w-xl mx-auto">
    <PackageCheck :size="42" class="mx-auto text-ink/35 mb-3" />
    <h1 class="font-head text-xl font-bold text-ink">Produk tidak bisa dibuka</h1>
    <p class="mt-1.5 text-sm font-semibold text-ink/65">{{ message }}</p>
    <div class="mt-5 flex flex-wrap justify-center gap-2">
      <button
        type="button"
        class="btn bg-white text-ink px-4 h-9 text-sm font-head font-semibold"
        @click="emit('retry')"
      >
        Coba lagi
      </button>
      <RouterLink to="/" class="btn bg-sun text-ink px-4 h-9 text-sm font-head font-semibold">
        Kembali ke katalog
      </RouterLink>
    </div>
  </div>
</template>

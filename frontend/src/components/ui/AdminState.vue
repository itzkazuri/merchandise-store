<script setup lang="ts">
defineProps<{ kind: 'loading' | 'error' | 'empty'; message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="admin-state" :class="`admin-state--${kind}`" role="status">
    <p>{{ message }}</p><button v-if="kind === 'error'" type="button" @click="$emit('retry')">Coba lagi</button>
  </div>
</template>

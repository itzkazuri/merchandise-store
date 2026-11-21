<script setup lang="ts">
defineProps<{ label: string; value: string | number; note?: string; accent?: boolean }>()
</script>

<template>
  <section class="admin-stat" :class="{ 'admin-stat--accent': accent }">
    <p>{{ label }}</p><strong>{{ value }}</strong><small v-if="note">{{ note }}</small>
  </section>
</template>

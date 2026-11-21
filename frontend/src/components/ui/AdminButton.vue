<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'secondary' | 'quiet'; type?: 'button' | 'submit'; disabled?: boolean }>(), { variant: 'secondary', type: 'button', disabled: false })
</script>

<template>
  <button :type="type" :disabled="disabled" class="admin-button" :class="`admin-button--${variant}`"><slot /></button>
</template>

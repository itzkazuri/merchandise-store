<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'quiet'
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  {
    variant: 'secondary',
    type: 'button',
    disabled: false,
  },
)

const variantClasses = {
  primary: 'bg-ink text-white hover:bg-ink/90 border-2 border-ink shadow-[2px_2px_0_#F4B942]',
  secondary: 'bg-white text-ink hover:bg-soft border-2 border-ink shadow-[2px_2px_0_#1B2430]',
  quiet: 'bg-transparent text-ink/70 hover:text-ink hover:bg-soft/50 border border-transparent',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="h-9 sm:h-10 px-3.5 rounded-xl font-head font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
    :class="variantClasses[variant]"
  >
    <slot />
  </button>
</template>

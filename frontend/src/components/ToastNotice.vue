<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { message, visible } = useToast()
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 -translate-y-2 scale-95"
  >
    <div
      v-if="visible"
      id="toast"
      role="status"
      class="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink text-bg px-5 py-2 font-semibold text-center max-w-[90vw] shadow-[3px_3px_0_#F4B942] border-2 border-sun"
    >
      {{ message }}
    </div>
  </Transition>
</template>

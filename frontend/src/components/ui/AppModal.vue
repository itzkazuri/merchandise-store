<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    description?: string
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    description: '',
    maxWidth: 'md',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const panel = ref<HTMLElement | null>(null)
let previousOverflow = ''

function lockScroll() {
  if (typeof document === 'undefined') return
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  if (typeof document === 'undefined') return
  document.body.style.overflow = previousOverflow
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    e.preventDefault()
    close()
  }
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    await nextTick()
    if (typeof window === 'undefined') return
    if (isOpen) {
      lockScroll()
      window.addEventListener('keydown', onKeydown)
    } else {
      unlockScroll()
      window.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  unlockScroll()
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[120] flex items-center justify-center p-3.5 sm:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <!-- Backdrop blur & click outside -->
        <div
          class="absolute inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
          @click="close"
        ></div>

        <!-- Dialog Panel -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-2"
        >
          <div
            v-if="modelValue"
            ref="panel"
            class="relative w-full bg-white border-[2.5px] border-ink rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[6px_6px_0_#1B2430] z-10 max-h-[90vh] overflow-y-auto"
            :class="maxWidthClasses[maxWidth]"
          >
            <!-- Header -->
            <div class="flex items-start justify-between gap-3 mb-4 pb-3 border-b-2 border-ink/10">
              <div>
                <h2 class="font-head font-bold text-lg sm:text-xl text-ink">
                  {{ title }}
                </h2>
                <p v-if="description" class="text-xs sm:text-sm font-semibold text-ink/65 mt-0.5">
                  {{ description }}
                </p>
              </div>
              <button
                type="button"
                class="w-8 h-8 rounded-lg border-2 border-ink bg-white hover:bg-soft text-ink grid place-items-center shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer shrink-0"
                aria-label="Tutup dialog"
                @click="close"
              >
                <X :size="16" :stroke-width="2.6" />
              </button>
            </div>

            <!-- Body -->
            <div>
              <slot />
            </div>

            <!-- Footer (optional) -->
            <div v-if="$slots.footer" class="mt-5 pt-3 border-t-2 border-ink/10 flex items-center justify-end gap-2.5">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

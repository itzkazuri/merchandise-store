<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertTriangle,
  Info,
  ShieldAlert,
  HelpCircle,
  Loader2,
  X,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'primary' | 'info'
    busy?: boolean
    alertOnly?: boolean
  }>(),
  {
    confirmText: 'Lanjutkan',
    cancelText: 'Batal',
    variant: 'primary',
    busy: false,
    alertOnly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function close() {
  if (props.busy) return
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  if (props.busy) return
  emit('confirm')
}

const iconComponent = computed(() => {
  switch (props.variant) {
    case 'danger':
      return AlertTriangle
    case 'warning':
      return ShieldAlert
    case 'info':
      return Info
    default:
      return HelpCircle
  }
})

const iconBgClass = computed(() => {
  switch (props.variant) {
    case 'danger':
      return 'bg-destructive/15 text-destructive border-destructive'
    case 'warning':
      return 'bg-sun/30 text-ink border-ink'
    case 'info':
      return 'bg-moss/20 text-moss border-moss'
    default:
      return 'bg-sun/30 text-ink border-ink'
  }
})

const confirmBtnClass = computed(() => {
  switch (props.variant) {
    case 'danger':
      return 'bg-destructive text-white hover:bg-destructive/90 shadow-[3px_3px_0_#1B2430]'
    case 'warning':
      return 'bg-sun text-ink hover:bg-sun/90 shadow-[3px_3px_0_#1B2430]'
    case 'info':
      return 'bg-moss text-white hover:bg-moss/90 shadow-[3px_3px_0_#1B2430]'
    default:
      return 'bg-sun text-ink hover:bg-sun/90 shadow-[3px_3px_0_#1B2430]'
  }
})
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
        class="fixed inset-0 z-[130] flex items-center justify-center p-3.5 sm:p-6"
        role="alertdialog"
        aria-modal="true"
        :aria-label="title"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
          @click="close"
        ></div>

        <!-- Panel -->
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
            class="relative w-full max-w-sm sm:max-w-md bg-white border-[2.5px] border-ink rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0_#1B2430] z-10 overflow-hidden"
          >
            <div class="flex items-start gap-3.5">
              <!-- Icon -->
              <div
                class="w-11 h-11 rounded-xl border-2 grid place-items-center shrink-0 shadow-[2px_2px_0_#1B2430]"
                :class="iconBgClass"
              >
                <component :is="iconComponent" :size="22" :stroke-width="2.3" />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0 pt-0.5">
                <h3 class="font-head font-bold text-base sm:text-lg text-ink">
                  {{ title }}
                </h3>
                <p class="text-xs sm:text-sm font-semibold text-ink/75 mt-1.5 leading-relaxed">
                  {{ message }}
                </p>
              </div>

              <!-- Close button -->
              <button
                type="button"
                :disabled="busy"
                class="w-7 h-7 rounded-lg border border-ink/40 bg-white hover:bg-soft text-ink grid place-items-center cursor-pointer transition-colors shrink-0 disabled:opacity-40"
                aria-label="Tutup"
                @click="close"
              >
                <X :size="14" :stroke-width="2.5" />
              </button>
            </div>

            <!-- Action buttons -->
            <div class="mt-6 pt-3 border-t border-ink/10 flex items-center justify-end gap-2.5">
              <button
                v-if="!alertOnly"
                type="button"
                :disabled="busy"
                class="btn bg-white hover:bg-soft text-ink border-2 border-ink px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                @click="close"
              >
                {{ cancelText }}
              </button>

              <button
                type="button"
                :disabled="busy"
                class="btn border-2 border-ink px-4 py-2 rounded-xl text-xs sm:text-sm font-bold active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                :class="confirmBtnClass"
                @click="handleConfirm"
              >
                <Loader2 v-if="busy" :size="14" class="animate-spin" />
                <span>{{ confirmText }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

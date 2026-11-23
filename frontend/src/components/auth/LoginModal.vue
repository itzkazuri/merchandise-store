<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import LoginForm from './LoginForm.vue'
import { useAuthDialog } from '@/composables/useAuthDialog'

const { open, closeAuthDialog } = useAuthDialog()

const panel = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null
let previousOverflow = ''

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableItems(): HTMLElement[] {
  const root = panel.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

/** Escape menutup dialog, Tab tetap berputar di dalam panel (focus trap). */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeAuthDialog()
    return
  }
  if (event.key !== 'Tab') return

  const items = focusableItems()
  if (!items.length) return

  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return

  const active = document.activeElement

  if (event.shiftKey && (active === first || !panel.value?.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

async function activate() {
  if (typeof document === 'undefined') return
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  const target = panel.value?.querySelector<HTMLElement>('[data-auth-focus], button:not([aria-label="Tutup dialog masuk akun"])')
  target?.focus()
}

function deactivate() {
  if (typeof document === 'undefined') return
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = previousOverflow
  lastFocused?.focus?.()
  lastFocused = null
}

watch(open, (isOpen) => {
  if (isOpen) void activate()
  else deactivate()
})

onMounted(() => {
  if (open.value) void activate()
})

onBeforeUnmount(deactivate)
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
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-6"
      >
        <!-- Backdrop blur: klik di luar menutup dialog -->
        <div
          class="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="closeAuthDialog"
        ></div>

        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-dialog-title"
          class="nb relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white p-5 sm:p-7 shadow-[6px_6px_0_#1B2430]"
        >
          <button
            type="button"
            class="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-white text-ink transition-colors hover:bg-soft cursor-pointer"
            aria-label="Tutup dialog login"
            @click="closeAuthDialog"
          >
            <X :size="17" :stroke-width="2.6" />
          </button>

          <span
            class="absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-sun/25 pointer-events-none"
            aria-hidden="true"
          ></span>

          <div class="relative">
            <LoginForm @success="closeAuthDialog" @navigate="closeAuthDialog" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

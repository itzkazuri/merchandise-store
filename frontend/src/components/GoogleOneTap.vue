<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { X, Sparkles } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'

const { isAuthenticated, quickGoogleLogin } = useAuth()

const dismissed = ref(false)
const showFloatingPrompt = ref(true)
const googleNativeActive = ref(false)

function handleQuickLogin() {
  quickGoogleLogin()
}

function dismiss() {
  dismissed.value = true
  try {
    sessionStorage.setItem('mochibako_onetap_dismissed', '1')
  } catch {
    /* storage unavailable */
  }
}

onMounted(() => {
  try {
    if (sessionStorage.getItem('mochibako_onetap_dismissed') === '1') {
      dismissed.value = true
    }
  } catch {
    /* ignore */
  }
})
</script>

<template>
  <!-- Google One Tap Pop-Up (Mobile-first, pojok kanan atas) -->
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-3 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 -translate-y-3 scale-95"
  >
    <div
      v-if="!isAuthenticated && !dismissed && showFloatingPrompt && !googleNativeActive"
      class="fixed z-40
             top-[4.25rem] sm:top-20
             right-2.5 sm:right-5
             left-2.5 sm:left-auto
             w-auto sm:max-w-[320px] sm:w-full"
    >
      <div
        class="nb relative bg-white
               p-3 sm:p-4
               rounded-xl sm:rounded-2xl
               border-[2.5px] border-ink
               shadow-[4px_4px_0_#1B2430] sm:shadow-[6px_6px_0_#1B2430]
               flex flex-col gap-2.5 sm:gap-3
               rise"
      >
        <!-- Close button -->
        <button
          type="button"
          class="absolute top-2 right-2 sm:top-2.5 sm:right-2.5
                 w-6 h-6 sm:w-7 sm:h-7
                 rounded-full border border-ink bg-white
                 grid place-items-center
                 text-ink/60 hover:text-ink hover:bg-soft
                 transition-colors cursor-pointer
                 active:scale-95"
          aria-label="Tutup notifikasi Google"
          @click="dismiss"
        >
          <X :size="12" :stroke-width="2.6" class="sm:hidden" />
          <X :size="13" :stroke-width="2.6" class="hidden sm:block" />
        </button>

        <!-- Header: Google + Branding -->
        <div class="flex items-center gap-2 sm:gap-2.5 pr-7 sm:pr-8">
          <span
            class="w-7 h-7 sm:w-8 sm:h-8
                   rounded-lg bg-[#E8F0FE] border-2 border-[#4285F4]
                   grid place-items-center shrink-0"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </span>

          <div class="min-w-0">
            <h4 class="font-head font-bold text-[13px] sm:text-sm text-ink leading-tight">
              Masuk dengan Google
            </h4>
            <p class="text-[10px] sm:text-[11px] font-semibold text-ink/60 leading-tight mt-0.5">
              Login instan ke Mochibako
            </p>
          </div>
        </div>

        <!-- Account preview -->
        <div
          class="p-2 sm:p-2.5 rounded-lg sm:rounded-xl
                 bg-soft/50 border border-soft
                 flex items-center gap-2"
        >
          <span
            class="w-6 h-6 sm:w-7 sm:h-7
                   rounded-full bg-sun border border-ink
                   grid place-items-center
                   text-[10px] sm:text-xs font-bold shrink-0"
          >
            G
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] sm:text-xs font-bold text-ink truncate leading-tight">
              Kolektor Google
            </p>
            <p class="text-[9.5px] sm:text-[10px] font-semibold text-ink/55 truncate leading-tight">
              kolektor.anime@gmail.com
            </p>
          </div>
        </div>

        <!-- CTA Button -->
        <button
          type="button"
          class="btn bg-sun text-ink w-full
                 h-8.5 sm:h-9
                 font-head font-semibold
                 text-[11px] sm:text-xs
                 flex items-center justify-center gap-1.5
                 shadow-[2px_2px_0_#1B2430]
                 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                 cursor-pointer"
          @click="handleQuickLogin"
        >
          <Sparkles :size="12" class="text-ink shrink-0" />
          <span class="truncate">Lanjutkan sebagai Kolektor</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Pastikan tinggi tombol pas di mobile */
.h-8\.5 {
  height: 2.125rem; /* 34px */
}
</style>
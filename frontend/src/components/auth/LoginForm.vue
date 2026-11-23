<script setup lang="ts">
import { onMounted, useId } from 'vue'
import { Sparkles, ShieldCheck } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'

defineProps<{
  /** Tujuan setelah login. */
  redirect?: unknown
}>()

const { error, startGoogleLogin } = useAuth()

const uid = useId()
const errorId = `${uid}-error`

onMounted(() => {
  error.value = ''
})

function handleGoogleSignIn() {
  startGoogleLogin()
}
</script>

<template>
  <div class="text-center mb-5 sm:mb-6">
    <span class="inline-flex items-center gap-1.5 -rotate-2 bg-pinky border-2 border-ink rounded-md px-2.5 py-0.5 text-[11px] font-extrabold shadow-sm mb-2">
      <Sparkles :size="12" class="text-ink" />
      Akses Cepat & Aman
    </span>
    <h2 id="login-dialog-title" class="font-head font-bold text-2xl sm:text-3xl text-ink">
      Masuk Akun
    </h2>
    <p class="text-xs sm:text-sm font-semibold text-ink/70 mt-1 max-w-xs mx-auto">
      Buka koleksi favoritmu, kelola pesanan, dan belanja dengan mudah
    </p>
  </div>

  <div
    v-if="error"
    :id="errorId"
    role="alert"
    class="mb-4 p-2.5 sm:p-3 rounded-xl bg-destructive/10 border-2 border-destructive text-destructive text-xs sm:text-sm font-bold"
  >
    {{ error }}
  </div>

  <div class="space-y-4">
    <!-- Google OAuth Button -->
    <button
      data-auth-focus
      type="button"
      class="btn bg-white hover:bg-soft text-ink w-full h-12 font-head font-bold text-sm sm:text-base flex items-center justify-center gap-3 border-[2.5px] border-ink rounded-2xl shadow-[4px_4px_0_#1B2430] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#1B2430] transition-all cursor-pointer"
      @click="handleGoogleSignIn"
    >
      <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
      </svg>
      <span>Lanjutkan dengan Google</span>
    </button>

    <div class="bg-soft/40 border border-ink/15 rounded-xl p-3 text-xs font-semibold text-ink/75 space-y-1.5">
      <div class="flex items-center gap-2">
        <ShieldCheck :size="15" class="text-moss shrink-0" />
        <span>Akun dibuat otomatis, tidak perlu form pendaftaran.</span>
      </div>
      <div class="flex items-center gap-2">
        <ShieldCheck :size="15" class="text-moss shrink-0" />
        <span>Data transaksi dan riwayat pesanan kamu tersimpan aman.</span>
      </div>
    </div>
  </div>

  <p class="text-center text-[11px] sm:text-xs font-medium text-ink/50 mt-5 leading-relaxed">
    Dengan melanjutkan, kamu menyetujui Ketentuan Layanan dan Kebijakan Privasi Mochibako.
  </p>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Box, ArrowLeft, Sparkles, ShieldCheck } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Daftar Akun Baru',
  description: 'Daftar akun Mochibako menggunakan Google untuk menyimpan wishlist dan belanja merchandise anime favoritmu.',
})

const { startGoogleLogin } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col justify-between p-3.5 sm:p-6">
    <header class="max-w-md w-full mx-auto pt-2 sm:pt-4 flex items-center justify-between">
      <RouterLink
        to="/"
        class="btn bg-white px-3 py-1.5 font-head font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-ink hover:bg-soft transition-colors"
      >
        <ArrowLeft :size="15" :stroke-width="2.6" />
        <span>Kembali ke Toko</span>
      </RouterLink>

      <div class="flex items-center gap-1.5 font-head font-bold text-base sm:text-lg text-ink">
        <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-sun border-2 border-ink grid place-items-center">
          <Box :size="15" :stroke-width="2.4" />
        </span>
        <span>Mochibako</span>
      </div>
    </header>

    <main class="max-w-md w-full mx-auto my-4 sm:my-8">
      <div class="nb p-5 sm:p-8 relative overflow-hidden shadow-[5px_5px_0_#1B2430] sm:shadow-[6px_6px_0_#1B2430] rounded-2xl sm:rounded-3xl bg-white">
        <span
          class="absolute -right-12 -top-12 w-36 sm:w-40 h-36 sm:h-40 rounded-full bg-sun/30 pointer-events-none"
          aria-hidden="true"
        ></span>

        <div class="relative z-10 text-center">
          <span class="inline-flex items-center gap-1.5 -rotate-2 bg-pinky border-2 border-ink rounded-md px-2.5 py-0.5 text-[11px] font-extrabold shadow-sm mb-2">
            <Sparkles :size="12" class="text-ink" />
            Mudah & Cepat
          </span>
          <h1 class="font-head font-bold text-2xl sm:text-3xl text-ink">
            Daftar Akun Mochibako
          </h1>
          <p class="text-xs sm:text-sm font-semibold text-ink/70 mt-1 mb-6 max-w-xs mx-auto">
            Daftar akun langsung dengan akun Google kamu tanpa ribet mengisi form panjang!
          </p>

          <button
            type="button"
            class="btn bg-white hover:bg-soft text-ink w-full h-12 font-head font-bold text-sm sm:text-base flex items-center justify-center gap-3 border-[2.5px] border-ink rounded-2xl shadow-[4px_4px_0_#1B2430] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#1B2430] transition-all cursor-pointer mb-6"
            @click="startGoogleLogin"
          >
            <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Daftar / Masuk dengan Google</span>
          </button>

          <div class="bg-soft/40 border border-ink/15 rounded-xl p-3.5 text-left text-xs font-semibold text-ink/75 space-y-2">
            <div class="flex items-center gap-2">
              <ShieldCheck :size="15" class="text-moss shrink-0" />
              <span>Satu akun Google untuk semua riwayat transaksi & belanja.</span>
            </div>
            <div class="flex items-center gap-2">
              <ShieldCheck :size="15" class="text-moss shrink-0" />
              <span>Tidak perlu mengingat password tambahan.</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="max-w-md w-full mx-auto text-center pb-2 sm:pb-4 text-xs font-semibold text-ink/50">
      &copy; {{ new Date().getFullYear() }} Mochibako Merch. Hak cipta dilindungi.
    </footer>
  </div>
</template>

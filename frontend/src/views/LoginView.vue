<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { Box, ArrowLeft } from 'lucide-vue-next'
import LoginForm from '@/components/auth/LoginForm.vue'
import ToastNotice from '@/components/ToastNotice.vue'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Masuk Akun',
  description: 'Masuk ke akun Mochibako kamu untuk mengelola pesanan dan keranjang belanja.',
})

const route = useRoute()
</script>

<!--
  Halaman fallback. Navigasi normal ke /login membuka LoginModal di halaman
  yang sedang dibuka, jadi halaman ini praktis hanya dipakai untuk render
  server / tautan langsung tanpa JavaScript.
-->
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
      <div class="nb p-5 sm:p-8 relative overflow-hidden shadow-[5px_5px_0_#1B2430] sm:shadow-[6px_6px_0_#1B2430] rounded-2xl sm:rounded-3xl">
        <span
          class="absolute -right-12 -top-12 w-36 sm:w-40 h-36 sm:h-40 rounded-full bg-sun/30 pointer-events-none"
          aria-hidden="true"
        ></span>

        <div class="relative z-10">
          <LoginForm :redirect="route.query.redirect" />
        </div>
      </div>
    </main>

    <footer class="text-center text-[11px] sm:text-xs font-semibold text-ink/50 pb-2">
      Mochibako · Belanja Merchandise Anime Aman &amp; Nyaman
    </footer>

    <ToastNotice />
  </div>
</template>

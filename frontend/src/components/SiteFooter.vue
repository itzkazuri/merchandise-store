<script setup lang="ts">
import { Box, Heart, Sparkles, ShieldCheck } from 'lucide-vue-next'
</script>

<template>
  <footer class="mt-auto border-t-[2.5px] border-ink bg-bg py-8 sm:py-10">
    <div class="max-w-6xl mx-auto px-4 sm:px-5 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
      <!-- Brand & Tagline -->
      <div class="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 text-center sm:text-left">
        <span class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sun border-2 border-ink grid place-items-center shadow-[2px_2px_0_#1B2430]">
          <Box :size="20" :stroke-width="2.4" class="text-ink sm:hidden" />
          <Box :size="22" :stroke-width="2.4" class="text-ink hidden sm:block" />
        </span>
        <div>
          <h4 class="font-head font-bold text-lg sm:text-xl text-ink">Mochibako</h4>
          <p class="text-xs sm:text-sm font-semibold text-ink/70">Merch anime & koleksi untuk ruang kecil dan hati yang penuh.</p>
        </div>
      </div>

      <!-- Badges -->
      <div class="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <span class="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-white border-2 border-ink text-[11px] sm:text-xs font-bold shadow-[2px_2px_0_#1B2430]">
          <ShieldCheck :size="13" class="text-ink" /> 100% Terkurasi
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-mint border-2 border-ink text-[11px] sm:text-xs font-bold shadow-[2px_2px_0_#1B2430]">
          <Sparkles :size="13" class="text-ink" /> UMKM Lokal & Impor
        </span>
        <span class="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-pinky border-2 border-ink text-[11px] sm:text-xs font-bold shadow-[2px_2px_0_#1B2430]">
          <Heart :size="13" class="fill-white stroke-ink" /> Jakarta, Indonesia
        </span>
      </div>
    </div>
  </footer>
</template>

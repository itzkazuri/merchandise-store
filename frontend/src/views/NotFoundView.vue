<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { PackageSearch, Home, ArrowLeft } from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import { useSeo } from '@/composables/useSeo'

useSeo({ title: '404 — Halaman Tidak Ditemukan' })

const router = useRouter()

/**
 * Kalau halaman ini dibuka langsung (tanpa riwayat), `router.back()` tidak
 * melakukan apa-apa. Fallback ke beranda supaya tombol selalu bekerja.
 */
function goBack() {
  const canGoBack = Boolean(router.options.history.state.back)
  if (canGoBack) {
    router.back()
    return
  }
  void router.replace({ name: 'home' })
}
</script>

<template>
  <StoreShell :show-search="false">
    <div class="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div class="text-center max-w-md w-full">

        <!-- Big 404 -->
        <div class="relative inline-block mb-6">
          <span
            class="font-head font-black text-[9rem] sm:text-[11rem] leading-none text-sun select-none"
            style="text-shadow: 5px 5px 0 #1B2430"
          >404</span>
          <span class="absolute -bottom-2 -right-3 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-ink grid place-items-center rotate-12 shadow-[3px_3px_0_#1B2430] border-2 border-ink">
            <PackageSearch :size="28" class="text-bg" />
          </span>
        </div>

        <!-- Card -->
        <div class="nb p-6 sm:p-8 mt-4 text-left">
          <h1 class="font-head text-2xl sm:text-3xl font-bold text-ink leading-tight">
            Halaman tidak ditemukan
          </h1>
          <p class="mt-2.5 text-sm sm:text-base text-ink/65 font-semibold leading-relaxed">
            Sepertinya halaman yang kamu cari sudah pindah, dihapus, atau URL-nya salah ketik.
            Coba periksa lagi atau kembali ke beranda.
          </p>

          <div class="mt-6 flex flex-wrap gap-3">
            <RouterLink
              to="/"
              class="btn bg-ink text-bg h-11 px-5 font-head font-semibold text-sm flex items-center gap-2"
            >
              <Home :size="16" /> Ke Beranda
            </RouterLink>
            <button
              type="button"
              class="btn bg-white h-11 px-5 font-head font-semibold text-sm flex items-center gap-2"
              @click="goBack"
            >
              <ArrowLeft :size="16" /> Kembali
            </button>
          </div>
        </div>

        <!-- Hint -->
        <p class="mt-5 text-xs text-ink/40 font-semibold">
          Kalau kamu merasa ini sebuah kesalahan, hubungi kami ya 🙏
        </p>
      </div>
    </div>
  </StoreShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ServerCrash, Home, RefreshCw } from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import { useSeo } from '@/composables/useSeo'

useSeo({ title: '500 — Server Error' })

const props = defineProps<{ error?: string }>()
const route = useRoute()

const errorMsg = computed(() =>
  props.error || (typeof route.query.error === 'string' ? route.query.error : '')
)

function reload() {
  window.location.reload()
}
</script>

<template>
  <StoreShell :show-search="false">
    <div class="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div class="text-center max-w-md w-full">

        <!-- Big 500 -->
        <div class="relative inline-block mb-6">
          <span
            class="font-head font-black text-[9rem] sm:text-[11rem] leading-none text-[#FFD9E6] select-none"
            style="text-shadow: 5px 5px 0 #1B2430"
          >500</span>
          <span class="absolute -bottom-2 -right-3 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-ink grid place-items-center rotate-12 shadow-[3px_3px_0_#1B2430] border-2 border-ink">
            <ServerCrash :size="28" class="text-bg" />
          </span>
        </div>

        <!-- Card -->
        <div class="nb p-6 sm:p-8 mt-4 text-left">
          <h1 class="font-head text-2xl sm:text-3xl font-bold text-ink leading-tight">
            Ups, ada masalah di server
          </h1>
          <p class="mt-2.5 text-sm sm:text-base text-ink/65 font-semibold leading-relaxed">
            Server kami sedang mengalami gangguan. Tim kami sudah diberitahu dan sedang menangani ini.
            Coba refresh halaman atau kembali beberapa saat lagi.
          </p>

          <div
            v-if="errorMsg"
            class="mt-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs font-mono text-destructive break-all"
          >
            {{ errorMsg }}
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              class="btn bg-ink text-bg h-11 px-5 font-head font-semibold text-sm flex items-center gap-2"
              @click="reload"
            >
              <RefreshCw :size="16" /> Refresh halaman
            </button>
            <RouterLink
              to="/"
              class="btn bg-white h-11 px-5 font-head font-semibold text-sm flex items-center gap-2"
            >
              <Home :size="16" /> Ke Beranda
            </RouterLink>
          </div>
        </div>

        <p class="mt-5 text-xs text-ink/40 font-semibold">
          Jika masalah berlanjut, silakan hubungi kami 🙏
        </p>
      </div>
    </div>
  </StoreShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-vue-next'
import { useConnectivity } from '@/lib/connectivity'
import { useCookieConsent } from '@/lib/cookieConsent'
import { longDateTime } from '@/lib/format'

const { offline, browserOnline, checking, cacheServedAt, retryConnection } = useConnectivity()
const { offlineStorage, openSettings } = useCookieConsent()

const reconnected = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | undefined

watch(offline, (isOffline, wasOffline) => {
  if (isOffline) {
    reconnected.value = false
    return
  }
  if (!wasOffline) return
  reconnected.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { reconnected.value = false }, 4000)
})

const savedLabel = computed(() => {
  if (!cacheServedAt.value) return ''
  const formatted = longDateTime(new Date(cacheServedAt.value).toISOString())
  return ` (${formatted})`
})

async function retry() {
  if (checking.value) return
  await retryConnection()
}

onBeforeUnmount(() => clearTimeout(hideTimer))
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="offline || reconnected"
      class="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink"
      :class="offline ? 'bg-sun' : 'bg-mint'"
      role="status"
      aria-live="polite"
    >
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-xs font-semibold text-ink sm:px-5 sm:text-sm">
        <WifiOff v-if="offline" :size="16" class="shrink-0" aria-hidden="true" />
        <Wifi v-else :size="16" class="shrink-0" aria-hidden="true" />

        <p v-if="offline" class="min-w-0 flex-1 leading-snug">
          <span class="font-head font-bold">
            {{ browserOnline ? 'Server tidak bisa dihubungi.' : 'Kamu sedang offline.' }}
          </span>
          <span v-if="offlineStorage" class="text-ink/70">
            Katalog & keranjang tetap bisa dibaca{{ savedLabel }}. Checkout, pesanan, dan data admin butuh koneksi ke server.
          </span>
          <span v-else class="text-ink/70">
            Katalog offline belum aktif, jadi produk tersimpan tidak bisa ditampilkan. Checkout,
            pesanan, dan admin juga butuh koneksi.
          </span>
        </p>
        <p v-else class="min-w-0 flex-1 leading-snug">
          <span class="font-head font-bold">Koneksi ke server pulih.</span>
          <span class="text-ink/70"> Data terbaru akan dimuat ulang.</span>
        </p>

        <button
          v-if="offline && !offlineStorage"
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-ink bg-white px-2.5 py-1.5 text-[11px] font-extrabold shadow-[2px_2px_0_#1B2430] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:text-xs"
          @click="openSettings"
        >
          Aktifkan katalog offline
        </button>

        <button
          v-if="offline"
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-ink bg-white px-2.5 py-1.5 text-[11px] font-extrabold shadow-[2px_2px_0_#1B2430] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-wait disabled:opacity-70 sm:text-xs"
          :disabled="checking"
          @click="retry"
        >
          <Loader2 v-if="checking" :size="13" class="animate-spin" aria-hidden="true" />
          <RefreshCw v-else :size="13" aria-hidden="true" />
          {{ checking ? 'Menghubungkan…' : 'Coba lagi' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

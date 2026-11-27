<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Check, Cookie, HardDriveDownload, ShieldCheck, X } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useCookieConsent } from '@/lib/cookieConsent'

const route = useRoute()
const {
  decided,
  offlineStorage,
  settingsOpen,
  acceptAll,
  rejectOptional,
  savePreferences,
  openSettings,
  closeSettings,
} = useCookieConsent()

/** Hanya render di client supaya hasil prerender tidak berkedip. */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

const allowOffline = ref(offlineStorage.value)

watch(settingsOpen, (isOpen) => {
  if (isOpen) allowOffline.value = offlineStorage.value
})

const isAdminArea = () => route.path.startsWith('/admin')
const showBanner = () => mounted.value && !decided.value && !isAdminArea()

function save() {
  savePreferences(allowOffline.value)
}
</script>

<template>
  <template v-if="mounted && !isAdminArea()">
    <!-- Banner pengunjung baru -->
    <Transition
      enter-active-class="transition duration-250 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0"
    >
      <aside
        v-if="showBanner()"
        class="fixed inset-x-3 bottom-3 z-[70] sm:left-auto sm:right-4 sm:bottom-4 sm:w-[26rem]"
        role="region"
        aria-label="Peringatan cookie"
      >
        <div class="rounded-2xl border-[2.5px] border-ink bg-white p-4 shadow-[5px_5px_0_#1B2430] sm:p-5">
          <div class="flex items-start gap-2.5">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-ink bg-sun shadow-[2px_2px_0_#1B2430]">
              <Cookie :size="18" :stroke-width="2.5" class="text-ink" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <h2 class="font-head text-base font-bold leading-tight text-ink sm:text-lg">
                Pilihan cookie kamu
              </h2>
              <p class="mt-1 text-[11.5px] font-semibold leading-snug text-ink/70 sm:text-xs">
                Kami memakai cookie untuk menyimpan pilihan ini. Dengan izinmu, katalog disimpan di
                perangkat supaya produk tetap bisa dibaca saat server tidak bisa dihubungi. Tidak
                untuk iklan atau melacak akun.
              </p>
            </div>
            <button
              type="button"
              class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white text-ink shadow-[2px_2px_0_#1B2430] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              aria-label="Tutup peringatan cookie"
              @click="rejectOptional"
            >
              <X :size="14" :stroke-width="2.6" />
            </button>
          </div>

          <div class="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-mint px-3 py-2 text-xs font-extrabold text-ink shadow-[2px_2px_0_#1B2430] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:flex-none"
              @click="acceptAll"
            >
              <Check :size="14" :stroke-width="3" aria-hidden="true" />
              Terima semua
            </button>
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold text-ink shadow-[2px_2px_0_#1B2430] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none sm:flex-none"
              @click="rejectOptional"
            >
              Hanya perlu
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl px-2 py-2 text-xs font-extrabold text-ink/70 underline decoration-2 underline-offset-2 transition hover:text-ink"
              @click="openSettings"
            >
              Atur
            </button>
          </div>
        </div>
      </aside>
    </Transition>

    <!-- Dialog pengaturan cookie -->
    <AppModal
      :model-value="settingsOpen"
      title="Pengaturan cookie"
      description="Kamu bisa mengubah pilihan ini kapan saja lewat footer."
      max-width="md"
      @update:model-value="closeSettings"
    >
      <div class="space-y-3">
        <div class="flex items-start gap-3 rounded-xl border-2 border-ink/15 bg-soft/60 p-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white">
            <ShieldCheck :size="17" :stroke-width="2.5" class="text-ink" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-extrabold text-ink">Wajib</p>
            <p class="mt-0.5 text-[11.5px] font-semibold leading-snug text-ink/65 sm:text-xs">
              Menyimpan pilihan cookie dan menjaga sesi login tetap aman. Selalu aktif.
            </p>
          </div>
          <span class="mt-0.5 shrink-0 rounded-full border-2 border-ink bg-mint px-2 py-0.5 text-[10px] font-extrabold text-ink">
            Aktif
          </span>
        </div>

        <label
          class="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-ink/15 p-3 transition hover:border-ink/35"
        >
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-lilac/40">
            <HardDriveDownload :size="17" :stroke-width="2.5" class="text-ink" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-extrabold text-ink">Katalog offline</span>
            <span class="mt-0.5 block text-[11.5px] font-semibold leading-snug text-ink/65 sm:text-xs">
              Menyimpan daftar produk dan halaman yang sudah kamu buka agar tetap tampil saat
              koneksi ke server putus. Tanpa data akun, pesanan, atau token.
            </span>
          </span>
          <input v-model="allowOffline" type="checkbox" class="peer sr-only" />
          <span
            class="relative mt-1 h-6 w-11 shrink-0 rounded-full border-2 border-ink transition-colors"
            :class="allowOffline ? 'bg-mint' : 'bg-ink/15'"
            aria-hidden="true"
          >
            <span
              class="absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full border-2 border-ink bg-white transition-transform"
              :class="allowOffline ? 'translate-x-5' : 'translate-x-0'"
            ></span>
          </span>
        </label>
      </div>

      <template #footer>
        <button
          type="button"
          class="rounded-xl border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold text-ink shadow-[2px_2px_0_#1B2430] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          @click="closeSettings"
        >
          Batal
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl border-2 border-ink bg-sun px-3.5 py-2 text-xs font-extrabold text-ink shadow-[2px_2px_0_#1B2430] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          @click="save"
        >
          <Check :size="14" :stroke-width="3" aria-hidden="true" />
          Simpan pilihan
        </button>
      </template>
    </AppModal>
  </template>
</template>

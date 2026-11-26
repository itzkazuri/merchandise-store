<script setup lang="ts">
import { onMounted, ref, useId } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ShieldAlert,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Box,
  AlertCircle,
} from 'lucide-vue-next'
import { hasAnyRole, useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Portal Administrator',
  description: 'Halaman masuk khusus administrator dan staf internal Mochibako.',
})

const route = useRoute()
const router = useRouter()
const { adminLogin, loading, error, user, fetchProfile } = useAuth()
const { showToast } = useToast()

const uid = useId()
const emailId = `${uid}-email`
const passwordId = `${uid}-password`

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const localError = ref('')

onMounted(async () => {
  error.value = ''
  localError.value = ''

  if (route.query.error === 'unauthorized') {
    localError.value = 'Akun Anda tidak memiliki hak akses administrator atau sesi telah kedaluwarsa.'
  }

  const profile = user.value || (await fetchProfile())
  if (profile) {
    if (hasAnyRole(profile, ['admin', 'staff'])) {
      const target = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin')
        ? route.query.redirect
        : '/admin'
      await router.replace(target)
    } else {
      // Tolak akses jika akun Google / customer yang sudah login dan lempar ke halaman depan
      showToast('Akses ditolak: Akun Google tidak memiliki izin administrator')
      await router.replace('/')
    }
  }
})


async function handleAdminSubmit() {
  if (loading.value) return
  localError.value = ''

  if (!email.value.trim() || !password.value) {
    localError.value = 'Harap isi email dan kata sandi administrator'
    showToast('Harap isi email dan password')
    return
  }

  const success = await adminLogin(email.value, password.value)
  if (!success) {
    localError.value = error.value || 'Gagal masuk akun administrator'
    showToast(localError.value)
    return
  }

  showToast('Login berhasil! Mengalihkan ke panel kontrol...')

  const target = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin')
    ? route.query.redirect
    : '/admin'

  await router.replace(target)
}
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col justify-between p-3.5 sm:p-6">
    <header class="max-w-md w-full mx-auto pt-2 sm:pt-4 flex items-center justify-between">
      <RouterLink
        to="/"
        class="btn bg-white px-3 py-1.5 font-head font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-ink hover:bg-soft transition-colors shadow-[2px_2px_0_#1B2430]"
      >
        <ArrowLeft :size="15" :stroke-width="2.6" />
        <span>Ke Toko Utama</span>
      </RouterLink>

      <div class="flex items-center gap-1.5 font-head font-bold text-base sm:text-lg text-ink">
        <span class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-sun border-2 border-ink grid place-items-center">
          <Box :size="15" :stroke-width="2.4" />
        </span>
        <span>Mochibako</span>
      </div>
    </header>

    <main class="max-w-md w-full mx-auto my-6 sm:my-10">
      <div class="nb p-6 sm:p-8 relative overflow-hidden shadow-[6px_6px_0_#1B2430] rounded-2xl sm:rounded-3xl bg-white border-[2.5px] border-ink">
        <span
          class="absolute -right-12 -top-12 w-36 sm:w-40 h-36 sm:h-40 rounded-full bg-ink/5 pointer-events-none"
          aria-hidden="true"
        ></span>

        <div class="relative z-10">
          <div class="text-center mb-6">
            <span class="inline-flex items-center gap-1.5 bg-ink text-white border-2 border-ink rounded-md px-2.5 py-0.5 text-[11px] font-extrabold shadow-sm mb-3">
              <ShieldAlert :size="13" class="text-sun" />
              Area Internal Staf
            </span>
            <h1 class="font-head font-bold text-2xl sm:text-3xl text-ink">
              Portal Administrator
            </h1>
            <p class="text-xs sm:text-sm font-semibold text-ink/70 mt-1.5">
              Masuk dengan kredensial staf atau administrator toko
            </p>
          </div>

          <div
            v-if="localError || error"
            role="alert"
            class="mb-5 p-3 rounded-xl bg-destructive/10 border-2 border-destructive text-destructive text-xs sm:text-sm font-bold flex items-start gap-2"
          >
            <AlertCircle :size="16" class="shrink-0 mt-0.5" />
            <span>{{ localError || error }}</span>
          </div>

          <form class="space-y-4" novalidate @submit.prevent="handleAdminSubmit">
            <div>
              <label :for="emailId" class="block font-head font-semibold text-xs sm:text-sm mb-1.5 text-ink">
                Email Administrator
              </label>
              <div class="relative">
                <Mail :size="17" :stroke-width="2.4" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/50" />
                <input
                  :id="emailId"
                  v-model="email"
                  type="email"
                  inputmode="email"
                  required
                  autofocus
                  autocomplete="username"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="admin@tokomerch.com"
                  class="w-full h-11 rounded-full border-2 border-ink bg-white pl-10 pr-4 font-semibold placeholder:text-ink/40 focus:outline-none focus:border-sun text-ink text-xs sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label :for="passwordId" class="block font-head font-semibold text-xs sm:text-sm mb-1.5 text-ink">
                Kata Sandi
              </label>
              <div class="relative">
                <Lock :size="17" :stroke-width="2.4" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/50" />
                <input
                  :id="passwordId"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="Masukkan kata sandi admin"
                  class="w-full h-11 rounded-full border-2 border-ink bg-white pl-10 pr-11 font-semibold placeholder:text-ink/40 focus:outline-none focus:border-sun text-ink text-xs sm:text-sm"
                />
                <button
                  type="button"
                  class="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/60 hover:text-ink cursor-pointer p-1"
                  :aria-label="showPassword ? 'Sembunyikan password' : 'Lihat password'"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="btn bg-sun hover:bg-sun/90 text-ink w-full h-11 font-head font-bold text-sm sm:text-base mt-2 border-2 border-ink rounded-full shadow-[3px_3px_0_#1B2430] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#1B2430] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Loader2 v-if="loading" :size="16" class="animate-spin" />
              <span>{{ loading ? 'Memverifikasi Kredensial...' : 'Masuk Panel Admin' }}</span>
            </button>
          </form>

          <p class="text-center text-xs text-ink/60 mt-6 font-medium">
            Halaman ini tidak terbuka untuk umum. Seluruh aktivitas login tercatat di sistem audit.
          </p>
        </div>
      </div>
    </main>

    <footer class="max-w-md w-full mx-auto text-center pb-2 sm:pb-4 text-xs font-semibold text-ink/45">
      Mochibako Security Management &bull; Akses Terbatas
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Box, User, Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import ToastNotice from '@/components/ToastNotice.vue'
import GoogleOneTap from '@/components/GoogleOneTap.vue'
import { useSeo } from '@/composables/useSeo'

useSeo({
  title: 'Daftar Akun Baru',
  description: 'Daftar akun Mochibako untuk menyimpan wishlist produk impian dan belanja merch anime favorit.',
})

const router = useRouter()
const { register, loading, error, quickGoogleLogin } = useAuth()
const { showToast } = useToast()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const agreeTerms = ref(true)

async function handleRegister() {
  if (!name.value || !email.value || !password.value) {
    showToast('Harap lengkapi semua kolom')
    return
  }

  if (password.value.length < 6) {
    showToast('Password minimal 6 karakter')
    return
  }

  if (password.value !== confirmPassword.value) {
    showToast('Konfirmasi password tidak cocok')
    return
  }

  if (!agreeTerms.value) {
    showToast('Harap setujui syarat & ketentuan')
    return
  }

  const success = await register(name.value, email.value, password.value)
  if (success) {
    showToast('Pendaftaran berhasil! Selamat bergabung di Mochibako 🎉')
    setTimeout(() => {
      router.push('/')
    }, 700)
  } else {
    showToast(error.value || 'Gagal mendaftar')
  }
}

function handleGoogleRegister() {
  quickGoogleLogin()
}
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col justify-between p-3.5 sm:p-6">
    <!-- Top Nav Back Link -->
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

    <!-- Main Card (Responsive) -->
    <main class="max-w-md w-full mx-auto my-4 sm:my-8">
      <div class="nb p-5 sm:p-8 relative overflow-hidden shadow-[5px_5px_0_#1B2430] sm:shadow-[6px_6px_0_#1B2430] rounded-2xl sm:rounded-3xl">
        <!-- Decorative background circle -->
        <span
          class="absolute -left-12 -top-12 w-36 sm:w-40 h-36 sm:h-40 rounded-full bg-pinky/30 pointer-events-none"
          aria-hidden="true"
        ></span>

        <!-- Header / Greeting -->
        <div class="relative z-10 text-center mb-5 sm:mb-6">
          <span class="inline-block rotate-2 bg-mint border-2 border-ink rounded-md px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-extrabold shadow-sm mb-2">
            Gabung Komunitas! 🌸
          </span>
          <h1 class="font-head font-bold text-2xl sm:text-4xl text-ink">
            Buat Akun
          </h1>
          <p class="text-xs sm:text-sm font-semibold text-ink/70 mt-1">
            Simpan produk impian dan nikmati promo eksklusif
          </p>
        </div>

        <!-- Error Alert -->
        <div
          v-if="error"
          class="mb-4 p-2.5 sm:p-3 rounded-xl bg-destructive/10 border-2 border-destructive text-destructive text-xs sm:text-sm font-bold"
        >
          {{ error }}
        </div>

        <!-- Form -->
        <form class="space-y-3 sm:space-y-3.5 relative z-10" @submit.prevent="handleRegister">
          <!-- Name field -->
          <div>
            <label for="name" class="block font-head font-semibold text-xs sm:text-sm mb-1 text-ink">
              Nama Lengkap
            </label>
            <div class="relative">
              <User
                :size="17"
                :stroke-width="2.4"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/50"
              />
              <input
                id="name"
                v-model="name"
                type="text"
                required
                autocomplete="name"
                placeholder="misal: Sakura Kinomoto"
                class="w-full h-10 sm:h-11 rounded-full border-2 border-ink bg-white pl-10 pr-4 font-semibold placeholder:text-ink/40 focus:outline-none focus:border-sun text-ink text-xs sm:text-sm"
              />
            </div>
          </div>

          <!-- Email field -->
          <div>
            <label for="reg-email" class="block font-head font-semibold text-xs sm:text-sm mb-1 text-ink">
              Email
            </label>
            <div class="relative">
              <Mail
                :size="17"
                :stroke-width="2.4"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/50"
              />
              <input
                id="reg-email"
                v-model="email"
                type="email"
                inputmode="email"
                required
                autocomplete="email"
                placeholder="nama@email.com"
                class="w-full h-10 sm:h-11 rounded-full border-2 border-ink bg-white pl-10 pr-4 font-semibold placeholder:text-ink/40 focus:outline-none focus:border-sun text-ink text-xs sm:text-sm"
              />
            </div>
          </div>

          <!-- Password field -->
          <div>
            <label for="reg-password" class="block font-head font-semibold text-xs sm:text-sm mb-1 text-ink">
              Password
            </label>
            <div class="relative">
              <Lock
                :size="17"
                :stroke-width="2.4"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/50"
              />
              <input
                id="reg-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                placeholder="Minimal 6 karakter"
                class="w-full h-10 sm:h-11 rounded-full border-2 border-ink bg-white pl-10 pr-10 sm:pr-11 font-semibold placeholder:text-ink/40 focus:outline-none focus:border-sun text-ink text-xs sm:text-sm"
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

          <!-- Confirm Password field -->
          <div>
            <label for="confirm-password" class="block font-head font-semibold text-xs sm:text-sm mb-1 text-ink">
              Konfirmasi Password
            </label>
            <div class="relative">
              <Lock
                :size="17"
                :stroke-width="2.4"
                class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/50"
              />
              <input
                id="confirm-password"
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                placeholder="Ketik ulang password"
                class="w-full h-10 sm:h-11 rounded-full border-2 border-ink bg-white pl-10 pr-4 font-semibold placeholder:text-ink/40 focus:outline-none focus:border-sun text-ink text-xs sm:text-sm"
              />
            </div>
          </div>

          <!-- Agreement checkbox -->
          <div class="pt-0.5">
            <label class="flex items-start gap-2 cursor-pointer select-none">
              <input
                v-model="agreeTerms"
                type="checkbox"
                class="w-4 h-4 mt-0.5 rounded border-2 border-ink text-sun focus:ring-0 focus:outline-none cursor-pointer"
              />
              <span class="text-[11px] sm:text-xs font-semibold text-ink/75 leading-tight">
                Saya menyetujui ketentuan layanan dan privasi Mochibako.
              </span>
            </label>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading"
            class="btn bg-sun text-ink w-full h-10 sm:h-11 font-head font-semibold text-sm sm:text-base mt-2 shadow-[3px_3px_0_#1B2430]"
          >
            <span v-if="loading">Mendaftarkan...</span>
            <span v-else>Daftar Akun</span>
          </button>
        </form>

        <!-- Divider -->
        <div class="relative my-4 sm:my-5 text-center">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t-2 border-dashed border-soft"></span>
          </div>
          <span class="relative bg-white px-2.5 text-[11px] sm:text-xs font-bold text-ink/50 uppercase tracking-wider">
            atau
          </span>
        </div>

        <!-- Google 1-Tap / Sign-In Button -->
        <button
          type="button"
          class="btn bg-white text-ink w-full h-10 sm:h-11 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[3px_3px_0_#1B2430] hover:bg-soft transition-colors cursor-pointer"
          @click="handleGoogleRegister"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
          <span>Daftar 1-Klik dengan Google</span>
        </button>

        <!-- Login Link -->
        <p class="text-center text-xs sm:text-sm font-semibold text-ink/75 mt-5 sm:mt-6">
          Sudah punya akun?
          <RouterLink to="/login" class="font-head font-bold text-ink underline hover:text-sun ml-1">
            Masuk di sini
          </RouterLink>
        </p>
      </div>
    </main>

    <!-- Footer Note -->
    <footer class="text-center text-[11px] sm:text-xs font-semibold text-ink/50 pb-2">
      Mochibako · Belanja Merchandise Anime Aman & Nyaman
    </footer>

    <!-- Google One Tap Prompt -->
    <GoogleOneTap />

    <!-- Toast Notice -->
    <ToastNotice />
  </div>
</template>

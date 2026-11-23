<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Box, Sparkles, AlertCircle } from 'lucide-vue-next'
import { hasAnyRole, useAuth, initAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const { fetchProfile } = useAuth()
const { showToast } = useToast()

const hasError = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const err = params.get('error')
  const errDesc = params.get('error_description')

  // Handle Google OAuth error or cancellation
  if (err) {
    hasError.value = true
    errorMessage.value = errDesc || err || 'Login Google dibatalkan atau ditolak'
    showToast(errorMessage.value)
    setTimeout(() => {
      router.replace('/login')
    }, 2000)
    return
  }

  // Backend memasang cookie HttpOnly sebelum mengarahkan kembali ke sini.
  initAuth()
  const profile = await fetchProfile()
  if (!profile) {
    hasError.value = true
    errorMessage.value = 'Profil akun tidak dapat diverifikasi oleh server.'
    showToast(errorMessage.value)
    setTimeout(() => router.replace('/login'), 2000)
    return
  }
  showToast('Berhasil masuk dengan akun Google! ✨')
  const target = hasAnyRole(profile, ['admin', 'staff']) ? '/admin' : '/'
  setTimeout(() => {
    router.replace(target)
  }, 600)
})
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col items-center justify-center p-4">
    <div class="nb p-8 max-w-sm w-full text-center shadow-[6px_6px_0_#1B2430] rounded-3xl rise border-[2.5px] border-ink bg-white">
      <!-- Error State -->
      <div v-if="hasError">
        <div class="w-14 h-14 rounded-2xl bg-destructive/15 border-2 border-destructive mx-auto grid place-items-center mb-4 shadow-[3px_3px_0_#1B2430] pop">
          <AlertCircle :size="28" :stroke-width="2.4" class="text-destructive" />
        </div>
        <h2 class="font-head font-bold text-2xl text-ink">
          Gagal Masuk
        </h2>
        <p class="text-sm font-semibold text-destructive mt-1">
          {{ errorMessage }}
        </p>
        <p class="text-xs font-bold text-ink/60 mt-4">
          Mengalihkan kembali ke halaman login...
        </p>
      </div>

      <!-- Success / Loading State -->
      <div v-else>
        <div class="w-14 h-14 rounded-2xl bg-sun border-2 border-ink mx-auto grid place-items-center mb-4 shadow-[3px_3px_0_#1B2430] pop">
          <Box :size="28" :stroke-width="2.4" class="text-ink animate-bounce" />
        </div>

        <h2 class="font-head font-bold text-2xl text-ink">
          Menghubungkan Akun...
        </h2>
        <p class="text-sm font-semibold text-ink/70 mt-1">
          Memverifikasi login Google kamu ke Mochibako.
        </p>

        <div class="mt-6 flex justify-center items-center gap-2 text-xs font-bold text-ink/60">
          <Sparkles :size="16" class="text-sun animate-spin" />
          <span>Tunggu sebentar ya...</span>
        </div>
      </div>
    </div>
  </div>
</template>

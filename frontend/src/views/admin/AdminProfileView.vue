<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  User,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Camera,
  Upload,
  Trash2,
  Link as LinkIcon,
} from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { imageUrl } from '@/lib/productVisual'

const { user, fetchProfile } = useAuth()

const avatarFailed = ref(false)
const userAvatar = computed(() => imageUrl(user.value?.avatar_url || user.value?.avatar))

watch(userAvatar, () => {
  avatarFailed.value = false
})

// Form Foto Profil
const fileInput = ref<HTMLInputElement | null>(null)
const avatarUrlInput = ref('')
const avatarBusy = ref(false)
const avatarSuccess = ref('')
const avatarError = ref('')

// Form Nama Pengguna
const name = ref('')
const nameBusy = ref(false)
const nameSuccess = ref('')
const nameError = ref('')

// Form Kata Sandi
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)
const passwordBusy = ref(false)
const passwordSuccess = ref('')
const passwordError = ref('')

onMounted(() => {
  if (user.value?.name) {
    name.value = user.value.name
  }
  if (user.value?.avatar_url) {
    avatarUrlInput.value = user.value.avatar_url
  }
})

watch(
  () => user.value?.avatar_url,
  (val) => {
    if (val) avatarUrlInput.value = val
  },
)

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  avatarError.value = ''
  avatarSuccess.value = ''

  if (file.size > 5 * 1024 * 1024) {
    avatarError.value = 'Ukuran file foto maksimal 5 MB.'
    target.value = ''
    return
  }

  avatarBusy.value = true
  try {
    await adminApi.uploadAvatar(file)
    avatarSuccess.value = 'Foto profil berhasil diunggah dan diperbarui!'
    await fetchProfile()
  } catch (cause) {
    avatarError.value = cause instanceof ApiError ? cause.message : 'Gagal mengunggah foto profil.'
  } finally {
    avatarBusy.value = false
    target.value = ''
  }
}

async function submitAvatarUrl() {
  avatarError.value = ''
  avatarSuccess.value = ''
  const trimmed = avatarUrlInput.value.trim()

  avatarBusy.value = true
  try {
    await adminApi.updateMyProfile({ avatar_url: trimmed || null })
    avatarSuccess.value = trimmed ? 'URL foto profil berhasil disimpan!' : 'Foto profil berhasil dikosongkan.'
    await fetchProfile()
  } catch (cause) {
    avatarError.value = cause instanceof ApiError ? cause.message : 'Gagal menyimpan URL foto profil.'
  } finally {
    avatarBusy.value = false
  }
}

async function handleRemoveAvatar() {
  if (!window.confirm('Hapus foto profil Anda?')) return

  avatarError.value = ''
  avatarSuccess.value = ''
  avatarBusy.value = true
  try {
    await adminApi.removeAvatar()
    avatarUrlInput.value = ''
    avatarSuccess.value = 'Foto profil berhasil dihapus!'
    await fetchProfile()
  } catch (cause) {
    avatarError.value = cause instanceof ApiError ? cause.message : 'Gagal menghapus foto profil.'
  } finally {
    avatarBusy.value = false
  }
}

async function submitUpdateName() {
  nameError.value = ''
  nameSuccess.value = ''
  const trimmed = name.value.trim()

  if (!trimmed || trimmed.length < 2) {
    nameError.value = 'Nama pengguna minimal 2 karakter.'
    return
  }

  nameBusy.value = true
  try {
    await adminApi.updateMyProfile({ name: trimmed })
    nameSuccess.value = 'Nama pengguna berhasil diperbarui!'
    await fetchProfile()
  } catch (cause) {
    nameError.value = cause instanceof ApiError ? cause.message : 'Gagal memperbarui nama pengguna.'
  } finally {
    nameBusy.value = false
  }
}

async function submitUpdatePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!currentPassword.value) {
    passwordError.value = 'Harap masukkan kata sandi saat ini.'
    return
  }
  if (!newPassword.value || newPassword.value.length < 8) {
    passwordError.value = 'Kata sandi baru minimal 8 karakter.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Konfirmasi kata sandi baru tidak cocok.'
    return
  }

  passwordBusy.value = true
  try {
    await adminApi.updateMyProfile({
      current_password: currentPassword.value,
      new_password: newPassword.value,
    })
    passwordSuccess.value = 'Kata sandi berhasil diperbarui!'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (cause) {
    passwordError.value = cause instanceof ApiError ? cause.message : 'Gagal memperbarui kata sandi.'
  } finally {
    passwordBusy.value = false
  }
}
</script>

<template>
  <div class="admin-page max-w-4xl space-y-6">
    <AdminPageHeader
      title="Profil Saya"
      description="Kelola foto profil, informasi akun internal, nama tampilan, dan kata sandi Anda"
    />

    <!-- Ringkasan Akun Card -->
    <div class="p-5 sm:p-6 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430]">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <span class="w-16 h-16 rounded-2xl bg-sun border-2 border-ink grid place-items-center font-head font-extrabold text-2xl text-ink shadow-[2px_2px_0_#1B2430] overflow-hidden shrink-0">
            <img
              v-if="userAvatar && !avatarFailed"
              :src="userAvatar"
              :alt="user?.name || 'Administrator'"
              class="w-full h-full object-cover"
              @error="avatarFailed = true"
            />
            <template v-else>
              {{ user?.name?.slice(0, 1).toUpperCase() || 'A' }}
            </template>
          </span>
          <div>
            <h2 class="font-head font-bold text-xl text-ink">
              {{ user?.name || 'Administrator' }}
            </h2>
            <p class="text-xs sm:text-sm text-ink/65 font-medium">
              {{ user?.email }}
            </p>
            <div class="flex items-center gap-2 mt-2">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-ink text-[11px] font-bold bg-sun/25 text-ink">
                <Shield :size="12" />
                {{ user?.role === 'admin' ? 'Administrator' : 'Staf Toko' }}
              </span>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-emerald-300 text-[11px] font-bold bg-emerald-50 text-emerald-800">
                <CheckCircle2 :size="12" class="text-emerald-600" />
                Akun Terverifikasi
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Kustomisasi Foto Profil Card -->
    <section class="p-5 sm:p-6 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430]">
      <div class="flex items-center gap-2 mb-4 pb-3 border-b-2 border-ink/10">
        <div class="w-8 h-8 rounded-lg bg-sun/30 border border-ink grid place-items-center">
          <Camera :size="16" class="text-ink" />
        </div>
        <div>
          <h3 class="font-head font-bold text-base text-ink">Foto Profil</h3>
          <p class="text-[11px] text-ink/60">Kustomisasi foto profil yang tampil di topbar, sidebar, dan akun Anda</p>
        </div>
      </div>

      <div v-if="avatarSuccess" class="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
        <CheckCircle2 :size="15" class="shrink-0" />
        <span>{{ avatarSuccess }}</span>
      </div>

      <div v-if="avatarError" class="mb-4 p-3 rounded-xl bg-destructive/10 border-2 border-destructive text-destructive text-xs font-bold flex items-center gap-2">
        <AlertCircle :size="15" class="shrink-0" />
        <span>{{ avatarError }}</span>
      </div>

      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <!-- Preview Foto -->
        <div class="relative shrink-0">
          <div class="w-24 h-24 rounded-2xl border-2 border-ink bg-sun shadow-[3px_3px_0_#1B2430] overflow-hidden grid place-items-center">
            <img
              v-if="userAvatar && !avatarFailed"
              :src="userAvatar"
              :alt="user?.name || 'Foto Profil'"
              class="w-full h-full object-cover"
              @error="avatarFailed = true"
            />
            <span v-else class="font-head font-extrabold text-3xl text-ink">
              {{ user?.name?.slice(0, 1).toUpperCase() || 'A' }}
            </span>
          </div>
          <span class="absolute -bottom-1.5 -right-1.5 rounded-full border border-ink bg-white p-1 text-ink shadow">
            <Camera :size="13" />
          </span>
        </div>

        <!-- Tombol Aksi Upload / Hapus -->
        <div class="flex-1 w-full space-y-4">
          <div class="flex flex-wrap items-center gap-2.5">
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              class="hidden"
              @change="handleFileSelect"
            />
            <AdminButton
              variant="primary"
              :disabled="avatarBusy"
              @click="triggerFileInput"
            >
              <Loader2 v-if="avatarBusy" :size="15" class="animate-spin inline mr-1" />
              <Upload v-else :size="15" class="inline mr-1" />
              <span>{{ avatarBusy ? 'Mengunggah...' : 'Unggah Foto Baru' }}</span>
            </AdminButton>

            <button
              v-if="user?.avatar_url || user?.avatar"
              type="button"
              class="inline-flex h-[36px] items-center gap-1.5 rounded-xl border border-destructive/30 bg-white px-3 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
              :disabled="avatarBusy"
              @click="handleRemoveAvatar"
            >
              <Trash2 :size="14" />
              <span>Hapus Foto</span>
            </button>
          </div>
          <p class="text-[11px] text-ink/55">
            Format yang didukung: JPG, PNG, WebP, GIF, atau AVIF. Maksimal ukuran file 5 MB.
          </p>

          <!-- Opsi URL Foto Profil -->
          <div class="pt-2 border-t border-ink/10">
            <label class="block font-head font-semibold text-xs mb-1.5 text-ink flex items-center gap-1">
              <LinkIcon :size="12" /> Atau masukkan URL gambar langsung
            </label>
            <div class="flex flex-col sm:flex-row gap-2">
              <input
                v-model="avatarUrlInput"
                type="url"
                placeholder="https://example.com/foto-profil.jpg"
                class="flex-1 h-9 rounded-lg border-2 border-ink bg-white px-3 text-xs font-semibold focus:outline-none focus:border-sun"
              />
              <AdminButton
                variant="secondary"
                :disabled="avatarBusy"
                @click="submitAvatarUrl"
              >
                <span>Simpan URL</span>
              </AdminButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Form Edit Nama / Username -->
      <section class="p-5 sm:p-6 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430] flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-2 mb-4 pb-3 border-b-2 border-ink/10">
            <div class="w-8 h-8 rounded-lg bg-pinky/30 border border-ink grid place-items-center">
              <User :size="16" class="text-ink" />
            </div>
            <div>
              <h3 class="font-head font-bold text-base text-ink">Nama Tampilan</h3>
              <p class="text-[11px] text-ink/60">Nama yang tampil di panel administrasi</p>
            </div>
          </div>

          <div v-if="nameSuccess" class="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 :size="15" class="shrink-0" />
            <span>{{ nameSuccess }}</span>
          </div>

          <div v-if="nameError" class="mb-4 p-3 rounded-xl bg-destructive/10 border-2 border-destructive text-destructive text-xs font-bold flex items-center gap-2">
            <AlertCircle :size="15" class="shrink-0" />
            <span>{{ nameError }}</span>
          </div>

          <form class="space-y-4" @submit.prevent="submitUpdateName">
            <div>
              <label class="block font-head font-semibold text-xs mb-1.5 text-ink">
                Nama Pengguna / Username
              </label>
              <input
                v-model="name"
                type="text"
                required
                placeholder="Masukkan nama pengguna"
                class="w-full h-10 rounded-lg border-2 border-ink bg-white px-3 text-xs sm:text-sm font-semibold focus:outline-none focus:border-sun"
              />
            </div>

            <div>
              <label class="block font-head font-semibold text-xs mb-1.5 text-ink">
                Alamat Email (Permanen)
              </label>
              <input
                :value="user?.email"
                type="text"
                disabled
                class="w-full h-10 rounded-lg border border-ink/30 bg-soft/50 px-3 text-xs sm:text-sm font-medium text-ink/60 cursor-not-allowed"
              />
              <p class="text-[10px] text-ink/45 mt-1">Email akun administrator terikat pada identitas sistem.</p>
            </div>

            <div class="pt-2">
              <AdminButton
                type="submit"
                variant="primary"
                :disabled="nameBusy"
                class="w-full justify-center"
              >
                <Loader2 v-if="nameBusy" :size="15" class="animate-spin inline mr-1" />
                <Save v-else :size="15" class="inline mr-1" />
                <span>{{ nameBusy ? 'Menyimpan...' : 'Simpan Perubahan Nama' }}</span>
              </AdminButton>
            </div>
          </form>
        </div>
      </section>

      <!-- Form Ganti Kata Sandi -->
      <section class="p-5 sm:p-6 rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430]">
        <div class="flex items-center gap-2 mb-4 pb-3 border-b-2 border-ink/10">
          <div class="w-8 h-8 rounded-lg bg-sun/30 border border-ink grid place-items-center">
            <KeyRound :size="16" class="text-ink" />
          </div>
          <div>
            <h3 class="font-head font-bold text-base text-ink">Ubah Kata Sandi</h3>
            <p class="text-[11px] text-ink/60">Pastikan gunakan kombinasi yang kuat dan aman</p>
          </div>
        </div>

        <div v-if="passwordSuccess" class="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 :size="15" class="shrink-0" />
          <span>{{ passwordSuccess }}</span>
        </div>

        <div v-if="passwordError" class="mb-4 p-3 rounded-xl bg-destructive/10 border-2 border-destructive text-destructive text-xs font-bold flex items-center gap-2">
          <AlertCircle :size="15" class="shrink-0" />
          <span>{{ passwordError }}</span>
        </div>

        <form class="space-y-3.5" @submit.prevent="submitUpdatePassword">
          <div>
            <label class="block font-head font-semibold text-xs mb-1 text-ink">
              Kata Sandi Saat Ini
            </label>
            <div class="relative">
              <input
                v-model="currentPassword"
                :type="showCurrent ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="Masukkan kata sandi lama"
                class="w-full h-10 rounded-lg border-2 border-ink bg-white pl-3 pr-9 text-xs sm:text-sm font-semibold focus:outline-none focus:border-sun"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink cursor-pointer"
                @click="showCurrent = !showCurrent"
              >
                <EyeOff v-if="showCurrent" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
          </div>

          <div>
            <label class="block font-head font-semibold text-xs mb-1 text-ink">
              Kata Sandi Baru
            </label>
            <div class="relative">
              <input
                v-model="newPassword"
                :type="showNew ? 'text' : 'password'"
                required
                autocomplete="new-password"
                placeholder="Minimal 8 karakter"
                class="w-full h-10 rounded-lg border-2 border-ink bg-white pl-3 pr-9 text-xs sm:text-sm font-semibold focus:outline-none focus:border-sun"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink cursor-pointer"
                @click="showNew = !showNew"
              >
                <EyeOff v-if="showNew" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
          </div>

          <div>
            <label class="block font-head font-semibold text-xs mb-1 text-ink">
              Konfirmasi Kata Sandi Baru
            </label>
            <div class="relative">
              <input
                v-model="confirmPassword"
                :type="showConfirm ? 'text' : 'password'"
                required
                autocomplete="new-password"
                placeholder="Ulangi kata sandi baru"
                class="w-full h-10 rounded-lg border-2 border-ink bg-white pl-3 pr-9 text-xs sm:text-sm font-semibold focus:outline-none focus:border-sun"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink cursor-pointer"
                @click="showConfirm = !showConfirm"
              >
                <EyeOff v-if="showConfirm" :size="15" />
                <Eye v-else :size="15" />
              </button>
            </div>
          </div>

          <div class="pt-2">
            <AdminButton
              type="submit"
              variant="primary"
              :disabled="passwordBusy"
              class="w-full justify-center"
            >
              <Loader2 v-if="passwordBusy" :size="15" class="animate-spin inline mr-1" />
              <KeyRound v-else :size="15" class="inline mr-1" />
              <span>{{ passwordBusy ? 'Memperbarui...' : 'Perbarui Kata Sandi' }}</span>
            </AdminButton>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

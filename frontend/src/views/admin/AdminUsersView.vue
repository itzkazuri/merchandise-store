<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Users,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminState from '@/components/ui/AdminState.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppConfirmDialog from '@/components/ui/AppConfirmDialog.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
import { hasAnyRole, useAuth } from '@/composables/useAuth'

interface RoleItem {
  id: number
  name: string
  description?: string
}

interface UserItem {
  id: number
  name: string
  email: string
  is_active: boolean
  roles: RoleItem[]
  created_at: string
  updated_at: string
}

const { user: currentUser } = useAuth()
const isAdmin = computed(() => hasAnyRole(currentUser.value, ['admin']))

const items = ref<UserItem[]>([])
const loading = ref(true)
const busyId = ref<number | null>(null)
const error = ref('')
const notice = ref('')

const searchQuery = ref('')
const roleFilter = ref<'all' | 'admin' | 'staff'>('all')

// Dialog Tambah User (Tailwind Custom Modal)
const dialogOpen = ref(false)
const formBusy = ref(false)
const formError = ref('')
const showPassword = ref(false)

const form = ref({
  name: '',
  email: '',
  password: '',
  role: 'staff' as 'admin' | 'staff',
})

const roleFormOptions: { value: 'admin' | 'staff'; label: string; description: string }[] = [
  { value: 'staff', label: 'Staf Toko', description: 'Akses pesanan, stok produk, dan kasir POS' },
  { value: 'admin', label: 'Administrator', description: 'Akses penuh termasuk kelola akun pengguna' },
]

// Dialog Konfirmasi & Alert Kustom Tailwind
const confirmState = ref({
  open: false,
  title: '',
  message: '',
  variant: 'primary' as 'danger' | 'warning' | 'primary' | 'info',
  confirmText: 'Lanjutkan',
  cancelText: 'Batal',
  alertOnly: false,
  busy: false,
  onConfirm: null as (() => Promise<void> | void) | null,
})

function showAlert(
  title: string,
  message: string,
  variant: 'danger' | 'warning' | 'primary' | 'info' = 'warning',
) {
  confirmState.value = {
    open: true,
    title,
    message,
    variant,
    confirmText: 'Mengerti',
    cancelText: '',
    alertOnly: true,
    busy: false,
    onConfirm: () => {
      confirmState.value.open = false
    },
  }
}

function showConfirm(
  title: string,
  message: string,
  variant: 'danger' | 'warning' | 'primary' | 'info',
  confirmText: string,
  action: () => Promise<void> | void,
) {
  confirmState.value = {
    open: true,
    title,
    message,
    variant,
    confirmText,
    cancelText: 'Batal',
    alertOnly: false,
    busy: false,
    onConfirm: action,
  }
}

async function handleConfirmAction() {
  if (confirmState.value.busy) return
  if (confirmState.value.onConfirm) {
    confirmState.value.busy = true
    try {
      await confirmState.value.onConfirm()
    } finally {
      confirmState.value.busy = false
      confirmState.value.open = false
    }
  } else {
    confirmState.value.open = false
  }
}

const filteredItems = computed(() => {
  return items.value.filter((item) => {
    const matchRole =
      roleFilter.value === 'all' ||
      item.roles.some((r) => r.name === roleFilter.value)
    const q = searchQuery.value.trim().toLowerCase()
    const matchQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q)
    return matchRole && matchQuery
  })
})

const totalAdmin = computed(() => items.value.filter((u) => u.roles.some((r) => r.name === 'admin')).length)
const totalStaff = computed(() => items.value.filter((u) => u.roles.some((r) => r.name === 'staff')).length)
const totalActive = computed(() => items.value.filter((u) => u.is_active).length)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.users() as { items?: UserItem[] } | UserItem[]
    if (Array.isArray(res)) {
      items.value = res
    } else if (res && Array.isArray(res.items)) {
      items.value = res.items
    } else {
      items.value = []
    }
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Daftar pengguna gagal dimuat.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = {
    name: '',
    email: '',
    password: '',
    role: 'staff',
  }
  showPassword.value = false
  formError.value = ''
  dialogOpen.value = true
}

async function submitCreate() {
  formError.value = ''
  const name = form.value.name.trim()
  const email = form.value.email.trim().toLowerCase()
  const password = form.value.password

  if (!name || name.length < 2) {
    formError.value = 'Nama lengkap minimal 2 karakter.'
    return
  }
  if (!email || !email.includes('@')) {
    formError.value = 'Format email tidak valid.'
    return
  }
  if (!password || password.length < 8) {
    formError.value = 'Kata sandi minimal 8 karakter.'
    return
  }

  formBusy.value = true
  try {
    await adminApi.createUser({
      name,
      email,
      password,
      role: form.value.role,
    })
    dialogOpen.value = false
    notice.value = `Akun ${form.value.role} ${email} berhasil dibuat.`
    await load()
  } catch (cause) {
    formError.value = cause instanceof ApiError ? cause.message : 'Gagal membuat pengguna baru.'
  } finally {
    formBusy.value = false
  }
}

function toggleUserStatus(target: UserItem) {
  if (busyId.value) return
  if (target.id === currentUser.value?.id) {
    showAlert('Akses Dibatasi', 'Tidak dapat menonaktifkan akun yang sedang Anda gunakan!', 'warning')
    return
  }

  const nextStatus = !target.is_active
  const actionText = nextStatus ? 'mengaktifkan' : 'menonaktifkan'
  const variant = nextStatus ? 'primary' : 'danger'

  showConfirm(
    `${nextStatus ? 'Aktifkan' : 'Nonaktifkan'} Akun Pengguna`,
    `Apakah Anda yakin ingin ${actionText} akun ${target.name} (${target.email})? ${nextStatus ? 'Pengguna akan dapat masuk kembali ke sistem.' : 'Pengguna tidak akan dapat mengakses panel ini.'}`,
    variant,
    nextStatus ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan',
    async () => {
      busyId.value = target.id
      try {
        await adminApi.setUserStatus(target.id, { is_active: nextStatus })
        target.is_active = nextStatus
        notice.value = `Status akun ${target.name} berhasil diubah.`
      } catch (cause) {
        showAlert('Gagal', cause instanceof ApiError ? cause.message : 'Gagal mengubah status akun.', 'danger')
      } finally {
        busyId.value = null
      }
    },
  )
}

function changeRole(target: UserItem, newRole: 'admin' | 'staff') {
  if (busyId.value) return
  if (target.id === currentUser.value?.id && newRole !== 'admin') {
    showAlert('Akses Dibatasi', 'Tidak dapat menghapus hak administrator dari akun Anda sendiri!', 'warning')
    return
  }

  const roleName = newRole === 'admin' ? 'Administrator' : 'Staf'
  const isUpgrading = newRole === 'admin'

  showConfirm(
    `Ubah Role Akun ke ${roleName}`,
    `Apakah Anda yakin ingin mengubah role akun ${target.name} menjadi ${roleName}? ${isUpgrading ? 'Pengguna ini akan memiliki akses penuh ke pengaturan sistem.' : 'Akses pengguna akan dibatasi untuk operasional toko.'}`,
    isUpgrading ? 'warning' : 'primary',
    `Jadikan ${roleName}`,
    async () => {
      busyId.value = target.id
      try {
        const updated = await adminApi.setUserRoles(target.id, [newRole]) as UserItem
        target.roles = updated.roles
        notice.value = `Role akun ${target.name} berhasil diubah menjadi ${roleName}.`
      } catch (cause) {
        showAlert('Gagal', cause instanceof ApiError ? cause.message : 'Gagal mengubah role akun.', 'danger')
      } finally {
        busyId.value = null
      }
    },
  )
}

onMounted(load)
</script>

<template>
  <div class="admin-page">
    <AdminPageHeader
      title="Kelola Staf & Admin"
      description="Kelola akun internal yang memiliki akses operasional dan administratif toko"
    >
      <AdminButton v-if="isAdmin" variant="primary" @click="openCreate">
        <Plus :size="16" /> Tambah Akun
      </AdminButton>
    </AdminPageHeader>

    <div v-if="notice" class="admin-notice">
      <span>{{ notice }}</span>
      <button type="button" @click="notice = ''">&times;</button>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
      <div class="p-4 rounded-xl border-2 border-ink bg-white shadow-[3px_3px_0_#1B2430] flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-sun/30 border border-ink grid place-items-center">
          <ShieldAlert :size="20" class="text-ink" />
        </div>
        <div>
          <p class="text-xs font-bold text-ink/60 uppercase tracking-wider">Administrator</p>
          <p class="text-xl font-head font-extrabold text-ink">{{ totalAdmin }} Akun</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border-2 border-ink bg-white shadow-[3px_3px_0_#1B2430] flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-moss/30 border border-ink grid place-items-center">
          <ShieldCheck :size="20" class="text-ink" />
        </div>
        <div>
          <p class="text-xs font-bold text-ink/60 uppercase tracking-wider">Staf Toko</p>
          <p class="text-xl font-head font-extrabold text-ink">{{ totalStaff }} Akun</p>
        </div>
      </div>

      <div class="p-4 rounded-xl border-2 border-ink bg-white shadow-[3px_3px_0_#1B2430] flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-pinky/30 border border-ink grid place-items-center">
          <Users :size="20" class="text-ink" />
        </div>
        <div>
          <p class="text-xs font-bold text-ink/60 uppercase tracking-wider">Akun Aktif</p>
          <p class="text-xl font-head font-extrabold text-ink">{{ totalActive }} / {{ items.length }}</p>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4">
      <div class="flex gap-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border border-ink text-xs font-bold transition-colors cursor-pointer"
          :class="roleFilter === 'all' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-soft'"
          @click="roleFilter = 'all'"
        >
          Semua ({{ items.length }})
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border border-ink text-xs font-bold transition-colors cursor-pointer"
          :class="roleFilter === 'admin' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-soft'"
          @click="roleFilter = 'admin'"
        >
          Admin ({{ totalAdmin }})
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border border-ink text-xs font-bold transition-colors cursor-pointer"
          :class="roleFilter === 'staff' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-soft'"
          @click="roleFilter = 'staff'"
        >
          Staf ({{ totalStaff }})
        </button>
      </div>

      <div class="relative min-w-[240px]">
        <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-ink/50" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama atau email..."
          class="w-full h-9 pl-9 pr-3 rounded-lg border border-ink bg-white text-xs font-semibold focus:outline-none focus:border-sun"
        />
      </div>
    </div>

    <!-- Table Content -->
    <AdminState v-if="loading" kind="loading" message="Memuat daftar staf & admin..." />
    <AdminState v-else-if="error" kind="error" :message="error" @retry="load" />
    <AdminState v-else-if="filteredItems.length === 0" kind="empty" message="Tidak ada pengguna yang cocok." />

    <div v-else class="admin-table-wrap border-2 border-ink rounded-xl overflow-hidden shadow-[4px_4px_0_#1B2430] bg-white">
      <table class="admin-table w-full text-left text-xs sm:text-sm">
        <thead class="bg-soft/70 border-b-2 border-ink font-head font-bold text-ink">
          <tr>
            <th class="p-3">Pengguna</th>
            <th class="p-3">Role</th>
            <th class="p-3">Status</th>
            <th class="p-3">Tanggal Dibuat</th>
            <th v-if="isAdmin" class="p-3 text-right">Tindakan</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink/10">
          <tr v-for="item in filteredItems" :key="item.id" class="hover:bg-soft/20 transition-colors">
            <td class="p-3">
              <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-full bg-sun/40 border border-ink grid place-items-center font-bold text-ink text-xs shrink-0">
                  {{ item.name.slice(0, 1).toUpperCase() }}
                </span>
                <div class="min-w-0">
                  <p class="font-bold text-ink truncate flex items-center gap-1.5">
                    {{ item.name }}
                    <span
                      v-if="item.id === currentUser?.id"
                      class="text-[10px] bg-sun border border-ink px-1.5 rounded font-extrabold"
                    >
                      Anda
                    </span>
                  </p>
                  <p class="text-xs text-ink/60 truncate">{{ item.email }}</p>
                </div>
              </div>
            </td>
            <td class="p-3">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="role in item.roles"
                  :key="role.id"
                  class="px-2 py-0.5 rounded-md border text-[11px] font-bold"
                  :class="role.name === 'admin' ? 'bg-sun/30 border-ink text-ink' : 'bg-moss/20 border-moss text-ink'"
                >
                  {{ role.name === 'admin' ? 'Administrator' : 'Staf' }}
                </span>
              </div>
            </td>
            <td class="p-3">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border"
                :class="item.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="item.is_active ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                {{ item.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </td>
            <td class="p-3 text-xs text-ink/70">
              {{ new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }}
            </td>
            <td v-if="isAdmin" class="p-3 text-right">
              <div class="inline-flex items-center gap-1.5">
                <!-- Ubah role -->
                <button
                  v-if="item.id !== currentUser?.id"
                  type="button"
                  :disabled="busyId === item.id"
                  class="btn bg-white hover:bg-soft text-ink border border-ink px-2.5 py-1 rounded-lg text-xs font-bold shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                  :title="item.roles.some((r) => r.name === 'admin') ? 'Ubah ke Staf' : 'Jadikan Admin'"
                  @click="changeRole(item, item.roles.some((r) => r.name === 'admin') ? 'staff' : 'admin')"
                >
                  <RefreshCw :size="13" class="inline mr-1" />
                  {{ item.roles.some((r) => r.name === 'admin') ? 'Jadikan Staf' : 'Jadikan Admin' }}
                </button>

                <!-- Toggle status -->
                <button
                  v-if="item.id !== currentUser?.id"
                  type="button"
                  :disabled="busyId === item.id"
                  class="btn border-2 px-2.5 py-1 rounded-lg text-xs font-bold shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                  :class="item.is_active ? 'bg-destructive/10 text-destructive border-destructive hover:bg-destructive/20' : 'bg-emerald-100 text-emerald-900 border-emerald-500 hover:bg-emerald-200'"
                  @click="toggleUserStatus(item)"
                >
                  <component :is="item.is_active ? UserX : UserCheck" :size="13" class="inline mr-1" />
                  {{ item.is_active ? 'Nonaktifkan' : 'Aktifkan' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Kustom Tailwind: Buat Pengguna Baru -->
    <AppModal
      v-model="dialogOpen"
      title="Tambah Staf / Administrator"
      description="Buat akun internal untuk akses operasional toko Mochibako"
      max-width="md"
    >
      <form class="space-y-4" novalidate @submit.prevent="submitCreate">
        <div v-if="formError" class="p-3 rounded-xl bg-destructive/10 border-2 border-destructive text-destructive text-xs font-bold">
          {{ formError }}
        </div>

        <div>
          <label class="block font-head font-semibold text-xs mb-1 text-ink">Nama Lengkap</label>
          <input
            v-model="form.name"
            type="text"
            required
            placeholder="Contoh: Rian Pratama"
            class="w-full h-10 rounded-xl border-2 border-ink bg-white px-3 text-xs font-semibold focus:outline-none focus:border-sun"
          />
        </div>

        <div>
          <label class="block font-head font-semibold text-xs mb-1 text-ink">Alamat Email</label>
          <input
            v-model="form.email"
            type="email"
            required
            placeholder="nama@mochibako.com"
            class="w-full h-10 rounded-xl border-2 border-ink bg-white px-3 text-xs font-semibold focus:outline-none focus:border-sun"
          />
        </div>

        <div>
          <label class="block font-head font-semibold text-xs mb-1 text-ink">Kata Sandi Awal</label>
          <div class="relative">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              placeholder="Minimal 8 karakter"
              class="w-full h-10 rounded-xl border-2 border-ink bg-white pl-3 pr-10 text-xs font-semibold focus:outline-none focus:border-sun"
            />
            <button
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50 hover:text-ink cursor-pointer"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" :size="16" />
              <Eye v-else :size="16" />
            </button>
          </div>
          <p class="text-[11px] text-ink/50 mt-1">Staf dapat mengganti kata sandi ini nanti di halaman profil masing-masing.</p>
        </div>

        <div>
          <label class="block font-head font-semibold text-xs mb-1.5 text-ink">Role Akun</label>
          <AppSelect
            v-model="form.role"
            :options="roleFormOptions"
            variant="admin"
            block
            aria-label="Pilih role akun"
          />
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-4 border-t-2 border-ink/10">
          <button
            type="button"
            class="btn bg-white hover:bg-soft text-ink border-2 border-ink px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            @click="dialogOpen = false"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="formBusy"
            class="btn bg-sun hover:bg-sun/90 text-ink border-2 border-ink px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer disabled:opacity-60"
          >
            {{ formBusy ? 'Menyimpan...' : 'Simpan Akun' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Modal Kustom Tailwind: Dialog Konfirmasi & Peringatan -->
    <AppConfirmDialog
      v-model="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :variant="confirmState.variant"
      :confirm-text="confirmState.confirmText"
      :cancel-text="confirmState.cancelText"
      :alert-only="confirmState.alertOnly"
      :busy="confirmState.busy"
      @confirm="handleConfirmAction"
      @cancel="confirmState.open = false"
    />
  </div>
</template>

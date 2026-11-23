<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  Boxes,
  ChartNoAxesCombined,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  Tags,
  UserCog,
  Users,
  X,
} from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'

const COLLAPSE_KEY = 'mochibako.admin.sidebar-collapsed'
const route = useRoute()
const router = useRouter()
const { user, logout } = useAuth()
const mobileOpen = ref(false)
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')

const nav = [
  { label: 'Ringkasan', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Pesanan', to: '/admin/orders', icon: ClipboardList },
  { label: 'Produk', to: '/admin/products', icon: Boxes },
  { label: 'Kategori', to: '/admin/categories', icon: Tags },
  { label: 'Kasir acara', to: '/admin/pos', icon: Store },
  { label: 'Pendapatan', to: '/admin/revenue', icon: ChartNoAxesCombined },
  { label: 'Staf & Admin', to: '/admin/users', icon: Users },
  { label: 'Profil saya', to: '/admin/profile', icon: UserCog },
]

const pageLabel = computed(() => nav.find((item) => item.to === route.path)?.label || 'Admin')
const roleLabel = computed(() => user.value?.role === 'admin' ? 'Administrator' : user.value?.role === 'staff' ? 'Staf Toko' : 'Pengguna')

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}

async function signOut() {
  await logout()
  await router.replace('/')
}
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col md:flex-row relative">
    <!-- Backdrop mobile scrim -->
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-ink/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
      aria-hidden="true"
      @click="mobileOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-50 bg-[#FBF9F3] border-r-2 border-ink flex flex-col justify-between transition-all duration-200 ease-in-out md:sticky md:top-0 md:h-screen"
      :class="[
        mobileOpen ? 'translate-x-0 shadow-[8px_0_0_#1B2430]' : '-translate-x-full md:translate-x-0',
        collapsed ? 'md:w-[76px]' : 'w-72 md:w-64',
      ]"
    >
      <!-- Collapse Toggle Button (Desktop only) -->
      <button
        type="button"
        class="hidden md:grid place-items-center absolute -right-3.5 top-6 w-7 h-7 rounded-full border-2 border-ink bg-white hover:bg-sun text-ink shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer z-50"
        :aria-label="collapsed ? 'Perluas sidebar' : 'Ringkas sidebar'"
        :title="collapsed ? 'Perluas sidebar' : 'Ringkas sidebar'"
        @click="toggleCollapse"
      >
        <PanelLeftOpen v-if="collapsed" :size="14" :stroke-width="2.5" />
        <PanelLeftClose v-else :size="14" :stroke-width="2.5" />
      </button>

      <!-- Sidebar Top & Nav -->
      <div class="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto">
        <!-- Brand Header -->
        <div class="flex items-center justify-between pb-5 mb-5 border-b-2 border-ink/10">
          <RouterLink to="/admin" class="flex items-center gap-3 min-w-0" :title="collapsed ? 'Mochibako Admin' : ''">
            <span class="w-10 h-10 rounded-xl bg-sun border-2 border-ink grid place-items-center text-ink shrink-0 shadow-[2px_2px_0_#1B2430]">
              <Boxes :size="20" :stroke-width="2.2" />
            </span>
            <div v-if="!collapsed" class="min-w-0">
              <strong class="font-head font-extrabold text-base text-ink block leading-tight">
                Mochibako
              </strong>
              <small class="text-[11px] font-bold text-ink/60 uppercase tracking-wider block">
                Ruang Operasional
              </small>
            </div>
          </RouterLink>

          <!-- Close button on mobile -->
          <button
            type="button"
            class="md:hidden w-8 h-8 rounded-lg border-2 border-ink bg-white grid place-items-center text-ink shadow-[2px_2px_0_#1B2430]"
            aria-label="Tutup menu"
            @click="mobileOpen = false"
          >
            <X :size="18" :stroke-width="2.5" />
          </button>
        </div>

        <!-- Section Caption -->
        <p
          v-if="!collapsed"
          class="text-[10px] font-extrabold text-ink/50 uppercase tracking-widest px-2 mb-2"
        >
          Menu Toko
        </p>

        <!-- Navigation Links -->
        <nav class="space-y-1" aria-label="Navigasi admin">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all font-head text-xs sm:text-sm"
            :class="[
              (item.end ? route.path === item.to : route.path.startsWith(item.to))
                ? 'bg-sun border-ink text-ink font-extrabold shadow-[2px_2px_0_#1B2430] translate-x-0.5'
                : 'border-transparent text-ink/75 font-bold hover:bg-soft/70 hover:text-ink',
              collapsed ? 'justify-center px-0' : '',
            ]"
            :title="collapsed ? item.label : ''"
            @click="mobileOpen = false"
          >
            <component :is="item.icon" :size="18" :stroke-width="2.2" class="shrink-0" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
            <span
              v-if="!collapsed && item.to === '/admin/orders'"
              class="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-ink/40 bg-white/60 font-bold uppercase tracking-wider"
            >
              Kelola
            </span>
          </RouterLink>
        </nav>
      </div>

      <!-- Sidebar Bottom -->
      <div class="p-3 sm:p-4 border-t-2 border-ink/10 bg-[#F6F3EC]/50 space-y-2 shrink-0">
        <!-- Account Card -->
        <RouterLink
          to="/admin/profile"
          class="flex items-center gap-2.5 p-2 rounded-xl border border-transparent hover:border-ink hover:bg-white hover:shadow-[2px_2px_0_#1B2430] transition-all cursor-pointer"
          :class="collapsed ? 'justify-center' : ''"
          title="Buka profil saya"
          @click="mobileOpen = false"
        >
          <span class="w-9 h-9 rounded-full bg-sun border-2 border-ink grid place-items-center font-head font-extrabold text-sm text-ink shrink-0 shadow-[1px_1px_0_#1B2430]">
            {{ user?.name?.slice(0, 1).toUpperCase() || 'M' }}
          </span>
          <div v-if="!collapsed" class="min-w-0">
            <strong class="font-head font-bold text-xs sm:text-sm text-ink block truncate leading-tight">
              {{ user?.name || 'Admin' }}
            </strong>
            <small class="text-[11px] font-semibold text-ink/60 block truncate">
              {{ roleLabel }}
            </small>
          </div>
        </RouterLink>

        <!-- Back to store button -->
        <button
          type="button"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-ink/70 hover:text-ink hover:bg-soft transition-colors cursor-pointer"
          :class="collapsed ? 'justify-center' : ''"
          title="Kembali ke toko utama"
          @click="router.push('/')"
        >
          <ChevronLeft :size="16" :stroke-width="2.4" class="shrink-0" />
          <span v-if="!collapsed" class="truncate">Ke Toko Utama</span>
        </button>

        <!-- Sign out button -->
        <button
          type="button"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          :class="collapsed ? 'justify-center' : ''"
          title="Keluar dari akun admin"
          @click="signOut"
        >
          <LogOut :size="15" :stroke-width="2.4" class="shrink-0" />
          <span v-if="!collapsed" class="truncate">Keluar</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Topbar -->
      <header class="h-16 border-b-2 border-ink bg-white/90 backdrop-blur-xs sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="md:hidden w-9 h-9 rounded-xl border-2 border-ink bg-white hover:bg-soft grid place-items-center text-ink shadow-[2px_2px_0_#1B2430] cursor-pointer"
            aria-label="Buka navigasi menu"
            @click="mobileOpen = true"
          >
            <Menu :size="19" :stroke-width="2.4" />
          </button>
          <div>
            <span class="text-[11px] font-bold text-ink/50 uppercase tracking-wider block">
              Mochibako / Admin
            </span>
            <strong class="font-head font-extrabold text-sm sm:text-base text-ink block leading-tight">
              {{ pageLabel }}
            </strong>
          </div>
        </div>

        <RouterLink
          to="/"
          class="btn bg-white hover:bg-soft text-ink border-2 border-ink px-3 py-1.5 rounded-xl font-head font-bold text-xs sm:text-sm flex items-center gap-2 shadow-[2px_2px_0_#1B2430] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
        >
          <Store :size="15" :stroke-width="2.3" />
          <span class="hidden sm:inline">Lihat Toko</span>
        </RouterLink>
      </header>

      <!-- Page View Slot -->
      <main class="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>

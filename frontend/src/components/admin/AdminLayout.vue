<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
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
  X,
} from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'
import '@/assets/admin.css'

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
]
const pageLabel = computed(() => nav.find((item) => item.to === route.path)?.label || 'Admin')
const roleLabel = computed(() => user.value?.role === 'admin' ? 'Administrator' : user.value?.role === 'staff' ? 'Staff toko' : 'Pengguna')

function toggleCollapse() {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}

async function signOut() { await logout(); router.replace('/login') }
</script>

<template>
  <div class="admin-shell" :class="{ 'is-collapsed': collapsed }">
    <div v-if="mobileOpen" class="admin-scrim" @click="mobileOpen = false"></div>

    <aside class="admin-sidebar" :class="{ 'is-open': mobileOpen }">
      <button
        type="button"
        class="admin-collapse"
        :aria-label="collapsed ? 'Perluas sidebar' : 'Ringkas sidebar'"
        :aria-expanded="!collapsed"
        :title="collapsed ? 'Perluas sidebar' : 'Ringkas sidebar'"
        @click="toggleCollapse"
      >
        <PanelLeftOpen v-if="collapsed" :size="15" />
        <PanelLeftClose v-else :size="15" />
      </button>

      <div class="admin-brand">
        <span class="admin-brand__mark"><Boxes :size="19" :stroke-width="1.9" /></span>
        <span class="admin-brand__copy"><strong>Mochibako</strong><small>Ruang operasional</small></span>
        <button class="admin-mobile-close" aria-label="Tutup menu" @click="mobileOpen = false"><X :size="19" /></button>
      </div>

      <p class="admin-sidebar__caption">Menu toko</p>
      <nav class="admin-nav" aria-label="Navigasi admin">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :data-label="item.label"
          :exact-active-class="item.end ? 'is-active' : ''"
          :active-class="!item.end ? 'is-active' : ''"
          @click="mobileOpen = false"
        >
          <component :is="item.icon" :size="18" :stroke-width="1.9" class="admin-nav__icon" />
          <span class="admin-nav__label">{{ item.label }}</span>
          <span v-if="item.to === '/admin/orders'" class="admin-nav__hint">Kelola</span>
        </RouterLink>
      </nav>

      <div class="admin-sidebar__bottom">
        <div class="admin-account">
          <span class="admin-account__avatar">{{ user?.name?.slice(0, 1).toUpperCase() || 'M' }}</span>
          <span class="admin-account__copy">
            <strong>{{ user?.name || 'Admin' }}</strong>
            <small>{{ roleLabel }}</small>
          </span>
        </div>
        <button class="admin-back-link" title="Kembali ke toko" @click="router.push('/')">
          <ChevronLeft :size="16" /><span>Kembali ke toko</span>
        </button>
        <button class="admin-back-link" title="Keluar" @click="signOut">
          <LogOut :size="15" /><span>Keluar</span>
        </button>
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <button class="admin-menu-button" aria-label="Buka menu" :aria-expanded="mobileOpen" @click="mobileOpen = true"><Menu :size="20" /></button>
        <div><span class="admin-topbar__eyebrow">Mochibako / Admin</span><strong>{{ pageLabel }}</strong></div>
        <RouterLink class="admin-topbar__store" to="/"><Store :size="16" /> Lihat toko</RouterLink>
      </header>
      <main class="admin-content"><RouterView /></main>
    </div>
  </div>
</template>

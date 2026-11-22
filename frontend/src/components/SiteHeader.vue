<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Box, Search, ShoppingBag, User as UserIcon, LogOut, Package, LayoutDashboard, ArrowRight, Loader2 } from 'lucide-vue-next'
import { useCart } from '@/composables/useCart'
import { hasAnyRole, useAuth } from '@/composables/useAuth'
import { catalogApi } from '@/api/catalog'
import { decorateProduct, productImageUrl, visualFor } from '@/lib/productVisual'
import { rupiah } from '@/lib/format'
import type { CatalogProduct } from '@/types/catalog'

const props = withDefaults(
  defineProps<{
    searchModel?: string
    showSearch?: boolean
  }>(),
  {
    searchModel: '',
    showSearch: true,
  },
)

const emit = defineEmits<{
  'update:searchModel': [value: string]
  search: [value: string]
}>()

const router = useRouter()
const { cartCount, toggleCart, cartOpen } = useCart()
const { user, isAuthenticated, logout } = useAuth()

function handleCartClick() {
  if (!isAuthenticated.value) {
    router.push({ name: 'login', query: { redirect: '/keranjang' } })
    return
  }
  toggleCart()
}
const userMenuOpen = ref(false)
const isStaff = computed(() => hasAnyRole(user.value, ['admin', 'staff']))

function goTo(path: string) {
  userMenuOpen.value = false
  router.push(path)
}

async function handleLogout() {
  userMenuOpen.value = false
  await logout()
  router.push('/')
}

// ── Live search dropdown ──────────────────────────────────────────────────────
const searchQuery = ref(props.searchModel || '')
const searchResults = ref<CatalogProduct[]>([])
const searchOpen = ref(false)
const searchLoading = ref(false)
const searchInputEl = ref<HTMLInputElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | undefined

// Sinkronkan saat parent mengubah nilai (mis. dari query URL).
watch(
  () => props.searchModel,
  (val) => {
    if ((val ?? '') !== searchQuery.value) searchQuery.value = val ?? ''
  },
)

async function doSearch(q: string) {
  if (!q.trim()) { searchResults.value = []; searchLoading.value = false; return }
  searchLoading.value = true
  try {
    const data = await catalogApi.products({ q: q.trim(), size: 6, sort: 'newest' })
    searchResults.value = (data.items || []).map(decorateProduct)
  } catch {
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  searchQuery.value = val
  emit('update:searchModel', val)
  clearTimeout(searchTimer)
  if (!val.trim()) { searchResults.value = []; searchOpen.value = false; return }
  searchOpen.value = true
  searchLoading.value = true
  searchTimer = setTimeout(() => doSearch(val), 300)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { closeDropdown(); return }
  if (e.key !== 'Enter') return
  e.preventDefault()
  const q = searchQuery.value
  emit('search', q)
  closeDropdown()
  router.push({ name: 'search', query: q.trim() ? { q: q.trim() } : {} })
}

function goToProduct(product: CatalogProduct) {
  closeDropdown()
  searchQuery.value = ''
  if (product.slug) router.push(`/produk/${product.slug}`)
}

function goToSearch() {
  const q = searchQuery.value.trim()
  closeDropdown()
  router.push({ name: 'search', query: q ? { q } : {} })
}

function closeDropdown() {
  searchOpen.value = false
  searchInputEl.value?.blur()
}

function onFocus() {
  if (searchQuery.value.trim() && searchResults.value.length) searchOpen.value = true
}

function onClickOutside(e: MouseEvent) {
  const wrapper = document.getElementById('search-wrapper')
  if (wrapper && !wrapper.contains(e.target as Node)) searchOpen.value = false
}

function onWindowKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchInputEl.value?.focus()
    searchInputEl.value?.select()
    if (searchQuery.value.trim() && searchResults.value.length) {
      searchOpen.value = true
    }
  }
}

// ── Rotating placeholder ──────────────────────────────────────────────────────
const BASE_PLACEHOLDERS = [
  'Khilaf apa hari ini?',
  'Mau cari apa hari ini?',
  'Ada figure impian kamu di sini…',
]
const FALLBACK_HINTS = [
  'Hoshina Magical Girl 1/7', 'Plushie Nekomaru', 'Blind Box Sakura Series',
  'Figure Attack on Titan', 'Totoro Plushie', 'Naruto Figma',
  'Demon Slayer Nendoroid', 'One Piece Figure', 'Jujutsu Kaisen Keychain',
]
const placeholder = ref('Khilaf apa hari ini?')
const placeholderVisible = ref(true)
let placeholderHints: string[] = []
let hintIdx = 0
let rotateTimer: ReturnType<typeof setTimeout> | undefined
let typeTimer: ReturnType<typeof setTimeout> | undefined

// Rotasi placeholder dibuat kalem: 15 detik sekali dan berhenti saat input dipakai.
const ROTATE_DELAY = 15000
const RESUME_DELAY = 10000

async function loadHints() {
  try {
    const data = await catalogApi.products({ size: 20, sort: 'best_seller' })
    const names = (data.items || []).map((p) => p.name).filter(Boolean)
    const cats = ['figure', 'plushie', 'blind box', 'nendoroid', 'figma', 'dakimakura', 'keychain']
    placeholderHints = [
      ...BASE_PLACEHOLDERS,
      ...names.slice(0, 6).map((n) => `Coba cari "${n}"`),
      ...cats.slice(0, 4).map((c) => `Coba cari "${c}"`),
    ]
  } catch {
    placeholderHints = [
      ...BASE_PLACEHOLDERS,
      ...FALLBACK_HINTS.slice(0, 5).map((n) => `Coba cari "${n}"`),
    ]
  }
  for (let i = placeholderHints.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[placeholderHints[i], placeholderHints[j]] = [placeholderHints[j]!, placeholderHints[i]!]
  }
}

function rotatePlaceholder() {
  placeholderVisible.value = false
  typeTimer = setTimeout(() => {
    hintIdx = (hintIdx + 1) % (placeholderHints.length || 1)
    placeholder.value = placeholderHints[hintIdx] ?? BASE_PLACEHOLDERS[0]!
    placeholderVisible.value = true
  }, 350)
}

function stopRotation() {
  clearTimeout(rotateTimer)
  rotateTimer = undefined
}

function startRotation(delay = ROTATE_DELAY) {
  stopRotation()
  rotateTimer = setTimeout(() => {
    const isIdle = document.activeElement !== searchInputEl.value && !searchQuery.value.trim()
    if (isIdle) rotatePlaceholder()
    // Saat input sedang dipakai, jangan ganti teks; cek lagi setelah cooldown.
    startRotation(isIdle ? ROTATE_DELAY : RESUME_DELAY)
  }, delay)
}

function onSearchFocus() {
  stopRotation()
  onFocus()
}

function onSearchBlur() {
  startRotation(RESUME_DELAY)
}

onMounted(async () => {
  await loadHints()
  placeholder.value = BASE_PLACEHOLDERS[0]!
  hintIdx = Math.max(0, placeholderHints.indexOf(placeholder.value))
  startRotation()
  document.addEventListener('click', onClickOutside)
  window.addEventListener('keydown', onWindowKeydown)
})

onBeforeUnmount(() => {
  stopRotation()
  clearTimeout(typeTimer)
  clearTimeout(searchTimer)
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <header class="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b-[2.5px] border-ink">
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-2.5 sm:py-3 flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2">

      <!-- Logo -->
      <RouterLink to="/" class="flex items-center gap-1.5 sm:gap-2 mr-auto md:mr-0 group">
        <span class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-sun border-2 border-ink grid place-items-center transition-transform group-hover:rotate-6">
          <Box :size="18" :stroke-width="2.4" class="sm:hidden" />
          <Box :size="20" :stroke-width="2.4" class="hidden sm:block" />
        </span>
        <span class="font-head font-bold text-lg sm:text-xl text-ink tracking-tight">Mochibako</span>
      </RouterLink>

      <!-- Search Field + Live Dropdown -->
      <div
        v-if="showSearch !== false"
        id="search-wrapper"
        class="relative order-last w-full md:order-none md:flex-1 md:max-w-md md:ml-4"
      >
        <span class="sr-only">Cari produk</span>

        <!-- Icon search / spinner -->
        <Loader2
          v-if="searchLoading"
          :size="16"
          class="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-ink/40 animate-spin z-10 pointer-events-none"
        />
        <Search
          v-else
          :size="17"
          :stroke-width="2.4"
          class="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-ink/50 z-10 pointer-events-none"
        />

        <input
          ref="searchInputEl"
          :value="searchQuery"
          type="search"
          :placeholder="placeholder"
          autocomplete="off"
          class="search-input w-full h-9 sm:h-10 rounded-full border-2 border-ink bg-white pl-9 sm:pl-10 pr-4 sm:pr-14 text-xs sm:text-sm font-semibold focus:outline-none focus:border-sun transition-colors"
          :class="placeholderVisible ? 'placeholder:opacity-100' : 'placeholder:opacity-0'"
          @input="onInput"
          @keydown="onKeydown"
          @focus="onSearchFocus"
          @blur="onSearchBlur"
        />

        <span
          class="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-ink/25 bg-bg px-1.5 py-0.5 text-[9.5px] font-extrabold text-ink/45 sm:flex"
          aria-hidden="true"
        >
          Ctrl K
        </span>

        <!-- Dropdown hasil live search -->
        <Transition name="drop">
          <div
            v-if="searchOpen && (searchResults.length || searchLoading)"
            class="absolute top-full left-0 right-0 mt-2 bg-bg border-2 border-ink rounded-2xl z-50 overflow-hidden shadow-[4px_4px_0_#1B2430]"
          >
            <!-- Loading shimmer -->
            <div v-if="searchLoading && !searchResults.length" class="px-4 py-5 flex items-center gap-3 text-xs font-semibold text-ink/50">
              <Loader2 :size="16" class="animate-spin text-ink/30 shrink-0" />
              Mencari produk…
            </div>

            <!-- Result list -->
            <ul v-else role="listbox" aria-label="Hasil pencarian">
              <li
                v-for="product in searchResults"
                :key="product.id"
                role="option"
                class="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-soft/70 active:bg-soft transition-colors border-b border-ink/8 last:border-0"
                @mousedown.prevent="goToProduct(product)"
              >
                <!-- Thumbnail -->
                <div
                  class="w-11 h-11 shrink-0 rounded-lg border-2 border-ink overflow-hidden relative"
                  :class="visualFor(product).color"
                >
                  <img
                    v-if="productImageUrl(product)"
                    :src="productImageUrl(product)!"
                    :alt="product.name"
                    class="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    fetchpriority="low"
                    width="44"
                    height="44"
                  />
                  <span
                    v-else
                    class="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-ink/40 uppercase tracking-wide"
                  >
                    {{ (product.cat || product.category?.name || 'Item').slice(0, 3) }}
                  </span>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p class="font-head font-semibold text-sm text-ink leading-tight truncate">
                    {{ product.name }}
                  </p>
                  <p class="text-[11px] font-semibold text-ink/50 truncate mt-0.5">
                    {{ product.anime?.name || product.category?.name || product.series || 'Mochibako' }}
                  </p>
                </div>

                <!-- Price + stock -->
                <div class="shrink-0 text-right">
                  <p class="font-head font-bold text-sm text-ink tabular-nums">{{ rupiah(product.price) }}</p>
                  <p v-if="Number(product.stock) <= 0" class="text-[10px] font-bold text-destructive mt-0.5">Habis</p>
                  <p v-else class="text-[10px] font-semibold text-ink/40 mt-0.5">Stok {{ product.stock }}</p>
                </div>
              </li>
            </ul>

            <!-- Footer: lihat semua -->
            <button
              v-if="searchResults.length"
              type="button"
              class="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-ink/55 hover:bg-soft/70 hover:text-ink transition-colors border-t-2 border-dashed border-soft"
              @mousedown.prevent="goToSearch"
            >
              Lihat semua hasil untuk "{{ searchQuery }}"
              <ArrowRight :size="13" />
            </button>
          </div>
        </Transition>
      </div>

      <!-- Right controls: Auth & Cart -->
      <div class="flex items-center gap-1.5 sm:gap-2 md:ml-auto">

        <!-- User / Auth -->
        <div v-if="isAuthenticated" class="relative">
          <button
            type="button"
            class="btn bg-white h-9 sm:h-10 px-2 sm:px-3 font-head font-semibold flex items-center gap-1.5 text-xs sm:text-sm"
            @click="userMenuOpen = !userMenuOpen"
          >
            <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sun border border-ink grid place-items-center text-[10px] sm:text-xs font-bold uppercase">
              {{ user?.name?.charAt(0) || 'U' }}
            </span>
            <span class="hidden sm:inline max-w-[90px] md:max-w-[120px] truncate">{{ user?.name?.split(' ')[0] }}</span>
          </button>

          <!-- Dropdown user -->
          <div
            v-if="userMenuOpen"
            class="nb absolute right-0 mt-2 w-48 sm:w-52 p-2 z-50 shadow-lg slide-down-enter-active"
          >
            <div class="px-2 py-1.5 border-b border-soft text-xs font-bold text-ink/65 truncate">
              {{ user?.email }}
            </div>
            <button
              type="button"
              class="w-full text-left px-2 py-2 mt-1 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 text-ink hover:bg-soft/60 transition-colors cursor-pointer"
              @click="goTo('/pesanan')"
            >
              <Package :size="15" /> Pesanan saya
            </button>
            <button
              v-if="isStaff"
              type="button"
              class="w-full text-left px-2 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 text-ink hover:bg-soft/60 transition-colors cursor-pointer"
              @click="goTo('/admin')"
            >
              <LayoutDashboard :size="15" /> Panel admin
            </button>
            <button
              type="button"
              class="w-full text-left px-2 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              @click="handleLogout"
            >
              <LogOut :size="15" /> Keluar
            </button>
          </div>
        </div>

        <RouterLink
          v-else
          to="/login"
          class="btn bg-white h-9 sm:h-10 px-2.5 sm:px-3.5 font-head font-semibold flex items-center gap-1 text-xs sm:text-sm text-ink"
        >
          <UserIcon :size="16" :stroke-width="2.4" class="sm:hidden" />
          <UserIcon :size="18" :stroke-width="2.4" class="hidden sm:block" />
          <span>Masuk</span>
        </RouterLink>

        <!-- Cart Button -->
        <button
          id="cartBtn"
          type="button"
          class="btn bg-white h-9 sm:h-10 pl-3 sm:pl-4 pr-1 sm:pr-1.5 font-head font-semibold flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
          :aria-expanded="cartOpen"
          @click="handleCartClick"
        >
          <ShoppingBag :size="17" :stroke-width="2.4" class="sm:hidden" />
          <ShoppingBag :size="19" :stroke-width="2.4" class="hidden sm:block" />
          <span class="hidden sm:inline">Keranjang</span>
          <span
            id="cartCount"
            :key="cartCount"
            class="bg-sun border-2 border-ink rounded-full min-w-6 h-6 sm:min-w-7 sm:h-7 px-1 sm:px-1.5 grid place-items-center text-xs sm:text-sm font-bold pop"
          >
            {{ cartCount }}
          </span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.search-input::placeholder {
  transition: opacity 0.3s ease;
}
</style>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SiteHeader from './SiteHeader.vue'
import SiteFooter from './SiteFooter.vue'
import CartDrawer from './CartDrawer.vue'
import ToastNotice from './ToastNotice.vue'
import { useCart } from '@/composables/useCart'

withDefaults(
  defineProps<{
    /** Sembunyikan kolom pencarian di header (dipakai halaman 404/500). */
    showSearch?: boolean
  }>(),
  { showSearch: true },
)

const route = useRoute()
const router = useRouter()
const { closeCart } = useCart()

const search = ref('')

watch(
  () => route.query.q,
  (value) => {
    search.value = typeof value === 'string' ? value : ''
  },
  { immediate: true },
)

function submitSearch(value: string) {
  closeCart()
  const q = value.trim()
  // Jika sudah di halaman search/home → update query saja, selain itu redirect ke /cari
  if (route.name === 'search' || route.name === 'home') {
    router.push({ name: route.name, query: q ? { q } : {} })
  } else {
    router.push({ name: 'search', query: q ? { q } : {} })
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col">
    <SiteHeader v-model:search-model="search" :show-search="showSearch" @search="submitSearch" />
    <main class="w-full flex-1">
      <slot />
    </main>
    <CartDrawer />
    <ToastNotice />
    <SiteFooter />
  </div>
</template>

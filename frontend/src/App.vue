<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import LoginModal from '@/components/auth/LoginModal.vue'
import OfflineBanner from '@/components/OfflineBanner.vue'
import CookieConsent from '@/components/CookieConsent.vue'

const route = useRoute()

/**
 * Halaman privat (admin, auth, keranjang, checkout, pesanan) memakai
 * meta robots noindex supaya tidak masuk indeks mesin pencari / AI crawler.
 */
const robotsContent = computed(() =>
  route.meta.noindex ? 'noindex, nofollow, noarchive' : 'index, follow',
)

useHead({
  meta: [
    { name: 'robots', content: () => robotsContent.value },
    { name: 'googlebot', content: () => robotsContent.value },
  ],
})
</script>

<template>
  <RouterView />
  <LoginModal />
  <OfflineBanner />
  <CookieConsent />
</template>

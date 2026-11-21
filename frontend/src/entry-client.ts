import { createHead } from '@unhead/vue/client'
import { createMochibakoApp } from './app'
import { initAuth } from './composables/useAuth'
import './style.css'
import './storefront.css'

/**
 * Entry client untuk build SSR (atau SPA biasa).
 * `createSSRApp` + `app.mount` otomatis hydrate bila HTML sudah dirender server.
 */
initAuth()

const { app, router } = createMochibakoApp({ ssr: true })
const head = createHead()

app.use(head)

function syncAdminPwa() {
  const isAdminRoute = router.currentRoute.value.path.startsWith('/admin')
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')

  if (isAdminRoute) {
    if (!manifestLink) {
      const link = document.createElement('link')
      link.rel = 'manifest'
      link.href = '/admin/manifest.webmanifest'
      document.head.append(link)
    }
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' })
        .catch((error) => console.error('[Admin Service Worker]', error))
    }
    return
  }

  manifestLink?.remove()
}

router.isReady().then(() => {
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        const scriptUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL
        if (registration.scope === `${window.location.origin}/` && scriptUrl?.includes('/assets/sw-')) {
          void registration.unregister()
        }
      }
    })
  }
  syncAdminPwa()
  router.afterEach(syncAdminPwa)

  app.mount('#app')
})

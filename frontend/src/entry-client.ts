import { createHead } from '@unhead/vue/client'
import { createMochibakoApp } from './app'
import { initAuth } from './composables/useAuth'
import { hydrateAppStateFromDocument } from './lib/appState'
import { initConnectivity } from './lib/connectivity'
import { initCookieConsent } from './lib/cookieConsent'
import './style.css'
import './storefront.css'

/**
 * Entry client untuk build SSR (atau SPA biasa).
 * `createSSRApp` + `app.mount` otomatis hydrate bila HTML sudah dirender server.
 *
 * State hasil prerender dibaca sebelum aplikasi dibuat agar render pertama
 * sama persis dengan HTML server.
 */
hydrateAppStateFromDocument()
initCookieConsent()
initConnectivity()
initAuth()

const { app, router } = createMochibakoApp({ ssr: true })
const head = createHead()

app.use(head)

let adminServiceWorkerSetup: Promise<void> | null = null

function setupAdminServiceWorker() {
  if (adminServiceWorkerSetup) return adminServiceWorkerSetup

  adminServiceWorkerSetup = (async () => {
    try {
      // SW lama memakai scope /admin/ sehingga halaman /admin tidak terkontrol.
      // Lepas registrasi lama dulu, lalu pasang SW dengan scope /admin.
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations
          .filter((registration) => {
            const scriptUrl =
              registration.active?.scriptURL ||
              registration.waiting?.scriptURL ||
              registration.installing?.scriptURL ||
              ''
            return scriptUrl.endsWith('/admin/sw.js')
          })
          .map((registration) => registration.unregister()),
      )
      await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' })
    } catch (error) {
      adminServiceWorkerSetup = null
      console.error('[Admin Service Worker]', error)
    }
  })()

  return adminServiceWorkerSetup
}

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
      void setupAdminServiceWorker()
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

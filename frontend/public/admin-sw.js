/*
 * Service worker KHUSUS area admin (scope /admin).
 * Storefront tidak memakai service worker ini.
 *
 * Tugasnya: menyimpan shell admin + aset build supaya halaman admin tetap
 * terbuka saat server tidak bisa dihubungi, dan menyimpan daftar produk
 * halaman pertama untuk kebutuhan kasir (POS).
 */
const APP_CACHE = 'mochibako-admin-app-v2'
const PRODUCT_CACHE = 'mochibako-admin-products-v2'
const ADMIN_SHELL = '/admin'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE)
    try {
      // Simpan shell admin saat pertama kali service worker dipasang.
      await cache.add(new Request(ADMIN_SHELL, { cache: 'reload' }))
    } catch {
      // Kalau gagal, shell akan tersimpan pada navigasi admin berikutnya.
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith('mochibako-admin-') && ![APP_CACHE, PRODUCT_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET') return

  // Katalog kasir: network-first, fallback ke salinan terakhir saat API mati.
  if (url.pathname.endsWith('/products') && url.searchParams.get('page') === '1') {
    event.respondWith((async () => {
      const cache = await caches.open(PRODUCT_CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        return (await cache.match(request)) || Response.error()
      }
    })())
    return
  }

  if (url.origin !== self.location.origin) return

  // Navigasi admin: network-first, lalu shell admin yang tersimpan.
  if (
    request.mode === 'navigate' &&
    (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))
  ) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        return (
          (await cache.match(request)) ||
          (await cache.match(ADMIN_SHELL)) ||
          (await caches.match('/')) ||
          Response.error()
        )
      }
    })())
    return
  }

  // Aset build: cache-first supaya bundle admin tetap tersedia offline.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response.clone())
      return response
    })())
  }
})

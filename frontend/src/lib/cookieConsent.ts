import { computed, readonly, ref } from 'vue'
import type { CatalogProduct } from '@/types/catalog'

/**
 * Persetujuan cookie/local storage untuk pengunjung.
 *
 * Cookie `mochibako_consent` hanya menyimpan PILIHAN pengguna (bukan data
 * katalog). Data katalog offline disimpan terpisah di localStorage dan hanya
 * ditulis kalau kategori "Katalog offline" diizinkan.
 */

export const CONSENT_VERSION = 1
export const CONSENT_CHANGED_EVENT = 'mochibako:consent-changed'

const COOKIE_NAME = 'mochibako_consent'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180
const LEGACY_CACHE_KEYS = ['mochibako.catalog.v1']

export interface CookieConsent {
  version: number
  offline: boolean
  decidedAt: number
}

const consent = ref<CookieConsent | null>(null)
const decided = ref(false)
const offlineAllowed = ref(false)
const settingsOpen = ref(false)

let initialized = false

function canUseDocument(): boolean {
  return typeof document !== 'undefined'
}

function readCookie(): string | null {
  if (!canUseDocument()) return null
  const target = `${COOKIE_NAME}=`
  for (const part of document.cookie.split(';')) {
    const value = part.trim()
    if (value.startsWith(target)) return value.slice(target.length)
  }
  return null
}

function parseConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<CookieConsent>
    if (parsed?.version !== CONSENT_VERSION) return null
    return {
      version: CONSENT_VERSION,
      offline: Boolean(parsed.offline),
      decidedAt: Number(parsed.decidedAt) || Date.now(),
    }
  } catch {
    return null
  }
}

function writeCookie(value: CookieConsent) {
  if (!canUseDocument()) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const encoded = encodeURIComponent(JSON.stringify(value))
  document.cookie =
    `${COOKIE_NAME}=${encoded}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}

/** Hapus cache lama yang memakai nama endpoint sebagai key. */
function cleanupLegacyStorage() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('mochibako.api-cache.')) localStorage.removeItem(key)
    }
    for (const key of LEGACY_CACHE_KEYS) localStorage.removeItem(key)
  } catch {
    // Storage diblokir / penuh; abaikan.
  }
}

async function clearOptionalStores() {
  try {
    const [{ clearOfflineCache }, { clearCatalogCache }] = await Promise.all([
      import('@/lib/offlineCache'),
      import('@/lib/catalogCache'),
    ])
    clearOfflineCache()
    clearCatalogCache()
  } catch {
    // Abaikan.
  }
}

/**
 * Setelah pengunjung mengizinkan cache, isi cache untuk halaman utama supaya
 * produk langsung tersedia saat koneksi putus.
 */
async function warmOfflineCache() {
  try {
    const [{ catalogApi }, { rememberProducts }] = await Promise.all([
      import('@/api/catalog'),
      import('@/lib/catalogCache'),
    ])

    const [home, products] = await Promise.allSettled([
      catalogApi.home({ limit: 12 }),
      catalogApi.products({ page: 1, size: 24, sort: 'newest' }),
    ])

    const items: CatalogProduct[] = []
    if (home.status === 'fulfilled') {
      const data = home.value
      items.push(
        ...(data.new_arrivals || []),
        ...(data.best_sellers || []),
        ...(data.handmade || []),
        ...(data.imported || []),
      )
    }
    if (products.status === 'fulfilled') items.push(...(products.value.items || []))

    rememberProducts(items)
  } catch {
    // Diamkan; cache akan terisi pada permintaan berikutnya.
  }
}

export function initCookieConsent() {
  if (!canUseDocument() || initialized) return
  initialized = true

  cleanupLegacyStorage()

  const saved = parseConsent(readCookie())
  consent.value = saved
  decided.value = saved !== null
  offlineAllowed.value = Boolean(saved?.offline)
}

function ensureInitialized() {
  if (!initialized) initCookieConsent()
}

export function offlineStorageAllowed(): boolean {
  ensureInitialized()
  return offlineAllowed.value
}

function persist(allowOffline: boolean) {
  const next: CookieConsent = {
    version: CONSENT_VERSION,
    offline: allowOffline,
    decidedAt: Date.now(),
  }

  consent.value = next
  decided.value = true
  offlineAllowed.value = allowOffline
  settingsOpen.value = false
  writeCookie(next)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: next }))
  }

  if (allowOffline) void warmOfflineCache()
  else void clearOptionalStores()
}

export function useCookieConsent() {
  ensureInitialized()

  return {
    consent: readonly(consent),
    decided: readonly(decided),
    offlineStorage: readonly(offlineAllowed),
    settingsOpen: readonly(settingsOpen),
    hasDecision: computed(() => decided.value),
    acceptAll: () => persist(true),
    rejectOptional: () => persist(false),
    savePreferences: (allowOffline: boolean) => persist(allowOffline),
    openSettings: () => { settingsOpen.value = true },
    closeSettings: () => { settingsOpen.value = false },
  }
}

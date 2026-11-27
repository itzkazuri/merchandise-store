import { offlineStorageAllowed } from '@/lib/cookieConsent'

/**
 * Cache respons GET publik (katalog, kategori, filter, metode pembayaran).
 *
 * Semua entri disimpan dalam SATU key localStorage dengan nama netral, bukan
 * satu key per endpoint, supaya struktur API tidak terekspos di browser.
 * Penulisan hanya terjadi bila pengunjung mengizinkan "Katalog offline".
 *
 * Data privat (akun, pesanan, admin) tidak pernah disimpan di sini.
 */

const STORAGE_KEY = 'mochibako_offline_cache'
const STORE_VERSION = 1
const MAX_ENTRIES = 48
const MAX_ENTRY_BYTES = 512 * 1024
const MAX_TOTAL_BYTES = 3 * 1024 * 1024
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14

interface CacheEntry {
  data: unknown
  savedAt: number
}

interface CacheStore {
  version: number
  entries: Record<string, CacheEntry>
}

export interface CachedEntry<T> {
  data: T
  savedAt: number
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function emptyStore(): CacheStore {
  return { version: STORE_VERSION, entries: {} }
}

function readStore(): CacheStore {
  const store = storage()
  if (!store) return emptyStore()

  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()

    const parsed = JSON.parse(raw) as CacheStore
    if (parsed?.version !== STORE_VERSION || !parsed.entries || typeof parsed.entries !== 'object') {
      return emptyStore()
    }
    return parsed
  } catch {
    return emptyStore()
  }
}

function serializedSize(store: CacheStore): number {
  try {
    return JSON.stringify(store).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function prune(store: CacheStore) {
  const entries = Object.entries(store.entries).sort((a, b) => a[1].savedAt - b[1].savedAt)

  while (entries.length > MAX_ENTRIES) {
    const oldest = entries.shift()
    if (oldest) delete store.entries[oldest[0]]
  }

  while (entries.length > 1 && serializedSize(store) > MAX_TOTAL_BYTES) {
    const oldest = entries.shift()
    if (oldest) delete store.entries[oldest[0]]
  }
}

/**
 * Key internal berupa hash pendek, bukan path API, supaya daftar storage di
 * browser tidak menampilkan endpoint backend.
 */
function cacheKey(path: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}${path.length.toString(36)}`
}

export function readOfflineCache<T>(path: string): CachedEntry<T> | null {
  if (!offlineStorageAllowed()) return null

  const entry = readStore().entries[cacheKey(path)]
  if (!entry || typeof entry.savedAt !== 'number' || !('data' in entry)) return null
  if (Date.now() - entry.savedAt > MAX_AGE_MS) return null

  return { data: entry.data as T, savedAt: entry.savedAt }
}

export function writeOfflineCache<T>(path: string, data: T): void {
  if (!offlineStorageAllowed()) return

  const store = storage()
  if (!store) return

  let payload = ''
  try {
    payload = JSON.stringify(data)
  } catch {
    return
  }
  if (payload.length > MAX_ENTRY_BYTES) return

  try {
    const current = readStore()
    current.entries[cacheKey(path)] = { data, savedAt: Date.now() }
    prune(current)
    store.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Kuota penuh: buang entri lama lalu coba sekali lagi dengan entri baru saja.
    try {
      const fallback = emptyStore()
      fallback.entries[cacheKey(path)] = { data, savedAt: Date.now() }
      store.setItem(STORAGE_KEY, JSON.stringify(fallback))
    } catch {
      // Penyimpanan tidak tersedia; abaikan.
    }
  }
}

export function clearOfflineCache(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

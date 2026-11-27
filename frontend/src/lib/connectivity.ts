import { computed, readonly, ref } from 'vue'

/**
 * Status konektivitas ke backend.
 *
 * `apiOnline` berubah menjadi false saat fetch ke API gagal karena jaringan
 * (bukan karena HTTP 4xx/5xx), lalu dicek ulang otomatis secara berkala.
 */
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
).replace(/\/$/, '')

const PING_TIMEOUT_MS = 6_000
const POLL_INTERVAL_MS = 20_000

function healthUrl(): string {
  try {
    const base = new URL(
      API_BASE_URL,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    )
    return `${base.origin}/health`
  } catch {
    return '/health'
  }
}

export const API_ONLINE_EVENT = 'mochibako:api-online'

const apiOnline = ref(true)
const browserOnline = ref(true)
const checking = ref(false)
const cacheServedAt = ref<number | null>(null)

let initialized = false
let pollTimer: ReturnType<typeof setInterval> | undefined
let inFlightCheck: Promise<boolean> | null = null

function hasWindow() {
  return typeof window !== 'undefined'
}

function startPolling() {
  if (!hasWindow() || pollTimer !== undefined) return
  pollTimer = setInterval(() => {
    if (navigator.onLine === false) return
    void retryConnection()
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer === undefined) return
  clearInterval(pollTimer)
  pollTimer = undefined
}

export function markApiOnline() {
  if (!hasWindow()) return
  const wasOffline = !apiOnline.value || !browserOnline.value
  browserOnline.value = navigator.onLine
  apiOnline.value = true
  cacheServedAt.value = null
  stopPolling()
  if (wasOffline) {
    window.dispatchEvent(new CustomEvent(API_ONLINE_EVENT))
  }
}

export function markApiOffline() {
  if (!hasWindow()) return
  browserOnline.value = navigator.onLine
  apiOnline.value = false
  startPolling()
}

/** Tandai bahwa data yang tampil berasal dari cache lokal. */
export function markCacheServed(savedAt: number) {
  cacheServedAt.value = Math.max(cacheServedAt.value || 0, savedAt)
}

async function pingBackend(): Promise<boolean> {
  if (!hasWindow()) return true
  if (navigator.onLine === false) return false

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const response = await fetch(healthUrl(), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Cek ulang koneksi ke backend sekarang juga. */
export function retryConnection(): Promise<boolean> {
  if (!hasWindow()) return Promise.resolve(true)
  if (inFlightCheck) return inFlightCheck

  checking.value = true
  inFlightCheck = pingBackend()
    .then((ok) => {
      if (ok) markApiOnline()
      else markApiOffline()
      return ok
    })
    .finally(() => {
      checking.value = false
      inFlightCheck = null
    })

  return inFlightCheck
}

/** Dipanggil sekali dari entry client. */
export function initConnectivity() {
  if (!hasWindow() || initialized) return
  initialized = true

  browserOnline.value = navigator.onLine
  if (!navigator.onLine) markApiOffline()

  window.addEventListener('online', () => {
    browserOnline.value = true
    // Event online browser hanya berarti jaringan lokal tersedia; pastikan
    // backend benar-benar bisa dihubungi sebelum menutup banner offline.
    void retryConnection()
  })

  window.addEventListener('offline', () => {
    browserOnline.value = false
    markApiOffline()
  })
}

const offline = computed(() => !apiOnline.value || !browserOnline.value)

export function useConnectivity() {
  return {
    apiOnline: readonly(apiOnline),
    browserOnline: readonly(browserOnline),
    checking: readonly(checking),
    cacheServedAt: readonly(cacheServedAt),
    offline,
    retryConnection,
  }
}

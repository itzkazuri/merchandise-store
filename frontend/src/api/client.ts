import { clearStoredTokens } from './session'
import { ApiError, ApiNetworkError } from './errors'
import { markApiOffline, markApiOnline, markCacheServed } from '@/lib/connectivity'
import { readOfflineCache, writeOfflineCache } from '@/lib/offlineCache'

export { ApiError, ApiNetworkError, isNetworkError } from './errors'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')

const DEFAULT_TIMEOUT_MS = 15_000

let refreshPromise: Promise<boolean> | null = null

/** GET publik yang boleh dilayani dari cache saat server tidak terjangkau. */
function canUseOfflineCache(path: string, method: string, auth: boolean): boolean {
  return method === 'GET' && !auth && !path.startsWith('/auth/')
}

/**
 * fetch dengan timeout. Kegagalan jaringan ditandai ke store konektivitas dan
 * dilempar sebagai ApiNetworkError supaya UI bisa menampilkan mode offline.
 */
async function requestFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    // Server menjawab (termasuk 4xx/5xx) berarti backend bisa dihubungi.
    markApiOnline()
    return response
  } catch (cause) {
    markApiOffline()
    if (controller.signal.aborted) {
      throw new ApiNetworkError('Server terlalu lama merespons. Periksa koneksi lalu coba lagi.')
    }
    if (cause instanceof ApiNetworkError) throw cause
    throw new ApiNetworkError()
  } finally {
    clearTimeout(timer)
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const response = await requestFetch(
        `${API_BASE_URL}/auth/refresh`,
        { method: 'POST', credentials: 'include' },
        DEFAULT_TIMEOUT_MS,
      )
      if (!response.ok) { clearStoredTokens(); return false }
      return true
    } catch { return false }
  })().finally(() => { refreshPromise = null })
  return refreshPromise
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
  retryAuth?: boolean
  /** Override timeout request (ms). */
  timeout?: number
  /** Set false untuk mematikan cache offline pada GET publik. */
  offlineCache?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    auth = true,
    retryAuth = true,
    headers: initialHeaders,
    body,
    timeout = DEFAULT_TIMEOUT_MS,
    offlineCache,
    ...init
  } = options

  const method = (init.method || 'GET').toUpperCase()
  const allowCache = offlineCache ?? canUseOfflineCache(path, method, auth)
  const headers = new Headers(initialHeaders)
  if (body !== undefined && !(body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const requestInit: RequestInit = {
    ...init,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  }

  let response: Response
  try {
    response = await requestFetch(url, requestInit, timeout)
  } catch (cause) {
    // Server tidak terjangkau: tampilkan salinan terakhir bila ada.
    if (allowCache) {
      const cached = readOfflineCache<T>(path)
      if (cached) {
        markCacheServed(cached.savedAt)
        return cached.data
      }
    }
    throw cause
  }

  if (response.status === 401 && auth && retryAuth && await refreshAccessToken()) {
    response = await requestFetch(url, requestInit, timeout)
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const detail = payload?.detail
    throw new ApiError(
      response.status,
      typeof detail === 'string' ? detail : `Request failed (${response.status})`,
      detail,
    )
  }

  if (response.status === 204) return undefined as T

  const data = (await response.json()) as T
  if (allowCache) writeOfflineCache(path, data)
  return data
}

export function queryString(params: Record<string, unknown> = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const value = query.toString()
  return value ? `?${value}` : ''
}

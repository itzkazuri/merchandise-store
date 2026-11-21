import { getStoredTokens, replaceStoredTokens, clearStoredTokens } from './session'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message)
    this.name = 'ApiError'
  }
}

let refreshPromise: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const tokens = getStoredTokens()
    if (!tokens?.refresh_token) return false
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      })
      if (!response.ok) { clearStoredTokens(); return false }
      const next = await response.json()
      replaceStoredTokens(next)
      return true
    } catch { return false }
  })().finally(() => { refreshPromise = null })
  return refreshPromise
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
  retryAuth?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, retryAuth = true, headers: initialHeaders, body, ...init } = options
  const headers = new Headers(initialHeaders)
  if (body !== undefined && !(body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const tokens = getStoredTokens()
  if (auth && tokens?.access_token) headers.set('Authorization', `Bearer ${tokens.access_token}`)
  let response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  })
  if (response.status === 401 && auth && retryAuth && await refreshAccessToken()) {
    const refreshed = getStoredTokens()
    if (refreshed?.access_token) headers.set('Authorization', `Bearer ${refreshed.access_token}`)
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const detail = payload?.detail
    throw new ApiError(response.status, typeof detail === 'string' ? detail : `Request failed (${response.status})`, detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function queryString(params: Record<string, unknown> = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const value = query.toString()
  return value ? `?${value}` : ''
}

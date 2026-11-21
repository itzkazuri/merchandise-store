import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'
import { apiRequest } from '@/api/client'

export interface AuthUser {
  id: number
  email: string
  name: string
  role?: string | string[]
  roles?: (string | { id?: number; name: string })[]
  is_active?: boolean
  avatar?: string
  avatar_url?: string | null
}

export interface TokenData {
  access_token: string
  refresh_token: string
  token_type: string
}

const STORAGE_KEY = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'merch.auth'
export const GOOGLE_LOGIN_URL = authApi.googleLoginUrl
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

const user = ref<AuthUser | null>(null)
const accessToken = ref<string | null>(null)
const refreshToken = ref<string | null>(null)
const loading = ref(false)
const error = ref('')

// Initialize from storage or URL
export function initAuth() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const tokenFromUrl = params.get('access_token')
    const refreshFromUrl = params.get('refresh_token')

    if (tokenFromUrl) {
      accessToken.value = tokenFromUrl
      refreshToken.value = refreshFromUrl || null
      saveTokens(tokenFromUrl, refreshFromUrl || '')

      // Clean URL without reloading
      const url = new URL(window.location.href)
      url.searchParams.delete('access_token')
      url.searchParams.delete('refresh_token')
      window.history.replaceState({}, document.title, url.pathname + url.search)

      fetchProfile()
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        accessToken.value = parsed.access_token || null
        refreshToken.value = parsed.refresh_token || null
        if (parsed.user) {
          user.value = parsed.user
        }
        if (accessToken.value) {
          fetchProfile()
        }
      }
    } catch {
      // ignore
    }
  }
}

function saveTokens(access: string, refresh: string, userData?: AuthUser) {
  try {
    const payload = {
      access_token: access,
      refresh_token: refresh,
      user: userData || user.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function clearTokens() {
  accessToken.value = null
  refreshToken.value = null
  user.value = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

function normalizeUser(value: unknown): AuthUser {
  const data = (value || {}) as Record<string, unknown>
  const rawRoles = Array.isArray(data.roles) ? data.roles : []
  const roles = rawRoles.map((role) => typeof role === 'string' ? role : (role as { name?: string } | null)?.name).filter((role): role is string => Boolean(role))
  const roleValue = data.role
  const role = typeof roleValue === 'string' || Array.isArray(roleValue) ? roleValue as string | string[] : roles[0]
  return { ...data, role, roles, avatar: (data.avatar as string | undefined) || (data.avatar_url as string | null | undefined) || undefined } as AuthUser
}

export function hasAnyRole(profile: AuthUser | null, required: string[]) {
  if (!profile) return false
  const roleValues = Array.isArray(profile.role) ? profile.role : profile.role ? [profile.role] : []
  const roles = (profile.roles || []).map((role) => typeof role === 'string' ? role : role.name)
  const effective = new Set([...roleValues, ...roles])
  if (effective.has('admin')) effective.add('staff').add('customer')
  if (effective.has('staff')) effective.add('customer')
  return required.some((name) => effective.has(name))
}

async function fetchProfile(): Promise<AuthUser | null> {
  if (!accessToken.value) return null
  try {
    const data = normalizeUser(await apiRequest<unknown>('/auth/me'))
    user.value = data
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    accessToken.value = stored.access_token || accessToken.value
    refreshToken.value = stored.refresh_token || refreshToken.value
    saveTokens(accessToken.value || '', refreshToken.value || '', data)
    return data
  } catch { return null }
}

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value || !!accessToken.value)

  async function login(email: string, pass: string): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      const tokens: TokenData = await authApi.login({ email: email.trim(), password: pass })
      accessToken.value = tokens.access_token
      refreshToken.value = tokens.refresh_token
      saveTokens(tokens.access_token, tokens.refresh_token)
      const profile = await fetchProfile()
      if (!profile) {
        clearTokens()
        throw new Error('Login berhasil, tetapi profil akun gagal dimuat. Coba lagi.')
      }
      loading.value = false
      return true
    } catch (err: any) {
      error.value = err.message || 'Gagal masuk akun'
      loading.value = false
      return false
    }
  }

  async function register(name: string, email: string, pass: string): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      await authApi.register({
          name: name.trim(),
          email: email.trim(),
          password: pass,
      })
      return await login(email, pass)
    } catch (err: any) {
      error.value = err.message || 'Gagal mendaftar'
      loading.value = false
      return false
    }
  }

  function quickGoogleLogin(): boolean {
    window.location.assign(GOOGLE_LOGIN_URL)
    return true
  }

  async function logout() {
    if (accessToken.value) {
      try { await authApi.logout() } catch { /* local logout still completes */ }
    }
    clearTokens()
  }

  return {
    user,
    accessToken,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    fetchProfile,
    quickGoogleLogin,
  }
}

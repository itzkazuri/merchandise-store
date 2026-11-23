import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'

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

const STORAGE_KEY = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'merch.auth'
export const GOOGLE_LOGIN_URL = authApi.googleLoginUrl

const user = ref<AuthUser | null>(null)
const accessToken = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
let profileRequest: Promise<AuthUser | null> | null = null

// Initialize from the HttpOnly session cookie.
export function initAuth() {
  if (typeof window !== 'undefined') {
    // Purge tokens written by older localStorage-based releases.
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage unavailable */ }
    accessToken.value = 'cookie'
    fetchProfile()
  }
}

function clearTokens() {
  accessToken.value = null
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
  if (profileRequest) return profileRequest
  profileRequest = (async () => {
    try {
      const session = await authApi.loadSession()
      if (!session) {
        accessToken.value = null
        user.value = null
        return null
      }
      const data = normalizeUser(session)
      user.value = data
      accessToken.value = 'cookie'
      return data
    } catch {
      accessToken.value = null
      user.value = null
      return null
    }
  })().finally(() => { profileRequest = null })
  return profileRequest
}

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value || !!accessToken.value)

  async function login(email: string, pass: string): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      await authApi.login({ email: email.trim(), password: pass })
      accessToken.value = 'cookie'
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

  async function adminLogin(email: string, pass: string): Promise<boolean> {
    loading.value = true
    error.value = ''

    try {
      await authApi.adminLogin({ email: email.trim(), password: pass })
      accessToken.value = 'cookie'
      const profile = await fetchProfile()
      if (!profile) {
        clearTokens()
        throw new Error('Login berhasil, namun profil akun gagal dimuat. Coba lagi.')
      }
      loading.value = false
      return true
    } catch (err: any) {
      error.value = err.message || 'Gagal masuk akun administrator'
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

  function startGoogleLogin(): boolean {
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
    adminLogin,
    register,
    logout,
    fetchProfile,
    startGoogleLogin,
  }
}

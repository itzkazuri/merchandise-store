import { apiRequest } from './client'

export const authApi = {
  register: (body: { name: string; email: string; password: string }) => apiRequest('/auth/register', { method: 'POST', body, auth: false }),
  login: (body: { email: string; password: string }) => apiRequest<{ access_token: string; refresh_token: string; token_type: string }>('/auth/login', { method: 'POST', body, auth: false }),
  me: () => apiRequest('/auth/me'),
  sessionCheck: () => apiRequest('/auth/session-check'),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  refresh: (refresh_token: string) => apiRequest('/auth/refresh', { method: 'POST', body: { refresh_token }, auth: false, retryAuth: false }),
  googleLoginUrl: import.meta.env.VITE_GOOGLE_LOGIN_URL || `${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')}/auth/google/login`,
}

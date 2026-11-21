const storageKey = import.meta.env.VITE_TOKEN_STORAGE_KEY || 'merch.auth'

export interface StoredTokens { access_token: string; refresh_token: string; token_type?: string; user?: unknown }

export function getStoredTokens(): StoredTokens | null {
  try { return JSON.parse(localStorage.getItem(storageKey) || 'null') } catch { return null }
}

export function replaceStoredTokens(tokens: Partial<StoredTokens>) {
  const current = getStoredTokens()
  if (!tokens.access_token || !tokens.refresh_token) { clearStoredTokens(); return }
  try { localStorage.setItem(storageKey, JSON.stringify({ ...current, ...tokens })) } catch { /* storage unavailable */ }
}

export function clearStoredTokens() {
  try { localStorage.removeItem(storageKey) } catch { /* storage unavailable */ }
}

import { ref } from 'vue'

/**
 * State dialog login global.
 *
 * Disimpan di memori (bukan query URL) supaya:
 * - halaman yang sedang dibuka tidak hilang saat user diminta login;
 * - address bar tetap bersih tanpa parameter internal;
 * - tidak ada token/email/password yang bocor ke URL atau history.
 */
const open = ref(false)
const redirectTarget = ref<string | null>(null)

/**
 * Hanya izinkan tujuan internal (path absolut). Ini mencegah open redirect
 * ke domain lain, mis. `//evil.example` atau `https://evil.example`.
 */
export function safeAuthRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const target = value.trim()
  if (!target.startsWith('/') || target.startsWith('//')) return null
  // Jangan pernah kembali ke halaman login itu sendiri.
  if (target === '/login' || target.startsWith('/login?') || target.startsWith('/login#')) return null
  return target
}

export function openAuthDialog(redirect?: unknown): void {
  redirectTarget.value = safeAuthRedirect(redirect)
  open.value = true
}

export function closeAuthDialog(): void {
  open.value = false
}

/**
 * Ambil tujuan setelah login berhasil, lalu bersihkan supaya tidak
 * menempel ke dialog berikutnya.
 */
export function takeAuthRedirect(): string | null {
  const target = redirectTarget.value
  redirectTarget.value = null
  return target
}

export function useAuthDialog() {
  return {
    open,
    redirectTarget,
    openAuthDialog,
    closeAuthDialog,
    takeAuthRedirect,
    safeAuthRedirect,
  }
}

import type { MidtransPayment } from '@/types/order'

interface SnapCallbacks {
  onSuccess?: (result: Record<string, unknown>) => void
  onPending?: (result: Record<string, unknown>) => void
  onError?: (result: Record<string, unknown>) => void
  onClose?: () => void
}

interface SnapInstance {
  pay: (token: string, callbacks?: SnapCallbacks) => void
  hide?: () => void
  reset?: () => void
}

declare global {
  interface Window {
    snap?: SnapInstance
  }
}

const SNAP_SCRIPT_SELECTOR = 'script[data-snap-js]'
const SNAP_FRAME_ID = 'snap-midtrans'
const DEFAULT_SNAP_URL = 'https://app.sandbox.midtrans.com/snap/snap.js'
const SCRIPT_TIMEOUT_MS = 15_000
const POPUP_TIMEOUT_MS = 15_000

let loader: Promise<SnapInstance> | null = null
let loaderUrl = ''
let paying = false

function envValue(name: 'VITE_MIDTRANS_CLIENT_KEY' | 'VITE_MIDTRANS_SNAP_JS_URL'): string {
  const value = import.meta.env[name] as string | undefined
  return (value || '').trim()
}

/**
 * Snap.js wajib memakai client key (`Mid-client-...`).
 * Kalau API mengirim server key (`Mid-server-...`), popup bisa gagal muncul,
 * jadi pakai client key dari env sebagai gantinya.
 */
function resolveClientKey(provided?: string | null): string {
  const candidates = [(provided || '').trim(), envValue('VITE_MIDTRANS_CLIENT_KEY')]
  for (const candidate of candidates) {
    if (candidate.startsWith('Mid-client-')) return candidate
  }
  return ''
}

function resolveSnapUrl(provided?: string | null): string {
  return (provided || '').trim() || envValue('VITE_MIDTRANS_SNAP_JS_URL') || DEFAULT_SNAP_URL
}

function loadedClientKey(): string {
  return document.querySelector(SNAP_SCRIPT_SELECTOR)?.getAttribute('data-client-key') || ''
}

/** Buang instance Snap lama supaya script bisa dimuat ulang dengan key yang benar. */
function discardSnap() {
  try {
    window.snap?.reset?.()
  } catch {
    // State Snap tidak selalu bisa direset; abaikan.
  }
  window.snap = undefined
  document.querySelectorAll(SNAP_SCRIPT_SELECTOR).forEach((node) => node.remove())
}

/** Muat script Snap sekali saja, lalu pakai instance yang sama. */
export function loadSnap(snapUrl?: string, clientKey?: string): Promise<SnapInstance> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Snap hanya tersedia di browser'))
  }

  const url = resolveSnapUrl(snapUrl)
  const key = resolveClientKey(clientKey)

  if (!key) {
    return Promise.reject(
      new Error('Client key Midtrans belum dikonfigurasi. Hubungi admin toko.'),
    )
  }

  if (window.snap) {
    const currentKey = loadedClientKey()
    if (!currentKey || currentKey === key) return Promise.resolve(window.snap)
    discardSnap()
  }

  if (loader && loaderUrl === url) return loader

  loaderUrl = url
  loader = new Promise<SnapInstance>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.dataset.snapJs = 'true'
    script.dataset.clientKey = key

    let timer = 0
    const cleanup = () => {
      if (timer) window.clearTimeout(timer)
      script.onload = null
      script.onerror = null
    }
    const fail = (cause: Error) => {
      cleanup()
      script.remove()
      reject(cause)
    }

    timer = window.setTimeout(
      () => fail(new Error('Script Midtrans terlalu lama dimuat. Cek koneksi lalu coba lagi.')),
      SCRIPT_TIMEOUT_MS,
    )
    script.onload = () => {
      cleanup()
      if (window.snap) resolve(window.snap)
      else fail(new Error('Midtrans Snap tidak tersedia setelah script dimuat.'))
    }
    script.onerror = () => fail(new Error('Script Midtrans gagal dimuat. Cek koneksi lalu coba lagi.'))

    document.head.appendChild(script)
  }).catch((cause: unknown) => {
    loader = null
    loaderUrl = ''
    throw cause
  })

  return loader
}

/** Panggil di awal halaman supaya popup tidak menunggu script saat tombol bayar diklik. */
export function preloadSnap(payment?: Pick<MidtransPayment, 'snap_js_url' | 'client_key'>): void {
  if (typeof window === 'undefined') return
  try {
    void loadSnap(payment?.snap_js_url, payment?.client_key).catch(() => {
      // Diamkan; error sebenarnya ditampilkan saat user menekan tombol bayar.
    })
  } catch {
    // jangan sampai preload mengganggu render halaman
  }
}

function popupVisible(): boolean {
  const frame = document.getElementById(SNAP_FRAME_ID)
  if (!frame || frame.style.display !== 'block') return false
  const rect = frame.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function waitForPopup(timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const startedAt = Date.now()
    const tick = () => {
      if (popupVisible()) return resolve(true)
      if (Date.now() - startedAt >= timeoutMs) return resolve(false)
      window.setTimeout(tick, 200)
    }
    tick()
  })
}

export function isSnapStateError(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause ?? '')
  return /not allowed to be called|invalid state transition/i.test(message)
}

/**
 * Buka popup pembayaran Snap.
 *
 * Snap menyimpan state internal (`PopupInView`). Kalau popup sebelumnya tidak
 * pernah tertutup (mis. iframe Midtrans gagal dimuat), panggilan `pay` berikutnya
 * ditolak dan popup tidak muncul lagi. Di sini state macet di-reset, lalu kalau
 * iframe tetap tidak tampil, user diarahkan ke halaman pembayaran Midtrans biasa.
 */
export async function payWithSnap(
  payment: MidtransPayment,
  callbacks: SnapCallbacks,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Pembayaran hanya bisa dilakukan di browser')
  }
  if (paying) {
    throw new Error('Jendela pembayaran sedang dibuka. Selesaikan pembayaran sebelumnya.')
  }

  paying = true
  try {
    let snap = await loadSnap(payment.snap_js_url, payment.client_key)

    // Tutup popup lama yang masih terbuka agar Snap menerima pay() baru.
    if (popupVisible()) {
      try {
        snap.hide?.()
      } catch {
        // abaikan
      }
    }

    try {
      snap.pay(payment.token, callbacks)
    } catch (cause) {
      if (!isSnapStateError(cause)) throw cause

      // Snap macet di state PopupInView: reset state lalu coba sekali lagi.
      try {
        snap.hide?.()
      } catch {
        // abaikan
      }
      try {
        snap.pay(payment.token, callbacks)
      } catch (retryCause) {
        if (!isSnapStateError(retryCause)) throw retryCause
        discardSnap()
        snap = await loadSnap(payment.snap_js_url, payment.client_key)
        snap.pay(payment.token, callbacks)
      }
    }

    if (await waitForPopup(POPUP_TIMEOUT_MS)) return

    // Iframe Midtrans tidak pernah tampil. Reset state dulu supaya tombol bayar
    // tetap bisa dipakai, lalu fallback ke halaman pembayaran Midtrans.
    try {
      window.snap?.hide?.()
    } catch {
      // abaikan
    }

    if (payment.redirect_url) {
      window.location.assign(payment.redirect_url)
      return
    }

    throw new Error('Jendela pembayaran Midtrans tidak muncul. Coba lagi atau muat ulang halaman.')
  } finally {
    paying = false
  }
}

import type { MidtransPayment } from '@/types/order'

interface SnapCallbacks {
  onSuccess?: (result: Record<string, unknown>) => void
  onPending?: (result: Record<string, unknown>) => void
  onError?: (result: Record<string, unknown>) => void
  onClose?: () => void
}

interface SnapInstance {
  pay: (token: string, callbacks?: SnapCallbacks) => void
}

declare global {
  interface Window {
    snap?: SnapInstance
  }
}

let loader: Promise<SnapInstance> | null = null

/** Muat script Snap sekali saja, lalu pakai instance yang sama. */
export function loadSnap(snapUrl?: string, clientKey?: string): Promise<SnapInstance> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Snap hanya tersedia di browser'))
  if (window.snap) return Promise.resolve(window.snap)
  if (loader) return loader

  const url = snapUrl || (import.meta.env.VITE_MIDTRANS_SNAP_JS_URL as string) || 'https://app.sandbox.midtrans.com/snap/snap.js'
  const key = clientKey || (import.meta.env.VITE_MIDTRANS_CLIENT_KEY as string) || ''

  loader = new Promise<SnapInstance>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-snap-js]')
    if (existing) {
      existing.addEventListener('load', () => (window.snap ? resolve(window.snap) : reject(new Error('Snap gagal dimuat'))))
      existing.addEventListener('error', () => reject(new Error('Snap gagal dimuat')))
      return
    }

    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.dataset.snapJs = 'true'
    if (key) script.dataset.clientKey = key
    script.onload = () => (window.snap ? resolve(window.snap) : reject(new Error('Snap tidak tersedia')))
    script.onerror = () => reject(new Error('Script Snap gagal dimuat'))
    document.head.appendChild(script)
  }).catch((cause) => {
    loader = null
    throw cause
  })

  return loader
}

export async function payWithSnap(payment: MidtransPayment, callbacks: SnapCallbacks) {
  const snap = await loadSnap(payment.snap_js_url, payment.client_key)
  snap.pay(payment.token, callbacks)
}

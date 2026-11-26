import { apiRequest, queryString } from './client'
import type { CartResponse, CheckoutBody, MidtransPayment, Order, PaymentSyncResult } from '@/types/order'

export const cartApi = {
  get: () => apiRequest<CartResponse>('/cart'),
  add: (product_id: number, quantity = 1) =>
    apiRequest<CartResponse>('/cart/items', { method: 'POST', body: { product_id, quantity } }),
  update: (itemId: number, quantity: number) =>
    apiRequest<CartResponse>(`/cart/items/${itemId}`, { method: 'PATCH', body: { quantity } }),
  remove: (itemId: number) => apiRequest<void>(`/cart/items/${itemId}`, { method: 'DELETE' }),
  clear: () => apiRequest<void>('/cart', { method: 'DELETE' }),
}

export const ordersApi = {
  checkout: (body: CheckoutBody) => apiRequest<Order>('/orders/checkout', { method: 'POST', body }),
  list: (params: Record<string, unknown> = {}) => apiRequest<{ items: Order[]; total: number; page: number; size: number; pages: number }>(`/orders${queryString(params)}`),
  get: (id: number | string) => apiRequest<Order>(`/orders/${id}`),
  cancel: (id: number | string) => apiRequest<Order>(`/orders/${id}/cancel`, { method: 'POST' }),
}

export const paymentsApi = {
  methods: () => apiRequest<{ code: string; name: string; online: boolean; description?: string }[]>('/payments/methods', { auth: false }),
  createMidtrans: (orderId: number | string) =>
    apiRequest<MidtransPayment>(`/payments/midtrans/${orderId}`, { method: 'POST' }),
  syncMidtrans: (orderId: number | string) =>
    apiRequest<PaymentSyncResult>(`/payments/midtrans/${orderId}/sync`, { method: 'POST' }),
}


/**
 * Keranjang di storefront disimpan lokal (localStorage). Backend menghitung
 * checkout dari keranjang milik user, jadi isi keranjang lokal disalin dulu
 * saat checkout agar harga & stok yang dipakai adalah data server.
 */
export async function syncCartToServer(lines: { product_id: number; quantity: number }[]) {
  await cartApi.clear()
  for (const line of lines) {
    await cartApi.add(line.product_id, line.quantity)
  }
}

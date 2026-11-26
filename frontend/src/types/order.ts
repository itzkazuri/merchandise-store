export interface OrderItem {
  id: number
  product_id?: number | null
  product_name: string
  product_slug?: string
  sku?: string
  price: string | number
  quantity: number
  subtotal: string | number
}

export type OrderStatus = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'completed' | 'cancelled'
export type DeliveryMethod = 'store' | 'courier' | 'custom'
export type PaymentMethod = 'midtrans' | 'cash'

export interface Order {
  id: number
  order_number: string
  status: OrderStatus
  delivery_method: DeliveryMethod
  delivery_note?: string | null
  tracking_number?: string | null
  recipient_name: string
  recipient_phone: string
  shipping_address?: string | null
  payment_method: PaymentMethod
  paid_at?: string | null
  midtrans_transaction_id?: string | null
  subtotal: string | number
  shipping_cost: string | number
  total: string | number
  items: OrderItem[]
  user_email?: string | null
  created_at: string
  updated_at?: string
}

export interface CartItem {
  id: number
  product_id: number
  name: string
  slug: string
  sku: string
  price: string | number
  quantity: number
  stock: number
  image_key?: string | null
  is_available: boolean
  subtotal: string | number
}

export interface CartResponse {
  items: CartItem[]
  item_count: number
  subtotal: string | number
}

export interface MidtransPayment {
  order_number: string
  token: string
  redirect_url?: string | null
  client_key: string
  snap_js_url: string
}

export interface PaymentSyncResult {
  order_number: string
  status: OrderStatus
  payment_method: PaymentMethod
  is_settled: boolean
  transaction_status?: string | null
  fraud_status?: string | null
  transaction_id?: string | null
  payment_type?: string | null
  gross_amount?: number | null
  message: string
  order?: Order | null
}


export interface CheckoutBody {
  delivery_method: DeliveryMethod
  payment_method: PaymentMethod
  recipient_name: string
  recipient_phone: string
  shipping_address?: string | null
  delivery_note?: string | null
  shipping_cost?: number
}

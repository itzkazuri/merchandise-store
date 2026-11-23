<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Calculator, Check, Maximize2, Minimize2, Plus, Printer, ReceiptText, Search, Store, Trash2 } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminState from '@/components/ui/AdminState.vue'
import PosCalculator from '@/components/admin/PosCalculator.vue'
import { catalogApi } from '@/api/catalog'
import { adminApi } from '@/api/admin'
import type { CatalogProduct } from '@/types/catalog'
import { ApiError } from '@/api/client'
import { useAuth } from '@/composables/useAuth'
import { productImageUrl } from '@/lib/productVisual'

interface PosLine { product_id: number; quantity: number }
interface PosOrderItem { product_name: string; sku?: string; price: string | number; quantity: number; subtotal: string | number }
interface PosOrderResult {
  id: number
  order_number: string
  total: string | number
  subtotal?: string | number
  paid_at?: string | null
  created_at?: string
  recipient_name?: string
  items?: PosOrderItem[]
}
interface Receipt { order: PosOrderResult; cash: number; change: number; cashier: string }

/* ---------- Kelas Tailwind yang dipakai berulang ---------- */
const inputCls =
  'w-full min-w-0 h-10 rounded-xl border-2 border-ink bg-white px-3 font-body text-sm text-ink ' +
  'placeholder:text-muted-foreground focus:bg-[#fffaf0]'
const textareaCls =
  'w-full min-w-0 resize-y rounded-xl border-2 border-ink bg-white px-3 py-2 font-body text-sm text-ink ' +
  'placeholder:text-muted-foreground focus:bg-[#fffaf0]'
const pickerBoxCls =
  'flex h-12 w-full min-w-0 items-center gap-2 rounded-xl border-2 border-ink bg-white px-2.5 text-ink'
const ghostBtnCls =
  'inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border-2 border-ink bg-white px-2.5 ' +
  'font-body text-[11px] font-extrabold text-ink transition-colors hover:bg-soft aria-pressed:bg-sky'
const chipBtnCls =
  'h-8 cursor-pointer rounded-full border-2 border-ink bg-white px-3 font-body text-xs font-extrabold text-ink ' +
  'shadow-[2px_2px_0_#1B2430] transition-[transform,box-shadow,background-color] duration-100 hover:bg-banner-sun ' +
  'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
const focusBtnCls =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-2 border-bg bg-ink px-3 font-body text-xs ' +
  'font-extrabold text-bg shadow-[2px_2px_0_#F4B942] transition-[transform,box-shadow,background-color] duration-100 ' +
  'hover:bg-[#2b3540] aria-pressed:bg-sun aria-pressed:text-ink active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'

const AUTOPRINT_KEY = 'mochibako.pos.autoprint'
const { user } = useAuth()
const products = ref<CatalogProduct[]>([])
const productQueries = ref<Record<number, string>>({})
const activeProductSearch = ref<number | null>(null)
const productResults = ref<CatalogProduct[]>([])
const productSearchOpen = ref(false)
const productSearchBusy = ref(false)
let productSearchTimer: ReturnType<typeof setTimeout> | undefined
let productSearchRequest = 0
const items = ref<PosLine[]>([{ product_id: 0, quantity: 1 }])
const customerName = ref('')
const customerPhone = ref('')
const deliveryNote = ref('')
const cashReceived = ref('')
const busy = ref(false)
const error = ref('')
const lastReceipt = ref<Receipt | null>(null)
const receiptVisible = ref(false)
const receiptEl = ref<HTMLElement | null>(null)
const autoPrint = ref(localStorage.getItem(AUTOPRINT_KEY) === '1')

/* ---------- Mode fokus fullscreen ---------- */
const posRoot = ref<HTMLElement | null>(null)
const focusMode = ref(false)
const calculatorOpen = ref(false)
let savedOverflow = ''

async function enterFocus() {
  focusMode.value = true
  calculatorOpen.value = true
  savedOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  try {
    if (posRoot.value && !document.fullscreenElement) await posRoot.value.requestFullscreen()
  } catch {
    // Fallback: overlay fixed memenuhi layar lewat kelas mode fokus
  }
}

async function exitFocus() {
  focusMode.value = false
  document.body.style.overflow = savedOverflow
  if (document.fullscreenElement) {
    try { await document.exitFullscreen() } catch { /* abaikan */ }
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement && focusMode.value) {
    focusMode.value = false
    document.body.style.overflow = savedOverflow
  }
}

/* ---------- Data ---------- */
async function loadProducts() {
  try {
    const data = await catalogApi.products({ page: 1, size: 100 }) as { items?: CatalogProduct[] }
    products.value = data.items || []
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Produk gagal dimuat.'
  }
}

function findProduct(id: number) {
  return products.value.find((item) => item.id === id)
}

function searchProducts(index: number) {
  if (productSearchTimer) clearTimeout(productSearchTimer)
  const request = ++productSearchRequest
  activeProductSearch.value = index
  const query = (productQueries.value[index] || '').trim()
  if (!query) {
    productResults.value = []
    productSearchBusy.value = false
    return
  }
  productSearchBusy.value = true
  productSearchTimer = setTimeout(async () => {
    try {
      const data = await catalogApi.products({ q: query, page: 1, size: 12 })
      if (request === productSearchRequest) productResults.value = data.items
    } catch (cause) {
      if (request === productSearchRequest) error.value = cause instanceof ApiError ? cause.message : 'Pencarian produk gagal.'
    } finally {
      if (request === productSearchRequest) productSearchBusy.value = false
    }
  }, 250)
}

function chooseProduct(line: PosLine, index: number, product: CatalogProduct) {
  line.product_id = product.id
  if (!products.value.some((item) => item.id === product.id)) products.value.push(product)
  productQueries.value[index] = ''
  productResults.value = []
  activeProductSearch.value = null
}

function changeProduct(line: PosLine, index: number) {
  line.product_id = 0
  activeProductSearch.value = index
  productSearchOpen.value = true
  productQueries.value[index] = ''
}

function addLine() { items.value.push({ product_id: 0, quantity: 1 }) }
function removeLine(index: number) {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
    productQueries.value = {}
    return
  }
  // Baris terakhir tidak dihapus, cukup dikosongkan.
  items.value[index] = { product_id: 0, quantity: 1 }
  productQueries.value[index] = ''
}
function maxQuantity(productId: number) {
  const product = findProduct(productId)
  return product ? Math.max(1, product.stock) : undefined
}
function lineSubtotal(line: PosLine) {
  const product = findProduct(line.product_id)
  return product ? Number(product.price) * Math.max(1, Number(line.quantity) || 0) : null
}

const lineDetails = computed(() => items.value.flatMap((line) => {
  const product = findProduct(line.product_id)
  if (!product) return []
  const quantity = Math.max(1, Number(line.quantity) || 0)
  return [{ product_id: product.id, name: product.name, quantity, subtotal: Number(product.price) * quantity }]
}))
const totalQty = computed(() => lineDetails.value.reduce((sum, line) => sum + line.quantity, 0))
const total = computed(() => lineDetails.value.reduce((sum, line) => sum + line.subtotal, 0))
const cashValue = computed(() => Number(cashReceived.value) || 0)
const change = computed(() => (cashReceived.value.trim() === '' ? total.value : cashValue.value) - total.value)
const quickCash = computed(() => {
  const base = total.value
  if (!base) return []
  const roundUp = (step: number) => Math.ceil(base / step) * step
  return [...new Set([base, roundUp(10000), roundUp(50000), roundUp(100000)])]
    .filter((value) => value >= base)
    .sort((a, b) => a - b)
    .slice(0, 4)
})
const canSubmit = computed(() => !busy.value && products.value.length > 0 && lineDetails.value.length > 0 && !(cashReceived.value !== '' && cashValue.value < total.value))

function applyCalculator(value: number) { cashReceived.value = String(Math.max(0, Math.round(value))) }

watch(autoPrint, (value) => localStorage.setItem(AUTOPRINT_KEY, value ? '1' : '0'))

/* ---------- Simpan transaksi ---------- */
async function submit() {
  error.value = ''
  if (items.value.some((line) => !line.product_id || line.quantity < 1)) { error.value = 'Pilih produk dan jumlah untuk setiap baris.'; return }
  if (cashReceived.value !== '' && cashValue.value < total.value) { error.value = 'Uang tunai kurang dari total transaksi.'; return }
  busy.value = true
  try {
    const result = await adminApi.posOrder({
      items: items.value,
      customer_name: customerName.value || 'Pembeli Event',
      customer_phone: customerPhone.value || undefined,
      delivery_method: 'custom',
      delivery_note: deliveryNote.value || 'Transaksi kasir acara',
    }) as PosOrderResult

    const orderTotal = Number(result.total ?? total.value)
    const paid = cashReceived.value === '' ? orderTotal : cashValue.value
    lastReceipt.value = { order: result, cash: paid, change: Math.max(0, paid - orderTotal), cashier: user.value?.name || 'Kasir' }
    receiptVisible.value = true
    items.value = [{ product_id: 0, quantity: 1 }]
    productQueries.value = {}
    activeProductSearch.value = null
    customerName.value = ''
    customerPhone.value = ''
    deliveryNote.value = ''
    cashReceived.value = ''
    await loadProducts()
    if (autoPrint.value && lastReceipt.value) printReceipt(lastReceipt.value)
    await nextTick()
    receiptEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Transaksi tidak berhasil disimpan.'
  } finally { busy.value = false }
}

function startNew() {
  receiptVisible.value = false
  error.value = ''
}

/* ---------- Struk ---------- */
function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat(import.meta.env.VITE_LOCALE || 'id-ID', {
    style: 'currency',
    currency: import.meta.env.VITE_CURRENCY || 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function receiptDate(value?: string | null) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleString(import.meta.env.VITE_LOCALE || 'id-ID', {
    timeZone: import.meta.env.VITE_TIMEZONE || 'Asia/Jakarta',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

function receiptHtml(receipt: Receipt) {
  const order = receipt.order
  const items = order.items || []
  const itemRows = items.map((item) => `
    <div class="item">
      <div class="name">${escapeHtml(item.product_name)}</div>
      <div class="detail"><span>${Number(item.quantity)} &times; ${money(item.price)}</span><span>${money(item.subtotal)}</span></div>
    </div>`).join('')
  const subtotal = order.subtotal ?? order.total
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Struk ${escapeHtml(order.order_number)}</title>
<style id="receipt-page">@page { size: 80mm 150mm; margin: 4mm; }</style>
<style>
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0; color: #000; font-family: "Courier New", ui-monospace, monospace; font-size: 11px; line-height: 1.45; }
  h1 { margin: 0; font-size: 15px; letter-spacing: 2px; text-align: center; }
  .sub { margin: 2px 0 9px; font-size: 10px; text-align: center; }
  .sep { margin: 7px 0; border-top: 1px dashed #000; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .row span:last-child { text-align: right; word-break: break-word; }
  .item { margin: 5px 0; }
  .item .name { font-weight: 700; }
  .item .detail { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; }
  .grand { display: flex; justify-content: space-between; margin-top: 4px; font-size: 13px; font-weight: 700; }
  .thanks { margin: 10px 0 0; text-align: center; font-weight: 700; }
  .fine { margin: 4px 0 0; font-size: 9px; text-align: center; }
</style></head>
<body>
  <h1>MOCHIBAKO</h1>
  <p class="sub">Merchandise &amp; Mainan Anime</p>
  <div class="sep"></div>
  <div class="meta">
    <div class="row"><span>No.</span><span>${escapeHtml(order.order_number)}</span></div>
    <div class="row"><span>Tanggal</span><span>${escapeHtml(receiptDate(order.paid_at || order.created_at))}</span></div>
    <div class="row"><span>Kasir</span><span>${escapeHtml(receipt.cashier)}</span></div>
    <div class="row"><span>Pembeli</span><span>${escapeHtml(order.recipient_name || 'Walk-in Customer')}</span></div>
    <div class="row"><span>Bayar</span><span>TUNAI</span></div>
  </div>
  <div class="sep"></div>
  ${itemRows || '<div class="item"><div class="name">Tidak ada item</div></div>'}
  <div class="sep"></div>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="grand"><span>TOTAL</span><span>${money(order.total)}</span></div>
    <div class="row"><span>Tunai</span><span>${money(receipt.cash)}</span></div>
    <div class="row"><span>Kembali</span><span>${money(receipt.change)}</span></div>
  </div>
  <div class="sep"></div>
  <p class="thanks">Terima kasih sudah berbelanja!</p>
  <p class="fine">Barang yang sudah dibeli tidak dapat ditukar.<br>Simpan struk ini sebagai bukti pembayaran.</p>
</body></html>`
}

function printReceipt(receipt: Receipt) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:340px;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const win = frame.contentWindow
  if (!win) { frame.remove(); return }
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    setTimeout(() => frame.remove(), 150)
  }
  win.addEventListener('afterprint', cleanup, { once: true })
  win.document.open()
  win.document.write(receiptHtml(receipt))
  win.document.close()

  // Chrome tidak mendukung `@page { size: 80mm auto }`, jadi tinggi halaman
  // dihitung dari isi struk supaya kertas tidak terbuang/terpotong.
  const fitPaper = () => {
    try {
      const doc = win.document
      const bodyHeight = doc.body.getBoundingClientRect().height
      if (!bodyHeight) return
      const contentMm = (bodyHeight * 25.4) / 96
      // 4mm margin atas + 4mm bawah + 2mm toleransi pembulatan
      const pageMm = Math.max(60, Math.ceil(contentMm) + 10)
      const pageStyle = doc.getElementById('receipt-page')
      if (pageStyle) pageStyle.textContent = `@page { size: 80mm ${pageMm}mm; margin: 4mm; }`
    } catch {
      // Gagal mengukur: pakai ukuran default dari receiptHtml.
    }
  }

  const startPrint = () => {
    fitPaper()
    setTimeout(() => {
      try { win.focus(); win.print() } catch { /* dialog print tidak tersedia */ }
      setTimeout(cleanup, 60000)
    }, 120)
  }

  const fonts = win.document.fonts
  if (fonts && typeof fonts.ready?.then === 'function') {
    fonts.ready.then(() => setTimeout(startPrint, 60)).catch(() => setTimeout(startPrint, 60))
  } else {
    setTimeout(startPrint, 250)
  }
}

function printLastReceipt() { if (lastReceipt.value) printReceipt(lastReceipt.value) }

onMounted(() => {
  void loadProducts()
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  if (productSearchTimer) clearTimeout(productSearchTimer)
  productSearchRequest++
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.body.style.overflow = savedOverflow
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
})
</script>

<template>
  <div ref="posRoot" :class="focusMode ? 'fixed inset-0 z-90 overflow-y-auto bg-bg' : ''">
    <AdminPageHeader v-if="!focusMode" title="Kasir acara" description="Catat penjualan langsung. Transaksi POS dibayar tunai dan langsung lunas.">
      <AdminButton variant="primary" @click="enterFocus"><Maximize2 :size="15" /> Mode fokus</AdminButton>
    </AdminPageHeader>

    <!-- Bar mode fokus -->
    <header v-else class="sticky top-0 z-15 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-[2.5px] border-ink bg-ink px-3.5 py-2.5 text-bg sm:px-6">
      <div class="flex min-w-0 items-center gap-2.5">
        <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-sun text-ink"><Store :size="18" /></span>
        <div class="leading-tight">
          <strong class="block font-head text-[15px] font-semibold">Kasir acara</strong>
          <small class="block text-[11px] text-sky">Mode fokus · {{ totalQty }} item</small>
        </div>
      </div>

      <div class="ml-auto flex flex-col items-end leading-tight max-sm:w-full max-sm:flex-row max-sm:items-baseline max-sm:gap-2 max-sm:border-t max-sm:border-white/15 max-sm:pt-2">
        <small class="text-[11px] font-bold text-sky">Total</small>
        <strong class="font-head text-xl font-semibold tabular-nums text-sun max-sm:text-lg">{{ money(total) }}</strong>
      </div>

      <div class="flex gap-2 max-sm:ml-auto">
        <button type="button" :class="focusBtnCls" :aria-pressed="calculatorOpen" @click="calculatorOpen = !calculatorOpen"><Calculator :size="16" /> Kalkulator</button>
        <button type="button" :class="[focusBtnCls, 'border-pinky! bg-pinky! text-ink! shadow-[2px_2px_0_#F6F3EC]! hover:bg-[#ffc9db]!']" @click="exitFocus"><Minimize2 :size="16" /> Keluar</button>
      </div>
    </header>

    <form
      id="pos-form"
      class="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]"
      :class="focusMode ? 'mx-auto max-w-[1400px] px-3.5 pt-4 pb-10 sm:px-6' : ''"
      @submit.prevent="submit"
    >
      <!-- Item transaksi -->
      <section class="admin-panel overflow-hidden">
        <div class="admin-panel__header">
          <div>
            <h2 class="font-head text-base font-bold">Item transaksi</h2>
            <p class="mt-0.5 text-xs text-muted-foreground">Stok diperbarui otomatis setelah transaksi tersimpan.</p>
          </div>
          <AdminButton type="button" variant="secondary" @click="addLine"><Plus :size="15" /> Baris</AdminButton>
        </div>

        <div class="grid gap-3 px-[18px] pt-4 pb-1">
          <div
            v-for="(line, index) in items"
            :key="index"
            class="grid grid-cols-[minmax(0,1fr)_76px_36px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_96px_40px] sm:gap-2.5"
          >
            <div class="admin-field relative">
              <span class="admin-field__label">Produk</span>

              <button
                v-if="findProduct(line.product_id)"
                type="button"
                :class="[pickerBoxCls, 'cursor-pointer text-left hover:bg-muted']"
                @click="changeProduct(line, index)"
              >
                <img
                  v-if="productImageUrl(findProduct(line.product_id)!, 96)"
                  :src="productImageUrl(findProduct(line.product_id)!, 96)!"
                  :alt="findProduct(line.product_id)?.name"
                  class="size-9 shrink-0 rounded-lg border-2 border-ink bg-muted object-cover"
                />
                <span class="grid min-w-0 gap-0.5">
                  <strong class="truncate text-xs">{{ findProduct(line.product_id)?.name }}</strong>
                  <small class="text-[11px] font-medium text-muted-foreground">{{ money(findProduct(line.product_id)?.price) }} · stok {{ findProduct(line.product_id)?.stock }}</small>
                </span>
                <Search :size="15" class="ml-auto shrink-0 text-muted-foreground" />
              </button>

              <div v-else :class="[pickerBoxCls, 'focus-within:bg-[#fffaf0]']">
                <Search :size="15" class="shrink-0 text-muted-foreground" />
                <input
                  v-model="productQueries[index]"
                  type="search"
                  placeholder="Cari nama atau SKU produk…"
                  autocomplete="off"
                  :required="!line.product_id"
                  class="h-9 w-full border-0 bg-transparent p-0 font-body text-sm outline-none focus-visible:outline-none"
                  @focus="activeProductSearch = index; productSearchOpen = true"
                  @input="searchProducts(index)"
                />
              </div>

              <div
                v-if="productSearchOpen && activeProductSearch === index && !line.product_id && productQueries[index]?.trim()"
                class="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-auto rounded-xl border-2 border-ink bg-white shadow-[4px_4px_0_#1B2430]"
              >
                <p v-if="productSearchBusy" class="m-0 p-3.5 text-xs text-muted-foreground">Mencari produk…</p>
                <p v-else-if="!productResults.length" class="m-0 p-3.5 text-xs text-muted-foreground">Produk tidak ditemukan.</p>
                <template v-else>
                  <button
                    v-for="product in productResults"
                    :key="product.id"
                    type="button"
                    class="flex w-full cursor-pointer items-center gap-2.5 border-0 border-b-2 border-soft bg-white px-2.5 py-2 text-left text-ink last:border-b-0 enabled:hover:bg-banner-sun disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="product.stock < 1"
                    @click="chooseProduct(line, index, product)"
                  >
                    <img
                      v-if="productImageUrl(product, 96)"
                      :src="productImageUrl(product, 96)!"
                      :alt="product.name"
                      loading="lazy"
                      class="size-9 shrink-0 rounded-lg border-2 border-ink bg-muted object-cover"
                    />
                    <span v-else class="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-muted text-muted-foreground"><Store :size="16" /></span>
                    <span class="grid min-w-0 gap-0.5">
                      <strong class="truncate text-xs">{{ product.name }}</strong>
                      <small class="text-[11px] font-medium text-muted-foreground">{{ product.sku || 'Tanpa SKU' }} · {{ product.stock ? `Stok ${product.stock}` : 'Stok habis' }}</small>
                    </span>
                    <strong class="ml-auto whitespace-nowrap text-xs">{{ money(product.price) }}</strong>
                  </button>
                </template>
              </div>
            </div>

            <label class="admin-field">
              <span class="admin-field__label">Jumlah</span>
              <input v-model.number="line.quantity" type="number" min="1" :max="maxQuantity(line.product_id)" required :class="inputCls" />
            </label>

            <button
              type="button"
              class="grid h-10 w-full cursor-pointer place-items-center rounded-xl border-2 border-ink bg-white text-destructive shadow-[2px_2px_0_#1B2430] transition-[transform,box-shadow,background-color] duration-100 hover:bg-pinky active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              :aria-label="items.length === 1 ? 'Kosongkan baris' : `Hapus baris ${index + 1}`"
              @click="removeLine(index)"
            >
              <Trash2 :size="16" :stroke-width="2" />
            </button>

            <p v-if="lineSubtotal(line) !== null" class="col-span-full -mt-0.5 mb-0.5 text-right text-xs font-bold text-muted-foreground">
              Subtotal {{ money(lineSubtotal(line) || 0) }}
            </p>
          </div>
        </div>

        <div class="grid gap-3.5 px-[18px] pt-3 pb-[18px] sm:grid-cols-2">
          <label class="admin-field">
            <span class="admin-field__label">Nama pembeli</span>
            <input v-model="customerName" type="text" placeholder="Pembeli Event" autocomplete="off" :class="inputCls" />
          </label>
          <label class="admin-field">
            <span class="admin-field__label">Nomor telepon <small class="font-medium text-muted-foreground">(opsional)</small></span>
            <input v-model="customerPhone" type="tel" inputmode="tel" placeholder="08xxxxxxxxxx" autocomplete="off" :class="inputCls" />
          </label>
          <label class="admin-field sm:col-span-2">
            <span class="admin-field__label">Catatan transaksi</span>
            <textarea v-model="deliveryNote" rows="2" placeholder="Nama event atau lokasi booth" :class="textareaCls" />
          </label>
        </div>

        <div class="px-[18px] pb-[18px] empty:hidden">
          <AdminState v-if="!products.length && !error" kind="loading" message="Memuat pilihan produk…" />
          <AdminState v-if="error" kind="error" :message="error" />
        </div>
      </section>

      <!-- Panel kanan -->
      <aside class="grid content-start gap-3.5 lg:sticky" :class="focusMode ? 'lg:top-[74px]' : 'lg:top-[18px]'">
        <!-- Struk terakhir -->
        <section
          v-if="receiptVisible && lastReceipt"
          ref="receiptEl"
          role="status"
          class="rounded-2xl border-[2.5px] border-ink bg-banner-sun p-4 shadow-[4px_4px_0_#1B2430]"
        >
          <header class="flex items-center gap-2.5">
            <span class="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-mint text-ink"><Check :size="16" /></span>
            <div class="min-w-0">
              <strong class="block font-head text-sm font-semibold">Transaksi tersimpan</strong>
              <small class="block truncate font-mono text-[11px] text-ink/70">{{ lastReceipt.order.order_number }}</small>
            </div>
          </header>

          <dl class="my-3 grid grid-cols-3 gap-2 border-y-2 border-dashed border-ink/30 py-2.5">
            <div class="min-w-0">
              <dt class="text-[11px] font-bold text-ink/60">Total</dt>
              <dd class="m-0 mt-0.5 truncate text-xs font-extrabold tabular-nums">{{ money(lastReceipt.order.total) }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[11px] font-bold text-ink/60">Tunai</dt>
              <dd class="m-0 mt-0.5 truncate text-xs font-extrabold tabular-nums">{{ money(lastReceipt.cash) }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[11px] font-bold text-ink/60">Kembali</dt>
              <dd class="m-0 mt-0.5 truncate text-xs font-extrabold tabular-nums">{{ money(lastReceipt.change) }}</dd>
            </div>
          </dl>

          <div class="grid gap-2 sm:grid-cols-2">
            <AdminButton variant="primary" class="h-9! px-2! text-xs!" @click="printLastReceipt"><Printer :size="15" /> Cetak struk</AdminButton>
            <AdminButton variant="secondary" class="h-9! px-2! text-xs!" @click="startNew"><Plus :size="15" /> Transaksi baru</AdminButton>
          </div>

          <label class="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink/70">
            <input v-model="autoPrint" type="checkbox" class="accent-ink" />
            <span>Cetak struk otomatis setelah transaksi</span>
          </label>
        </section>

        <!-- Ringkasan -->
        <section class="admin-panel overflow-hidden">
          <header class="flex items-start justify-between gap-2.5 border-b-2 border-ink/10 px-4 py-3.5">
            <div>
              <h2 class="m-0 font-head text-base font-bold">Ringkasan</h2>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ totalQty }} item · {{ lineDetails.length }} produk</p>
            </div>
            <div class="flex flex-wrap justify-end gap-1.5">
              <button v-if="lastReceipt && !receiptVisible" type="button" :class="ghostBtnCls" @click="receiptVisible = true"><ReceiptText :size="14" /> Struk</button>
              <button type="button" :class="ghostBtnCls" :aria-pressed="calculatorOpen" @click="calculatorOpen = !calculatorOpen"><Calculator :size="14" /> {{ calculatorOpen ? 'Tutup' : 'Kalkulator' }}</button>
            </div>
          </header>

          <dl v-if="lineDetails.length" class="m-0 grid max-h-52 gap-1.5 overflow-auto px-4 py-3">
            <div v-for="line in lineDetails" :key="line.product_id" class="flex justify-between gap-2.5 text-xs">
              <dt class="truncate text-ink/80">{{ line.quantity }}× {{ line.name }}</dt>
              <dd class="m-0 shrink-0 whitespace-nowrap font-bold tabular-nums">{{ money(line.subtotal) }}</dd>
            </div>
          </dl>
          <p v-else class="m-0 px-4 py-3.5 text-xs text-muted-foreground">Belum ada item dipilih.</p>

          <div class="flex items-baseline justify-between gap-3 border-t-2 border-ink bg-banner-sun px-4 py-3">
            <span class="text-sm font-bold">Total</span>
            <strong class="font-head text-2xl font-semibold tracking-tight tabular-nums">{{ money(total) }}</strong>
          </div>

          <div class="grid gap-2.5 border-t-2 border-ink/10 px-4 py-3.5">
            <label class="grid gap-1.5" for="pos-cash">
              <span class="text-xs font-bold text-ink/70">Uang diterima</span>
              <div class="flex h-11 items-center gap-1.5 rounded-xl border-2 border-ink bg-white px-3 focus-within:bg-[#fffaf0]">
                <span class="shrink-0 text-xs font-extrabold text-ink/50">Rp</span>
                <input
                  id="pos-cash"
                  v-model="cashReceived"
                  type="number"
                  min="0"
                  step="1000"
                  inputmode="numeric"
                  placeholder="0"
                  autocomplete="off"
                  class="h-full w-full border-0 bg-transparent p-0 text-right font-body text-base font-bold tabular-nums outline-none focus-visible:outline-none"
                />
              </div>
            </label>

            <div v-if="quickCash.length" class="flex flex-wrap gap-1.5">
              <button v-for="amount in quickCash" :key="amount" type="button" :class="chipBtnCls" @click="cashReceived = String(amount)">
                {{ amount === total ? 'Uang pas' : money(amount) }}
              </button>
            </div>

            <div
              class="flex items-baseline justify-between gap-3 rounded-xl border-2 border-ink px-3 py-2"
              :class="change < 0 ? 'bg-pinky' : 'bg-mint'"
            >
              <span class="text-xs font-bold">{{ change < 0 ? 'Kurang' : 'Kembalian' }}</span>
              <strong class="font-head text-base font-semibold tabular-nums">{{ money(Math.abs(change)) }}</strong>
            </div>
            <p v-if="change < 0" class="-mt-0.5 text-[11px] font-semibold text-destructive">Uang tunai belum cukup untuk total transaksi.</p>
          </div>

          <div class="px-4 pb-3.5">
            <AdminButton type="submit" variant="primary" class="h-11! w-full! text-sm!" :disabled="!canSubmit">{{ busy ? 'Menyimpan…' : 'Simpan & bayar tunai' }}</AdminButton>
            <p class="mt-2 mb-0 text-center text-[11px] text-ink/50">Tekan Enter di kolom uang untuk menyimpan transaksi.</p>
          </div>
        </section>

        <PosCalculator v-if="calculatorOpen" @use="applyCalculator" />

        <div v-if="!focusMode" class="border-t-[3px] border-sun px-0.5 pt-3.5">
          <strong class="font-head text-sm font-semibold">Informasi kasir</strong>
          <p class="mt-1 mb-0 text-sm leading-relaxed text-muted-foreground">Transaksi POS dicatat sebagai tunai dan langsung lunas. Gunakan mode fokus untuk layar kasir penuh dengan kalkulator.</p>
        </div>
      </aside>
    </form>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Calculator, Check, Maximize2, Minimize2, Plus, Printer, ReceiptText, Store, Trash2 } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminState from '@/components/ui/AdminState.vue'
import PosCalculator from '@/components/admin/PosCalculator.vue'
import { catalogApi } from '@/api/catalog'
import { adminApi } from '@/api/admin'
import type { CatalogProduct } from '@/types/catalog'
import { ApiError } from '@/api/client'
import { useAuth } from '@/composables/useAuth'

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

const AUTOPRINT_KEY = 'mochibako.pos.autoprint'
const { user } = useAuth()
const products = ref<CatalogProduct[]>([])
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
    // Fallback: overlay fixed memenuhi layar lewat class .is-focus
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

function addLine() { items.value.push({ product_id: 0, quantity: 1 }) }
function removeLine(index: number) {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
    return
  }
  // Baris terakhir tidak dihapus, cukup dikosongkan.
  items.value[index] = { product_id: 0, quantity: 1 }
}
function maxQuantity(productId: number) {
  const product = products.value.find((item) => item.id === productId)
  return product ? Math.max(1, product.stock) : undefined
}
function lineSubtotal(line: PosLine) {
  const product = products.value.find((item) => item.id === line.product_id)
  return product ? Number(product.price) * Math.max(1, Number(line.quantity) || 0) : null
}

const lineDetails = computed(() => items.value.flatMap((line) => {
  const product = products.value.find((item) => item.id === line.product_id)
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
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.body.style.overflow = savedOverflow
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
})
</script>

<template>
  <div ref="posRoot" class="pos-page" :class="{ 'is-focus': focusMode }">
    <AdminPageHeader v-if="!focusMode" title="Kasir acara" description="Catat penjualan langsung. Transaksi POS dibayar tunai dan langsung lunas.">
      <AdminButton variant="primary" @click="enterFocus"><Maximize2 :size="15" /> Mode fokus</AdminButton>
    </AdminPageHeader>

    <header v-else class="pos-focus-bar">
      <div class="pos-focus-bar__brand">
        <span class="pos-focus-bar__mark"><Store :size="18" /></span>
        <div><strong>Kasir acara</strong><small>Mode fokus · {{ totalQty }} item</small></div>
      </div>
      <div class="pos-focus-bar__total"><small>Total</small><strong>{{ money(total) }}</strong></div>
      <div class="pos-focus-bar__actions">
        <button type="button" class="pos-focus-action" :aria-pressed="calculatorOpen" @click="calculatorOpen = !calculatorOpen"><Calculator :size="16" /> Kalkulator</button>
        <button type="button" class="pos-focus-action pos-focus-action--exit" @click="exitFocus"><Minimize2 :size="16" /> Keluar</button>
      </div>
    </header>

    <form id="pos-form" class="admin-pos-layout" @submit.prevent="submit">
      <section class="admin-panel admin-pos-form">
        <div class="admin-panel__header">
          <div><h2>Item transaksi</h2><p>Stok diperbarui otomatis setelah transaksi tersimpan.</p></div>
          <AdminButton type="button" variant="secondary" @click="addLine"><Plus :size="15" /> Baris</AdminButton>
        </div>

        <div class="admin-pos-lines">
          <div v-for="(line, index) in items" :key="index" class="admin-pos-line">
            <label class="admin-field">
              <span>Produk</span>
              <select v-model.number="line.product_id" required>
                <option :value="0" disabled>Pilih produk</option>
                <option v-for="product in products" :key="product.id" :value="product.id" :disabled="product.stock === 0">
                  {{ product.name }} · {{ product.stock === 0 ? 'stok habis' : `stok ${product.stock}` }}
                </option>
              </select>
            </label>
            <label class="admin-field admin-field--quantity">
              <span>Jumlah</span>
              <input v-model.number="line.quantity" type="number" min="1" :max="maxQuantity(line.product_id)" required />
            </label>
            <button type="button" class="admin-remove" :aria-label="items.length === 1 ? 'Kosongkan baris' : `Hapus baris ${index + 1}`" @click="removeLine(index)"><Trash2 :size="16" :stroke-width="2" /></button>
            <p v-if="lineSubtotal(line) !== null" class="admin-pos-line__subtotal">Subtotal {{ money(lineSubtotal(line) || 0) }}</p>
          </div>
        </div>

        <div class="admin-pos-customer">
          <label class="admin-field">
            <span>Nama pembeli</span>
            <input v-model="customerName" type="text" placeholder="Pembeli Event" autocomplete="off" />
          </label>
          <label class="admin-field">
            <span>Nomor telepon <small>(opsional)</small></span>
            <input v-model="customerPhone" type="tel" inputmode="tel" placeholder="08xxxxxxxxxx" autocomplete="off" />
          </label>
          <label class="admin-field">
            <span>Catatan transaksi</span>
            <textarea v-model="deliveryNote" rows="2" placeholder="Nama event atau lokasi booth" />
          </label>
        </div>

        <AdminState v-if="!products.length && !error" kind="loading" message="Memuat pilihan produk…" />
        <AdminState v-if="error" kind="error" :message="error" />
      </section>

      <aside class="admin-pos-aside">
        <section v-if="receiptVisible && lastReceipt" ref="receiptEl" class="pos-receipt-card" role="status">
          <header class="pos-receipt-card__head">
            <span class="pos-receipt-card__icon"><Check :size="16" /></span>
            <div><strong>Transaksi tersimpan</strong><small>{{ lastReceipt.order.order_number }}</small></div>
          </header>
          <dl class="pos-receipt-card__meta">
            <div><dt>Total</dt><dd>{{ money(lastReceipt.order.total) }}</dd></div>
            <div><dt>Tunai</dt><dd>{{ money(lastReceipt.cash) }}</dd></div>
            <div><dt>Kembali</dt><dd>{{ money(lastReceipt.change) }}</dd></div>
          </dl>
          <div class="pos-receipt-card__actions">
            <AdminButton variant="primary" @click="printLastReceipt"><Printer :size="15" /> Cetak struk</AdminButton>
            <AdminButton variant="secondary" @click="startNew"><Plus :size="15" /> Transaksi baru</AdminButton>
          </div>
          <label class="pos-autoprint"><input v-model="autoPrint" type="checkbox" /><span>Cetak struk otomatis setelah transaksi</span></label>
        </section>

        <section class="pos-summary admin-panel">
          <header class="pos-summary__head">
            <div><h2>Ringkasan</h2><p>{{ totalQty }} item · {{ lineDetails.length }} produk</p></div>
            <div class="pos-summary__head-actions">
              <button v-if="lastReceipt && !receiptVisible" type="button" class="pos-ghost-button" @click="receiptVisible = true"><ReceiptText :size="14" /> Struk</button>
              <button type="button" class="pos-ghost-button" :aria-pressed="calculatorOpen" @click="calculatorOpen = !calculatorOpen"><Calculator :size="14" /> {{ calculatorOpen ? 'Tutup' : 'Kalkulator' }}</button>
            </div>
          </header>

          <dl class="pos-summary__lines">
            <div v-for="line in lineDetails" :key="line.product_id">
              <dt>{{ line.quantity }}× {{ line.name }}</dt>
              <dd>{{ money(line.subtotal) }}</dd>
            </div>
          </dl>
          <p v-if="!lineDetails.length" class="pos-summary__empty">Belum ada item dipilih.</p>

          <div class="pos-summary__total"><span>Total</span><strong>{{ money(total) }}</strong></div>

          <div class="pos-summary__cash">
            <label class="pos-cash-field" for="pos-cash">
              <span>Uang diterima</span>
              <div class="pos-cash-input">
                <span>Rp</span>
                <input id="pos-cash" v-model="cashReceived" type="number" min="0" step="1000" inputmode="numeric" placeholder="0" autocomplete="off" />
              </div>
            </label>

            <div v-if="quickCash.length" class="pos-quick-cash">
              <button v-for="amount in quickCash" :key="amount" type="button" @click="cashReceived = String(amount)">{{ amount === total ? 'Uang pas' : money(amount) }}</button>
            </div>

            <div class="pos-change" :class="{ 'is-short': change < 0 }">
              <span>{{ change < 0 ? 'Kurang' : 'Kembalian' }}</span>
              <strong>{{ money(Math.abs(change)) }}</strong>
            </div>
            <p v-if="change < 0" class="pos-change-note">Uang tunai belum cukup untuk total transaksi.</p>
          </div>

          <div class="pos-summary__actions">
            <AdminButton type="submit" variant="primary" :disabled="!canSubmit">{{ busy ? 'Menyimpan…' : 'Simpan & bayar tunai' }}</AdminButton>
            <p class="pos-summary__hint">Tekan Enter di kolom uang untuk menyimpan transaksi.</p>
          </div>
        </section>

        <PosCalculator v-if="calculatorOpen" @use="applyCalculator" />

        <div v-if="!focusMode" class="pos-help">
          <strong>Informasi kasir</strong>
          <p>Transaksi POS dicatat sebagai tunai dan langsung lunas. Gunakan mode fokus untuk layar kasir penuh dengan kalkulator.</p>
        </div>
      </aside>
    </form>
  </div>
</template>

<style scoped>
/* ---------- Kerangka ---------- */
.admin-pos-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr);
  gap: 18px;
  align-items: start;
}

.admin-pos-form {
  overflow: hidden;
}

.admin-pos-lines {
  display: grid;
  gap: 12px;
  padding: 16px 18px 4px;
}

.admin-pos-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 34px;
  gap: 10px;
  align-items: end;
}

.admin-pos-line__subtotal {
  grid-column: 1 / -1;
  margin: -2px 0 2px;
  color: #7a8289;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}

.admin-pos-customer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 12px 18px 18px;
}

.admin-pos-customer .admin-field:last-child {
  grid-column: 1 / -1;
}

.admin-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
}

.admin-field > span {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: #4e5863;
}

.admin-field small {
  color: #8a9198;
  font-weight: 500;
  font-size: 11px;
}

.admin-field input,
.admin-field select,
.admin-field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid #dcd8ce;
  border-radius: 7px;
  background: #fff;
  color: #1b2430;
  font: 400 13.5px var(--font-body);
  padding: 9px 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.admin-field input,
.admin-field select {
  height: 40px;
}

.admin-field textarea {
  resize: vertical;
}

.admin-field input:focus-visible,
.admin-field select:focus-visible,
.admin-field textarea:focus-visible {
  outline: none;
  border-color: #d9b04a;
  box-shadow: 0 0 0 3px #f6e6b3;
}

.admin-remove {
  height: 40px;
  border: 1px solid #e3d9d5;
  border-radius: 7px;
  background: #fff;
  color: #8b5449;
  cursor: pointer;
}

.admin-remove:hover {
  background: #fbf1ee;
  border-color: #d9bdb5;
}

/* ---------- Panel kanan ---------- */
.admin-pos-aside {
  position: sticky;
  top: 18px;
  display: grid;
  gap: 13px;
  align-content: start;
}

.pos-summary {
  overflow: hidden;
}

.pos-summary__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #e8e5dd;
}

.pos-summary__head h2 {
  margin: 0;
  font: 600 16px var(--font-head);
}

.pos-summary__head p {
  margin: 3px 0 0;
  color: #68717b;
  font-size: 11.5px;
}

.pos-summary__head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.pos-ghost-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 29px;
  padding: 0 9px;
  border: 1px solid #e0dbcf;
  border-radius: 7px;
  background: #fff;
  color: #5b6470;
  font: 700 10.5px var(--font-body);
  cursor: pointer;
}

.pos-ghost-button:hover {
  background: #f6f3ea;
  color: #1b2430;
}

.pos-summary__lines {
  display: grid;
  gap: 6px;
  max-height: 210px;
  margin: 0;
  padding: 12px 16px;
  overflow: auto;
}

.pos-summary__lines > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.pos-summary__lines dt {
  overflow: hidden;
  color: #4e5863;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pos-summary__lines dd {
  margin: 0;
  flex: none;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.pos-summary__empty {
  margin: 0;
  padding: 14px 16px;
  color: #818a92;
  font-size: 12px;
}

.pos-summary__total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #e8e5dd;
  background: #fbf9f3;
}

.pos-summary__total span {
  color: #68717b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.pos-summary__total strong {
  font: 600 23px var(--font-head);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.pos-summary__cash {
  display: grid;
  gap: 10px;
  padding: 13px 16px;
  border-top: 1px solid #e8e5dd;
}

.pos-cash-field {
  display: grid;
  gap: 6px;
}

.pos-cash-field > span {
  color: #5c6670;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pos-cash-input {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 11px;
  border: 1px solid #d8d4ca;
  border-radius: 8px;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.pos-cash-input:focus-within {
  border-color: #d9b04a;
  box-shadow: 0 0 0 3px #f6e6b3;
}

.pos-cash-input span {
  flex: none;
  color: #8a9198;
  font-size: 12px;
  font-weight: 800;
}

.pos-cash-input input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1b2430;
  font: 700 16px var(--font-body);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.pos-quick-cash {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pos-quick-cash button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #ddd4bd;
  border-radius: 999px;
  background: #fff;
  color: #5d4a13;
  font: 700 11.5px var(--font-body);
  cursor: pointer;
}

.pos-quick-cash button:hover {
  background: #fff6dc;
  border-color: #d9bf7c;
}

.pos-change {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 7px;
  background: #eef5ef;
  color: #2f5b38;
}

.pos-change span {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pos-change strong {
  font: 600 16px var(--font-head);
  font-variant-numeric: tabular-nums;
}

.pos-change.is-short {
  background: #fbefec;
  color: #8a453a;
}

.pos-change-note {
  margin: -3px 0 0;
  color: #8a453a;
  font-size: 10.5px;
  font-weight: 600;
}

.pos-summary__actions {
  padding: 0 16px 14px;
}

.pos-summary__actions :deep(.admin-button) {
  width: 100%;
  height: 44px;
  font-size: 13.5px;
}

.pos-summary__hint {
  margin: 7px 0 0;
  color: #8a9198;
  font-size: 10.5px;
  text-align: center;
}

/* ---------- Kartu struk ---------- */
.pos-receipt-card {
  padding: 14px 16px;
  border: 1px solid #d9c9a0;
  border-radius: 10px;
  background: #fffdf6;
  box-shadow: 0 1px 2px #1b24300a;
}

.pos-receipt-card__head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.pos-receipt-card__head strong {
  display: block;
  font: 600 14px var(--font-head);
  color: #3d2f08;
}

.pos-receipt-card__head small {
  display: block;
  margin-top: 1px;
  color: #7a6a3d;
  font: 500 11px ui-monospace, SFMono-Regular, Menlo, monospace;
}

.pos-receipt-card__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #e8f2e9;
  color: #2f5b38;
}

.pos-receipt-card__meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 11px 0;
  padding: 9px 0;
  border-top: 1px dashed #e2d6b4;
  border-bottom: 1px dashed #e2d6b4;
}

.pos-receipt-card__meta dt {
  color: #8a7b52;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pos-receipt-card__meta dd {
  margin: 2px 0 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pos-receipt-card__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.pos-receipt-card__actions :deep(.admin-button) {
  height: 36px;
  font-size: 11.5px;
  padding: 0 8px;
}

.pos-autoprint {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  color: #6d644d;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.pos-autoprint input {
  accent-color: #9b6d00;
}

.pos-help {
  padding: 13px 2px 0;
  border-top: 2px solid #d8bb6e;
}

.pos-help strong {
  font: 600 14px var(--font-head);
}

.pos-help p {
  margin: 4px 0 0;
  color: #68717b;
  font-size: 12.5px;
  line-height: 1.55;
}

/* ---------- Mode fokus ---------- */
.pos-page.is-focus {
  position: fixed;
  inset: 0;
  z-index: 90;
  overflow-y: auto;
  background: #f6f3ec;
}

.pos-page:fullscreen {
  overflow-y: auto;
  background: #f6f3ec;
}

.pos-page.is-focus .admin-pos-layout {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px clamp(14px, 2.4vw, 28px) 40px;
}

.pos-page.is-focus .admin-pos-aside {
  top: 74px;
}

.pos-focus-bar {
  position: sticky;
  top: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 9px clamp(14px, 2.4vw, 28px);
  background: #1b2430;
  color: #f6f3ec;
  box-shadow: 0 4px 18px #1b243029;
}

.pos-focus-bar__brand {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.pos-focus-bar__mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #f4c45a;
  color: #1b2430;
}

.pos-focus-bar__brand strong {
  display: block;
  font: 600 15px var(--font-head);
}

.pos-focus-bar__brand small {
  display: block;
  color: #aab3bc;
  font-size: 11px;
}

.pos-focus-bar__total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-left: auto;
  line-height: 1.1;
}

.pos-focus-bar__total small {
  color: #aab3bc;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.pos-focus-bar__total strong {
  color: #f7cd6f;
  font: 600 20px var(--font-head);
  font-variant-numeric: tabular-nums;
}

.pos-focus-bar__actions {
  display: flex;
  gap: 7px;
}

.pos-focus-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #46505c;
  border-radius: 8px;
  background: #2b3540;
  color: #e8ecf0;
  font: 700 12px var(--font-body);
  cursor: pointer;
}

.pos-focus-action:hover {
  background: #3a4552;
}

.pos-focus-action--exit {
  border-color: #7c4b40;
  background: #56332c;
  color: #ffd9cf;
}

.pos-focus-action--exit:hover {
  background: #683e35;
}

/* ---------- Responsif ---------- */
@media (max-width: 980px) {
  .admin-pos-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-pos-aside {
    position: static;
  }

  .pos-page.is-focus .admin-pos-aside {
    top: auto;
  }
}

@media (max-width: 640px) {
  .pos-focus-bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 9px 14px;
  }

  .pos-focus-bar__total {
    flex-direction: row;
    align-items: baseline;
    gap: 7px;
    width: 100%;
    margin-left: 0;
    padding-top: 7px;
    border-top: 1px solid #36414c;
  }

  .pos-focus-bar__total strong {
    font-size: 18px;
  }

  .pos-focus-bar__actions {
    margin-left: auto;
  }

  .pos-focus-action {
    padding: 0 10px;
    font-size: 11.5px;
  }

  .pos-receipt-card__actions {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .admin-pos-line {
    grid-template-columns: minmax(0, 1fr) 76px 32px;
    gap: 7px;
  }

  .admin-pos-customer {
    grid-template-columns: 1fr;
  }

  .admin-pos-customer .admin-field:last-child {
    grid-column: auto;
  }
}
</style>

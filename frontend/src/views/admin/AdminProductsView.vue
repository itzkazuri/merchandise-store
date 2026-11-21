<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Boxes, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, Trash2, X } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminDataTable from '@/components/ui/AdminDataTable.vue'
import AdminState from '@/components/ui/AdminState.vue'
import AdminProductForm from '@/components/admin/AdminProductForm.vue'
import { catalogApi } from '@/api/catalog'
import { adminApi } from '@/api/admin'
import type { CatalogProduct, Category } from '@/types/catalog'
import { ApiError } from '@/api/client'
import { hasAnyRole, useAuth } from '@/composables/useAuth'

interface ProductPage { items: CatalogProduct[]; total: number; page: number; size: number; pages: number; has_next: boolean; has_prev: boolean }
const rows = ref<CatalogProduct[]>([])
const pageInfo = ref<ProductPage>({ items: [], total: 0, page: 1, size: 20, pages: 0, has_next: false, has_prev: false })
const page = ref(1)
const search = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const animeFilter = ref('')
const categoryFilter = ref('')
const animes = ref<Category[]>([])
const productCategories = ref<Category[]>([])
const sort = ref('newest')
const loading = ref(true)
const error = ref('')
const formOpen = ref(false)
const filtersOpen = ref(false)
const selectedProduct = ref<CatalogProduct | null>(null)
const { user } = useAuth()
const canDelete = computed(() => hasAnyRole(user.value, ['admin']))
const columns = [
  { key: 'name', label: 'Produk' }, { key: 'sku', label: 'SKU' }, { key: 'product_type', label: 'Jenis' },
  { key: 'taxonomy', label: 'Kategori' },
  { key: 'price', label: 'Harga', numeric: true }, { key: 'stock', label: 'Stok', numeric: true },
  { key: 'sold_count', label: 'Terjual', numeric: true }, { key: 'status', label: 'Status' }, { key: 'actions', label: '' },
]
const showingRange = computed(() => {
  if (!pageInfo.value.total) return '0 produk'
  const first = (pageInfo.value.page - 1) * pageInfo.value.size + 1
  const last = Math.min(pageInfo.value.page * pageInfo.value.size, pageInfo.value.total)
  return `${first}–${last} dari ${pageInfo.value.total.toLocaleString('id-ID')} produk`
})
const hasActiveFilters = computed(() => Boolean(search.value.trim()) || Boolean(statusFilter.value) || Boolean(typeFilter.value) || Boolean(animeFilter.value) || Boolean(categoryFilter.value) || sort.value !== 'newest')
const activeFilterCount = computed(() => (statusFilter.value ? 1 : 0) + (typeFilter.value ? 1 : 0) + (animeFilter.value ? 1 : 0) + (categoryFilter.value ? 1 : 0) + (sort.value !== 'newest' ? 1 : 0))

let searchTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(1), 380)
}
function runSearch() {
  clearTimeout(searchTimer)
  load(1)
}
function clearSearch() {
  search.value = ''
  runSearch()
}
function resetFilters() {
  search.value = ''
  statusFilter.value = ''
  typeFilter.value = ''
  animeFilter.value = ''
  categoryFilter.value = ''
  sort.value = 'newest'
  filtersOpen.value = false
  runSearch()
}
onBeforeUnmount(() => clearTimeout(searchTimer))

async function load(nextPage = 1) {
  page.value = nextPage
  loading.value = true
  error.value = ''
  try {
    const data = await catalogApi.products({
      page: nextPage, size: pageInfo.value.size, q: search.value.trim() || undefined,
      status: statusFilter.value || undefined, product_type: typeFilter.value || undefined,
      anime: animeFilter.value || undefined, category: categoryFilter.value || undefined, sort: sort.value,
    }) as ProductPage
    rows.value = data.items || []
    pageInfo.value = { ...pageInfo.value, ...data }
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Katalog gagal dimuat. Periksa koneksi API dan role akun.'
  } finally { loading.value = false }
}

function createProduct() { selectedProduct.value = null; formOpen.value = true }
function editProduct(product: CatalogProduct) { selectedProduct.value = product; formOpen.value = true }
function price(value: string | number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: import.meta.env.VITE_CURRENCY || 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0)) }
function updatedAt(value?: string) { return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value)) : '—' }
function typeLabel(value?: string) { return value === 'handmade' ? 'Buatan tangan' : 'Impor' }
function statusLabel(value?: string) { return value === 'active' ? 'Aktif' : value === 'draft' ? 'Draft' : value === 'archived' ? 'Diarsipkan' : value || '—' }
function stockLabel(value: number) { return value === 0 ? 'Habis' : value <= 5 ? 'Menipis' : 'Tersedia' }
function removeProduct(product: CatalogProduct) {
  if (!canDelete.value || !window.confirm(`Hapus “${product.name}” dari katalog? Tindakan ini tidak dapat dibatalkan.`)) return
  void (async () => {
    error.value = ''
    try {
      await adminApi.deleteProduct(product.id)
      await load(page.value)
    } catch (cause) { error.value = cause instanceof ApiError ? cause.message : 'Produk gagal dihapus.' }
  })()
}

async function loadTaxonomy() {
  try {
    const data = await adminApi.categories({ include_inactive: true }) as Category[]
    const list = Array.isArray(data) ? data : []
    animes.value = list.filter((item) => item.kind === 'anime')
    productCategories.value = list.filter((item) => item.kind === 'product')
  } catch {
    // Filter kategori opsional: biarkan kosong kalau gagal dimuat.
  }
}

onMounted(() => {
  void loadTaxonomy()
  void load()
})
</script>

<template>
  <div class="admin-products-page">
    <AdminPageHeader title="Produk" description="Kelola identitas katalog, harga, stok, status, dan gambar produk.">
      <AdminButton variant="primary" @click="createProduct"><Plus :size="16" /> Tambah produk</AdminButton>
    </AdminPageHeader>

    <div v-if="error && !loading" class="admin-products-alert" role="alert">{{ error }}</div>

    <section class="admin-panel admin-products-panel" aria-label="Katalog produk">
      <header class="admin-panel__header admin-products-panel__head">
        <div>
          <h2>Katalog produk</h2>
          <p aria-live="polite">{{ loading && !rows.length ? 'Memuat…' : showingRange }}</p>
        </div>
        <AdminButton variant="quiet" aria-label="Muat ulang katalog" :disabled="loading" @click="load(page)">
          <RefreshCw :size="16" :class="{ 'is-spinning': loading }" />
        </AdminButton>
      </header>

      <form class="admin-product-toolbar" role="search" @submit.prevent="runSearch">
        <div class="admin-product-search">
          <Search :size="16" aria-hidden="true" class="admin-product-search__icon" />
          <label class="sr-only" for="admin-product-search">Cari nama, SKU, slug, atau deskripsi</label>
          <input
            id="admin-product-search"
            v-model="search"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            placeholder="Cari nama, SKU, atau slug"
            @input="scheduleSearch"
          />
          <button v-if="search" type="button" class="admin-product-search__clear" aria-label="Hapus pencarian" @click="clearSearch">
            <X :size="14" />
          </button>
        </div>

        <button
          type="button"
          class="admin-product-filter-toggle"
          :class="{ 'is-active': filtersOpen || activeFilterCount > 0 }"
          :aria-expanded="filtersOpen"
          aria-controls="admin-product-filters"
          @click="filtersOpen = !filtersOpen"
        >
          <SlidersHorizontal :size="15" /> Filter
          <span v-if="activeFilterCount" class="admin-product-filter-count">{{ activeFilterCount }}</span>
        </button>

        <div id="admin-product-filters" class="admin-product-filters" :class="{ 'is-open': filtersOpen }">
          <label class="admin-product-filter">
            <span class="admin-product-filter__label">Jenis</span>
            <select v-model="typeFilter" aria-label="Filter jenis produk" @change="runSearch">
              <option value="">Semua jenis</option>
              <option value="imported">Impor</option>
              <option value="handmade">Buatan tangan</option>
            </select>
          </label>
          <label class="admin-product-filter">
            <span class="admin-product-filter__label">Anime</span>
            <select v-model="animeFilter" aria-label="Filter seri anime" @change="runSearch">
              <option value="">Semua anime</option>
              <option v-for="item in animes" :key="item.id" :value="item.slug">{{ item.name }}</option>
            </select>
          </label>
          <label class="admin-product-filter">
            <span class="admin-product-filter__label">Jenis produk</span>
            <select v-model="categoryFilter" aria-label="Filter jenis produk" @change="runSearch">
              <option value="">Semua kategori</option>
              <option v-for="item in productCategories" :key="item.id" :value="item.slug">{{ item.name }}</option>
            </select>
          </label>
          <label class="admin-product-filter">
            <span class="admin-product-filter__label">Status</span>
            <select v-model="statusFilter" aria-label="Filter status katalog" @change="runSearch">
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="draft">Draft</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </label>
          <label class="admin-product-filter admin-product-sort">
            <span class="admin-product-filter__label">Urutkan</span>
            <select v-model="sort" aria-label="Urutkan produk" @change="runSearch">
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="price_asc">Harga terendah</option>
              <option value="price_desc">Harga tertinggi</option>
              <option value="best_seller">Terlaris</option>
              <option value="name">Nama A–Z</option>
            </select>
          </label>
          <button v-if="hasActiveFilters" type="button" class="admin-product-reset" @click="resetFilters">
            <RotateCcw :size="13" /> Reset
          </button>
        </div>
      </form>

      <AdminState v-if="loading && !rows.length" kind="loading" message="Memuat produk…" />
      <AdminState v-else-if="error && !rows.length" kind="error" :message="error" @retry="load(page)" />
      <div v-else-if="!rows.length" class="admin-products-empty">
        <Boxes :size="22" />
        <strong>{{ hasActiveFilters ? 'Tidak ada produk yang cocok' : 'Belum ada produk' }}</strong>
        <span>{{ hasActiveFilters ? 'Coba kata kunci lain atau reset filter.' : 'Tambahkan produk pertama untuk mulai berjualan.' }}</span>
        <button v-if="hasActiveFilters" type="button" class="admin-products-empty__reset" @click="resetFilters">
          <RotateCcw :size="13" /> Reset pencarian &amp; filter
        </button>
        <AdminButton v-else variant="secondary" @click="createProduct"><Plus :size="15" /> Tambah produk</AdminButton>
      </div>

      <template v-else>
        <div class="admin-product-results" :class="{ 'is-refreshing': loading }" :aria-busy="loading">
          <AdminDataTable :columns="columns" :rows="rows" row-key="id">
            <template #name="{ row }">
              <span class="admin-product-name"><strong>{{ row.name }}</strong><small>{{ row.description || 'Belum ada deskripsi' }}</small><small class="admin-product-name__meta">{{ row.slug || 'Slug dibuat otomatis' }}<i>·</i>{{ row.images?.length || 0 }} gambar</small></span>
            </template>
            <template #sku="{ row }"><span class="admin-product-sku">{{ row.sku || '—' }}</span></template>
            <template #product_type="{ row }"><span class="admin-product-type">{{ typeLabel(row.product_type) }}</span></template>
            <template #taxonomy="{ row }">
              <span v-if="row.anime || row.category" class="admin-product-taxonomy">
                <span v-if="row.anime" class="admin-product-tag">{{ row.anime.name }}</span>
                <span v-if="row.category" class="admin-product-tag admin-product-tag--alt">{{ row.category.name }}</span>
              </span>
              <span v-else class="admin-cell-sub">Belum diatur</span>
            </template>
            <template #price="{ row }"><span class="admin-product-number">{{ price(row.price) }}</span></template>
            <template #stock="{ row }"><span class="admin-stock" :class="{ 'is-low': row.stock <= 5, 'is-out': row.stock === 0 }"><b>{{ Number(row.stock).toLocaleString('id-ID') }}</b><small>{{ stockLabel(row.stock) }}</small></span></template>
            <template #sold_count="{ row }"><span class="admin-product-number">{{ Number(row.sold_count || 0).toLocaleString('id-ID') }}</span></template>
            <template #status="{ row }"><span class="admin-product-status" :data-status="row.status">{{ statusLabel(row.status) }}</span><small class="admin-cell-sub">{{ updatedAt(row.updated_at) }}</small></template>
            <template #actions="{ row }"><div class="admin-product-actions"><button type="button" class="admin-product-action" @click="editProduct(row)"><Pencil :size="14" /><span>Edit</span></button><button v-if="canDelete" type="button" class="admin-product-action admin-product-action--danger" @click="removeProduct(row)"><span>Hapus</span></button></div></template>
          </AdminDataTable>

          <div class="admin-product-cards">
            <article v-for="product in rows" :key="product.id" class="admin-product-card">
              <header class="admin-product-card__head">
                <div class="admin-product-card__title">
                  <strong>{{ product.name }}</strong>
                  <span class="admin-product-card__meta">{{ product.sku || 'Tanpa SKU' }} · {{ typeLabel(product.product_type) }}</span>
                  <span v-if="product.anime || product.category" class="admin-product-taxonomy admin-product-taxonomy--card">
                    <span v-if="product.anime" class="admin-product-tag">{{ product.anime.name }}</span>
                    <span v-if="product.category" class="admin-product-tag admin-product-tag--alt">{{ product.category.name }}</span>
                  </span>
                </div>
                <span class="admin-product-status" :data-status="product.status">{{ statusLabel(product.status) }}</span>
              </header>

              <dl class="admin-product-card__stats">
                <div><dt>Harga</dt><dd>{{ price(product.price) }}</dd></div>
                <div>
                  <dt>Stok</dt>
                  <dd><span class="admin-stock admin-stock--card" :class="{ 'is-low': product.stock <= 5, 'is-out': product.stock === 0 }"><b>{{ Number(product.stock).toLocaleString('id-ID') }}</b><small>{{ stockLabel(product.stock) }}</small></span></dd>
                </div>
                <div><dt>Terjual</dt><dd>{{ Number(product.sold_count || 0).toLocaleString('id-ID') }}</dd></div>
              </dl>

              <footer class="admin-product-card__actions">
                <AdminButton variant="secondary" @click="editProduct(product)"><Pencil :size="14" /> Edit</AdminButton>
                <AdminButton v-if="canDelete" variant="secondary" @click="removeProduct(product)"><Trash2 :size="14" /> Hapus</AdminButton>
              </footer>
            </article>
          </div>
        </div>

        <footer v-if="pageInfo.pages > 1" class="admin-product-pagination">
          <span>Halaman {{ pageInfo.page }} dari {{ pageInfo.pages }}</span>
          <div>
            <AdminButton variant="secondary" :disabled="!pageInfo.has_prev || loading" @click="load(pageInfo.page - 1)"><ChevronLeft :size="15" /> Sebelumnya</AdminButton>
            <AdminButton variant="secondary" :disabled="!pageInfo.has_next || loading" @click="load(pageInfo.page + 1)">Berikutnya <ChevronRight :size="15" /></AdminButton>
          </div>
        </footer>
      </template>
    </section>

    <AdminProductForm v-model="formOpen" :product="selectedProduct" @saved="load(page)" />
  </div>
</template>

<style scoped>
/* ---------- Panel & toolbar ---------- */
.admin-products-panel {
  overflow: hidden;
}

.admin-products-panel__head {
  padding: 15px 18px;
}

.admin-products-panel__head h2 {
  font-size: 16px;
}

.admin-products-panel__head p {
  margin: 3px 0 0;
  color: #68717b;
  font-size: 12px;
}

.admin-product-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 13px 16px;
  border-bottom: 1px solid #e8e5dd;
  background: #fdfcf8;
}

.admin-product-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 260px;
  max-width: 380px;
  height: 38px;
  padding: 0 6px 0 11px;
  border: 1px solid #ddd9ce;
  border-radius: 8px;
  background: #fff;
  color: #69727c;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.admin-product-search:focus-within {
  border-color: #c4a24a;
  box-shadow: 0 0 0 3px #f6e6b3;
  outline: none;
}

.admin-product-search__icon {
  flex: none;
}

.admin-product-search input {
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1b2430;
  font: 400 13px var(--font-body);
}

.admin-product-search input::-webkit-search-cancel-button {
  display: none;
}

.admin-product-search__clear {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: #efece4;
  color: #5f6770;
  cursor: pointer;
}

.admin-product-search__clear:hover {
  background: #e6e1d5;
  color: #1b2430;
}

.admin-product-filter-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid #ddd9ce;
  border-radius: 8px;
  background: #fff;
  color: #3f4852;
  font: 700 12.5px var(--font-body);
  cursor: pointer;
}

.admin-product-filter-toggle.is-active {
  border-color: #d9bf7c;
  background: #fff6dc;
  color: #6b4a00;
}

.admin-product-filter-count {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #1b2430;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
}

.admin-product-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.admin-product-filter {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.admin-product-filter__label {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.admin-product-filter select {
  height: 38px;
  max-width: 160px;
  padding: 0 28px 0 10px;
  border: 1px solid #ddd9ce;
  border-radius: 8px;
  background: #fff;
  color: #3f4852;
  font: 600 12px var(--font-body);
}

.admin-product-filter select:focus-visible {
  outline: 3px solid #f1d98f;
  outline-offset: 1px;
}

.admin-product-sort {
  margin-left: 0;
}

.admin-product-reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 38px;
  padding: 0 9px;
  border: 1px dashed #d5c6a2;
  border-radius: 8px;
  background: transparent;
  color: #7c6220;
  font: 700 11.5px var(--font-body);
  cursor: pointer;
}

.admin-product-reset:hover {
  background: #fff6dc;
  border-color: #d9bf7c;
}

/* ---------- Hasil & tabel ---------- */
.admin-product-results {
  transition: opacity 0.15s ease;
}

.admin-product-results.is-refreshing {
  opacity: 0.55;
  pointer-events: none;
}

.admin-products-page :deep(.admin-table th) {
  padding-top: 11px;
  padding-bottom: 11px;
}

.admin-products-page :deep(.admin-table td) {
  padding-top: 12px;
  padding-bottom: 12px;
}

.admin-products-page :deep(.admin-table th:last-child) {
  width: 116px;
}

.admin-product-name {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 195px;
}

.admin-product-name strong {
  display: block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.admin-product-name small {
  display: block;
  max-width: 270px;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #737b84;
  font-size: 11px;
}

.admin-product-name small i {
  padding: 0 5px;
  color: #aa9d83;
  font-style: normal;
}

.admin-product-name .admin-product-name__meta {
  max-width: none;
}

.admin-product-sku {
  font: 500 12px ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #4e5863;
}

.admin-product-type {
  font-size: 12px;
  color: #58616a;
  white-space: nowrap;
}

.admin-product-taxonomy {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 190px;
}

.admin-product-taxonomy--card {
  margin-top: 5px;
  max-width: none;
}

.admin-product-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border: 1px solid #e2d6b4;
  border-radius: 999px;
  background: #fff8e4;
  color: #6b5200;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.6;
  white-space: nowrap;
}

.admin-product-tag--alt {
  border-color: #d5dedb;
  background: #f1f6f4;
  color: #3c5a50;
}

.admin-product-number {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.admin-stock {
  display: inline-flex;
  min-width: 58px;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.25;
}

.admin-stock b {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.admin-stock small {
  font-size: 10px;
  color: #788079;
}

.admin-stock.is-low small {
  color: #87620d;
}

.admin-stock.is-out small {
  color: #994d41;
}

.admin-stock--card {
  align-items: flex-start;
}

.admin-product-status {
  display: inline-block;
  border-radius: 999px;
  padding: 3px 8px;
  background: #eeece6;
  color: #62615c;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.admin-product-status[data-status='active'] {
  background: #e6f0e8;
  color: #315b38;
}

.admin-product-status[data-status='draft'] {
  background: #fff0c9;
  color: #704f10;
}

.admin-product-status[data-status='archived'] {
  background: #efeee9;
  color: #59616a;
}

.admin-product-status + .admin-cell-sub {
  display: block;
  margin-top: 4px;
  font-size: 10px;
}

.admin-product-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.admin-product-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 2px;
  border: 0;
  background: transparent;
  color: #34414f;
  font: 700 11px var(--font-body);
  cursor: pointer;
}

.admin-product-action:hover {
  text-decoration: underline;
}

.admin-product-action--danger {
  color: #8b5449;
}

/* Kartu produk: hanya tampil di layar kecil */
.admin-product-cards {
  display: none;
}

/* ---------- Empty state ---------- */
.admin-products-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 190px;
  padding: 24px 18px;
  color: #69727c;
  text-align: center;
}

.admin-products-empty strong {
  font: 600 14px var(--font-head);
  color: #34404d;
}

.admin-products-empty span {
  font-size: 12px;
}

.admin-products-empty__reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 6px 11px;
  border: 1px solid #ddd9ce;
  border-radius: 7px;
  background: #fff;
  color: #5d461a;
  font: 700 12px var(--font-body);
  cursor: pointer;
}

.admin-products-empty :deep(.admin-button) {
  margin-top: 8px;
}

/* ---------- Pagination & alert ---------- */
.admin-product-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #e8e5dd;
  color: #68717b;
  font-size: 12px;
}

.admin-product-pagination > div {
  display: flex;
  gap: 8px;
}

.admin-product-pagination :deep(.admin-button) {
  height: 33px;
  font-size: 12px;
}

.admin-products-alert {
  margin: -10px 0 16px;
  padding: 10px 12px;
  border: 1px solid #e6c8c2;
  border-radius: 7px;
  background: #fbefec;
  color: #8a453a;
  font-size: 13px;
}

.is-spinning {
  animation: admin-product-spin 0.8s linear infinite;
}

@keyframes admin-product-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- Responsif ---------- */
@media (max-width: 900px) {
  .admin-product-filters {
    margin-left: 0;
  }
}

@media (max-width: 780px) {
  .admin-product-toolbar {
    gap: 9px;
    padding: 12px;
  }

  .admin-product-search {
    flex-basis: 100%;
    max-width: none;
    height: 42px;
  }

  .admin-product-filter-toggle {
    display: inline-flex;
    flex: 1;
    height: 40px;
  }

  .admin-product-filters {
    display: none;
    width: 100%;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }

  .admin-product-filters.is-open {
    display: grid;
  }

  .admin-product-filter {
    min-width: 0;
  }

  .admin-product-filter__label {
    position: static;
    width: auto;
    height: auto;
    margin: 0 0 4px 2px;
    overflow: visible;
    clip: auto;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #8a9198;
  }

  .admin-product-filter select {
    width: 100%;
    max-width: none;
    height: 40px;
  }

  .admin-product-sort,
  .admin-product-reset {
    grid-column: 1 / -1;
  }

  .admin-product-reset {
    justify-content: center;
    height: 38px;
  }

  /* Sembunyikan tabel, tampilkan kartu */
  .admin-product-results :deep(.admin-table-wrap) {
    display: none;
  }

  .admin-product-cards {
    display: grid;
    gap: 10px;
    padding: 12px;
  }

  .admin-product-card {
    padding: 13px;
    border: 1px solid #e5e1d7;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 1px 2px #1b24300a;
  }

  .admin-product-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .admin-product-card__title {
    min-width: 0;
  }

  .admin-product-card__title strong {
    display: block;
    font-size: 13.5px;
    font-weight: 800;
    line-height: 1.35;
  }

  .admin-product-card__meta {
    display: block;
    margin-top: 3px;
    overflow-wrap: anywhere;
    color: #7a8289;
    font: 500 10.5px ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .admin-product-card__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 11px 0 0;
    padding: 10px 0;
    border-top: 1px dashed #ece7dc;
    border-bottom: 1px dashed #ece7dc;
  }

  .admin-product-card__stats div {
    min-width: 0;
  }

  .admin-product-card__stats dt {
    color: #8a9198;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .admin-product-card__stats dd {
    margin: 3px 0 0;
    overflow: hidden;
    color: #2c3742;
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .admin-product-card__stats .admin-stock small {
    font-weight: 700;
  }

  .admin-product-card__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 11px;
  }

  .admin-product-card__actions :deep(.admin-button) {
    width: 100%;
    height: 36px;
  }

  .admin-product-pagination {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px;
  }

  .admin-product-pagination > div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }

  .admin-product-pagination :deep(.admin-button) {
    width: 100%;
    padding: 0 9px;
  }
}

@media (max-width: 560px) {
  .admin-products-page :deep(.admin-page-header__actions) {
    width: 100%;
  }

  .admin-products-page :deep(.admin-page-header__actions .admin-button) {
    flex: 1;
  }
}
</style>

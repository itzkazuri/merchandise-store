<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Boxes, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, Trash2, X } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminDataTable from '@/components/ui/AdminDataTable.vue'
import AdminState from '@/components/ui/AdminState.vue'
import AdminProductForm from '@/components/admin/AdminProductForm.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { catalogApi } from '@/api/catalog'
import { adminApi } from '@/api/admin'
import type { CatalogProduct, Category } from '@/types/catalog'
import { ApiError } from '@/api/client'
import { hasAnyRole, useAuth } from '@/composables/useAuth'

interface ProductPage { items: CatalogProduct[]; total: number; page: number; size: number; pages: number; has_next: boolean; has_prev: boolean }

/* ---------- Kelas Tailwind yang dipakai berulang ---------- */
const tagCls = 'inline-flex items-center whitespace-nowrap rounded-full border-[1.5px] border-ink bg-banner-sun px-2 text-[10.5px] font-bold leading-5 text-ink'
const tagAltCls = 'inline-flex items-center whitespace-nowrap rounded-full border-[1.5px] border-ink bg-banner-sky px-2 text-[10.5px] font-bold leading-5 text-ink'
const statusBase = 'inline-block whitespace-nowrap rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-bold text-ink'
const resetBtnCls =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-ink bg-white px-3 py-1.5 font-body text-xs font-extrabold text-ink ' +
  'shadow-[2px_2px_0_#1B2430] transition-[transform,box-shadow,background-color] duration-100 hover:bg-banner-sun ' +
  'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
const rowActionCls = 'inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent px-0.5 py-1 font-body text-[11px] font-bold text-ink hover:underline'

function statusClass(value?: string) {
  const tone = value === 'active' ? 'bg-mint' : value === 'draft' ? 'bg-sun' : 'bg-soft'
  return `${statusBase} ${tone}`
}
function stockTone(value: number) {
  return value === 0 ? 'text-destructive font-bold' : value <= 5 ? 'text-[#87620d] font-bold' : 'text-muted-foreground'
}

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

const typeSelectOptions = [
  { value: '', label: 'Semua jenis' },
  { value: 'imported', label: 'Impor' },
  { value: 'handmade', label: 'Buatan tangan' },
]

const animeSelectOptions = computed(() => [
  { value: '', label: 'Semua anime' },
  ...animes.value.map((item) => ({ value: item.slug, label: item.name })),
])

const categorySelectOptions = computed(() => [
  { value: '', label: 'Semua kategori' },
  ...productCategories.value.map((item) => ({ value: item.slug, label: item.name })),
])

const statusSelectOptions = [
  { value: '', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Diarsipkan' },
]

const sortSelectOptions = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'price_asc', label: 'Harga terendah' },
  { value: 'price_desc', label: 'Harga tertinggi' },
  { value: 'best_seller', label: 'Terlaris' },
  { value: 'name', label: 'Nama A–Z' },
]

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
  <div class="max-sm:[&_.admin-page-header__actions]:w-full max-sm:[&_.admin-page-header__actions_.admin-button]:flex-1">
    <AdminPageHeader title="Produk" description="Kelola identitas katalog, harga, stok, status, dan gambar produk.">
      <AdminButton variant="primary" @click="createProduct"><Plus :size="16" /> Tambah produk</AdminButton>
    </AdminPageHeader>

    <div v-if="error && !loading" class="-mt-2.5 mb-4 rounded-xl border-2 border-ink bg-pinky px-3 py-2.5 text-sm font-bold text-ink" role="alert">{{ error }}</div>

    <section class="admin-panel overflow-hidden" aria-label="Katalog produk">
      <header class="admin-panel__header">
        <div>
          <h2 class="font-head text-base font-bold">Katalog produk</h2>
          <p class="mt-0.5 text-xs text-muted-foreground" aria-live="polite">{{ loading && !rows.length ? 'Memuat…' : showingRange }}</p>
        </div>
        <AdminButton variant="quiet" aria-label="Muat ulang katalog" :disabled="loading" @click="load(page)">
          <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
        </AdminButton>
      </header>

      <!-- Toolbar -->
      <form
        class="flex flex-wrap items-center gap-2 border-y-2 border-ink/10 bg-bg px-4 py-3.5 max-md:gap-2.5 max-md:p-3"
        role="search"
        @submit.prevent="runSearch"
      >
        <div class="flex h-[38px] max-w-[380px] flex-[1_1_260px] items-center gap-2 rounded-xl border-2 border-ink bg-white pr-1.5 pl-3 text-muted-foreground focus-within:bg-[#fffaf0] max-md:h-[42px] max-md:max-w-none max-md:basis-full">
          <Search :size="16" aria-hidden="true" class="shrink-0" />
          <label class="sr-only" for="admin-product-search">Cari nama, SKU, slug, atau deskripsi</label>
          <input
            id="admin-product-search"
            v-model="search"
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            placeholder="Cari nama, SKU, atau slug"
            class="h-full w-full min-w-0 flex-1 border-0 bg-transparent p-0 font-body text-sm text-ink outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            @input="scheduleSearch"
          />
          <button
            v-if="search"
            type="button"
            class="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-soft text-ink hover:bg-sun"
            aria-label="Hapus pencarian"
            @click="clearSearch"
          >
            <X :size="14" />
          </button>
        </div>

        <button
          type="button"
          class="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-ink px-3 font-body text-xs font-extrabold text-ink shadow-[2px_2px_0_#1B2430] md:hidden"
          :class="filtersOpen || activeFilterCount > 0 ? 'bg-banner-sun' : 'bg-white'"
          :aria-expanded="filtersOpen"
          aria-controls="admin-product-filters"
          @click="filtersOpen = !filtersOpen"
        >
          <SlidersHorizontal :size="15" /> Filter
          <span v-if="activeFilterCount" class="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ink px-1.5 text-[10px] font-extrabold text-white">{{ activeFilterCount }}</span>
        </button>

        <div
          id="admin-product-filters"
          class="items-center gap-2 md:flex lg:ml-auto"
          :class="filtersOpen ? 'max-md:grid max-md:w-full max-md:grid-cols-2 max-md:gap-2.5' : 'max-md:hidden'"
        >
          <div class="flex min-w-[130px] flex-col max-md:min-w-0">
            <span class="sr-only max-md:not-sr-only max-md:mb-1 max-md:ml-0.5 max-md:text-[11px] max-md:font-bold max-md:text-muted-foreground">Jenis</span>
            <AppSelect v-model="typeFilter" :options="typeSelectOptions" variant="admin" size="sm" aria-label="Filter jenis produk" @change="runSearch" />
          </div>
          <div class="flex min-w-[150px] flex-col max-md:min-w-0">
            <span class="sr-only max-md:not-sr-only max-md:mb-1 max-md:ml-0.5 max-md:text-[11px] max-md:font-bold max-md:text-muted-foreground">Anime</span>
            <AppSelect v-model="animeFilter" :options="animeSelectOptions" variant="admin" size="sm" searchable aria-label="Filter seri anime" @change="runSearch" />
          </div>
          <div class="flex min-w-[150px] flex-col max-md:min-w-0">
            <span class="sr-only max-md:not-sr-only max-md:mb-1 max-md:ml-0.5 max-md:text-[11px] max-md:font-bold max-md:text-muted-foreground">Jenis produk</span>
            <AppSelect v-model="categoryFilter" :options="categorySelectOptions" variant="admin" size="sm" searchable aria-label="Filter jenis produk" @change="runSearch" />
          </div>
          <div class="flex min-w-[130px] flex-col max-md:min-w-0">
            <span class="sr-only max-md:not-sr-only max-md:mb-1 max-md:ml-0.5 max-md:text-[11px] max-md:font-bold max-md:text-muted-foreground">Status</span>
            <AppSelect v-model="statusFilter" :options="statusSelectOptions" variant="admin" size="sm" aria-label="Filter status katalog" @change="runSearch" />
          </div>
          <div class="flex min-w-[140px] flex-col max-md:col-span-full max-md:min-w-0">
            <span class="sr-only max-md:not-sr-only max-md:mb-1 max-md:ml-0.5 max-md:text-[11px] max-md:font-bold max-md:text-muted-foreground">Urutkan</span>
            <AppSelect v-model="sort" :options="sortSelectOptions" variant="admin" size="sm" aria-label="Urutkan produk" @change="runSearch" />
          </div>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border-2 border-dashed border-ink/50 bg-transparent px-2.5 font-body text-xs font-extrabold text-ink hover:bg-banner-sun max-md:col-span-full max-md:justify-center"
            @click="resetFilters"
          >
            <RotateCcw :size="13" /> Reset
          </button>
        </div>
      </form>

      <!-- State -->
      <AdminState v-if="loading && !rows.length" kind="loading" message="Memuat produk…" />
      <AdminState v-else-if="error && !rows.length" kind="error" :message="error" @retry="load(page)" />
      <div v-else-if="!rows.length" class="flex min-h-48 flex-col items-center justify-center gap-1.5 px-[18px] py-6 text-center text-muted-foreground">
        <Boxes :size="22" />
        <strong class="font-head text-sm font-semibold text-ink">{{ hasActiveFilters ? 'Tidak ada produk yang cocok' : 'Belum ada produk' }}</strong>
        <span class="text-xs">{{ hasActiveFilters ? 'Coba kata kunci lain atau reset filter.' : 'Tambahkan produk pertama untuk mulai berjualan.' }}</span>
        <button v-if="hasActiveFilters" type="button" :class="[resetBtnCls, 'mt-2']" @click="resetFilters">
          <RotateCcw :size="13" /> Reset pencarian &amp; filter
        </button>
        <AdminButton v-else variant="secondary" class="mt-2!" @click="createProduct"><Plus :size="15" /> Tambah produk</AdminButton>
      </div>

      <template v-else>
        <div
          class="transition-opacity duration-150 max-md:[&_.admin-table-wrap]:hidden [&_.admin-table_td]:py-3 [&_.admin-table_th]:py-[11px] [&_.admin-table_th:last-child]:w-[116px]"
          :class="loading ? 'pointer-events-none opacity-55' : ''"
          :aria-busy="loading"
        >
          <AdminDataTable :columns="columns" :rows="rows" row-key="id">
            <template #name="{ row }">
              <span class="flex min-w-[195px] flex-col">
                <strong class="block max-w-60 truncate text-[13px]">{{ row.name }}</strong>
                <small class="mt-0.5 block max-w-[270px] truncate text-[11px] text-muted-foreground">{{ row.description || 'Belum ada deskripsi' }}</small>
                <small class="mt-0.5 block truncate text-[11px] text-muted-foreground">{{ row.slug || 'Slug dibuat otomatis' }}<i class="px-1.5 not-italic text-ink/40">·</i>{{ row.images?.length || 0 }} gambar</small>
              </span>
            </template>
            <template #sku="{ row }"><span class="font-mono text-xs text-ink/70">{{ row.sku || '—' }}</span></template>
            <template #product_type="{ row }"><span class="whitespace-nowrap text-xs text-ink/70">{{ typeLabel(row.product_type) }}</span></template>
            <template #taxonomy="{ row }">
              <span v-if="row.anime || row.category" class="inline-flex max-w-48 flex-wrap gap-1">
                <span v-if="row.anime" :class="tagCls">{{ row.anime.name }}</span>
                <span v-if="row.category" :class="tagAltCls">{{ row.category.name }}</span>
              </span>
              <span v-else class="admin-cell-sub">Belum diatur</span>
            </template>
            <template #price="{ row }"><span class="whitespace-nowrap text-xs tabular-nums">{{ price(row.price) }}</span></template>
            <template #stock="{ row }">
              <span class="inline-flex min-w-14 flex-col items-end leading-tight">
                <b class="text-[13px] tabular-nums">{{ Number(row.stock).toLocaleString('id-ID') }}</b>
                <small class="text-[10px]" :class="stockTone(row.stock)">{{ stockLabel(row.stock) }}</small>
              </span>
            </template>
            <template #sold_count="{ row }"><span class="whitespace-nowrap text-xs tabular-nums">{{ Number(row.sold_count || 0).toLocaleString('id-ID') }}</span></template>
            <template #status="{ row }">
              <span :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span>
              <small class="admin-cell-sub mt-1 text-[10px]">{{ updatedAt(row.updated_at) }}</small>
            </template>
            <template #actions="{ row }">
              <div class="flex items-center justify-end gap-2">
                <button type="button" :class="rowActionCls" @click="editProduct(row)"><Pencil :size="14" /><span>Edit</span></button>
                <button v-if="canDelete" type="button" :class="[rowActionCls, 'text-destructive']" @click="removeProduct(row)"><span>Hapus</span></button>
              </div>
            </template>
          </AdminDataTable>

          <!-- Kartu produk: hanya di layar kecil -->
          <div class="grid gap-3 p-3 md:hidden">
            <article
              v-for="product in rows"
              :key="product.id"
              class="rounded-2xl border-2 border-ink bg-white p-3.5 shadow-[3px_3px_0_#1B2430]"
            >
              <header class="flex items-start justify-between gap-2.5">
                <div class="min-w-0">
                  <strong class="block text-[13.5px] font-extrabold leading-snug">{{ product.name }}</strong>
                  <span class="mt-0.5 block break-words font-mono text-[10.5px] text-muted-foreground">{{ product.sku || 'Tanpa SKU' }} · {{ typeLabel(product.product_type) }}</span>
                  <span v-if="product.anime || product.category" class="mt-1.5 inline-flex flex-wrap gap-1">
                    <span v-if="product.anime" :class="tagCls">{{ product.anime.name }}</span>
                    <span v-if="product.category" :class="tagAltCls">{{ product.category.name }}</span>
                  </span>
                </div>
                <span :class="statusClass(product.status)">{{ statusLabel(product.status) }}</span>
              </header>

              <dl class="mt-3 grid grid-cols-3 gap-2 border-y-2 border-dashed border-ink/20 py-2.5">
                <div class="min-w-0">
                  <dt class="text-[11px] font-bold text-muted-foreground">Harga</dt>
                  <dd class="m-0 mt-0.5 truncate text-xs font-extrabold tabular-nums">{{ price(product.price) }}</dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-[11px] font-bold text-muted-foreground">Stok</dt>
                  <dd class="m-0 mt-0.5 text-xs font-extrabold tabular-nums">
                    <span class="inline-flex flex-col items-start leading-tight">
                      <b>{{ Number(product.stock).toLocaleString('id-ID') }}</b>
                      <small class="text-[10px] font-bold" :class="stockTone(product.stock)">{{ stockLabel(product.stock) }}</small>
                    </span>
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-[11px] font-bold text-muted-foreground">Terjual</dt>
                  <dd class="m-0 mt-0.5 truncate text-xs font-extrabold tabular-nums">{{ Number(product.sold_count || 0).toLocaleString('id-ID') }}</dd>
                </div>
              </dl>

              <footer class="mt-3 flex gap-2">
                <AdminButton variant="secondary" class="h-9! flex-1!" @click="editProduct(product)"><Pencil :size="14" /> Edit</AdminButton>
                <AdminButton v-if="canDelete" variant="secondary" class="h-9! flex-1!" @click="removeProduct(product)"><Trash2 :size="14" /> Hapus</AdminButton>
              </footer>
            </article>
          </div>
        </div>

        <footer
          v-if="pageInfo.pages > 1"
          class="flex items-center justify-between border-t-2 border-ink/10 px-4 py-3 text-xs text-muted-foreground max-md:flex-col max-md:items-stretch max-md:gap-2.5 max-md:p-3"
        >
          <span>Halaman {{ pageInfo.page }} dari {{ pageInfo.pages }}</span>
          <div class="flex gap-2 max-md:grid max-md:w-full max-md:grid-cols-2">
            <AdminButton variant="secondary" class="h-[33px]! text-xs! max-md:w-full! max-md:px-2!" :disabled="!pageInfo.has_prev || loading" @click="load(pageInfo.page - 1)"><ChevronLeft :size="15" /> Sebelumnya</AdminButton>
            <AdminButton variant="secondary" class="h-[33px]! text-xs! max-md:w-full! max-md:px-2!" :disabled="!pageInfo.has_next || loading" @click="load(pageInfo.page + 1)">Berikutnya <ChevronRight :size="15" /></AdminButton>
          </div>
        </footer>
      </template>
    </section>

    <AdminProductForm v-model="formOpen" :product="selectedProduct" @saved="load(page)" />
  </div>
</template>
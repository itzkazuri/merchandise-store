<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImagePlus, Loader2, RefreshCw, Trash2, Upload } from 'lucide-vue-next'
import AdminDialog from '@/components/ui/AdminDialog.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminState from '@/components/ui/AdminState.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
import { imageUrl, optimizedImageUrl } from '@/lib/productVisual'
import type { CatalogImage, CatalogProduct, Category } from '@/types/catalog'

interface ProductDraft { name: string; slug: string; sku: string; description: string; product_type: 'imported' | 'handmade'; price: string; stock: number; status: 'draft' | 'active' | 'archived'; anime_id: number | null; category_id: number | null }
interface ImageDraft { key: string; id?: number; object_key: string; url?: string; preview_url?: string; alt_text: string; is_primary: boolean; sort_order: number; existing: boolean; uploading?: boolean }

/* ---------- Kelas Tailwind yang dipakai berulang ---------- */
const inputCls =
  'h-10 w-full min-w-0 rounded-xl border-2 border-ink bg-white px-3 font-body text-sm text-ink ' +
  'placeholder:text-muted-foreground read-only:bg-muted read-only:text-muted-foreground focus:bg-[#fffaf0]'
const textareaCls =
  'w-full min-w-0 resize-y rounded-xl border-2 border-ink bg-white px-3 py-2 font-body text-sm leading-normal text-ink ' +
  'placeholder:text-muted-foreground focus:bg-[#fffaf0]'
const linkCls =
  'inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-body text-[11px] font-bold text-ink ' +
  'underline underline-offset-2 hover:text-ink/60 disabled:cursor-not-allowed disabled:opacity-45'
const gridCls = 'grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-3'
const sectionCls = 'grid gap-3.5 not-first:border-t-2 not-first:border-ink/10 not-first:pt-5'
const headTitleCls = 'm-0 font-head text-[15px] font-semibold tracking-tight'
const headDescCls = 'mt-1 mb-0 text-xs leading-normal text-muted-foreground'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'
const MAX_IMAGE_MB = 5

const props = defineProps<{ modelValue: boolean; product: CatalogProduct | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>()
const emptyProduct = (): ProductDraft => ({ name: '', slug: '', sku: '', description: '', product_type: 'imported', price: '', stock: 0, status: 'draft', anime_id: null, category_id: null })
const draft = ref<ProductDraft>(emptyProduct())
const images = ref<ImageDraft[]>([])
const removedImageIds = ref<number[]>([])
const busy = ref(false)
const error = ref('')
const isEditing = computed(() => Boolean(props.product))
const primaryImageKey = ref('')
const skuManual = ref(false)
const skuSuffix = ref('')
const animes = ref<Category[]>([])
const productCategories = ref<Category[]>([])
const categoriesLoading = ref(false)
const categoriesError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const replaceTargetKey = ref<string | null>(null)
const uploadingCount = ref(0)
const isUploading = computed(() => uploadingCount.value > 0)

const productTypeOptions: { value: 'imported' | 'handmade'; label: string }[] = [
  { value: 'imported', label: 'Produk impor' },
  { value: 'handmade', label: 'Buatan tangan' },
]

const animeOptions = computed(() => [
  { value: null as number | null, label: 'Belum diatur' },
  ...animes.value.map((item) => ({
    value: item.id,
    label: `${item.name}${item.is_active ? '' : ' (nonaktif)'}`,
  })),
])

const categoryOptions = computed(() => [
  { value: null as number | null, label: 'Belum diatur' },
  ...productCategories.value.map((item) => ({
    value: item.id,
    label: `${item.name}${item.is_active ? '' : ' (nonaktif)'}`,
  })),
])

const statusOptions: { value: 'draft' | 'active' | 'archived'; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Aktif' },
  { value: 'archived', label: 'Diarsipkan' },
]

async function loadCategories() {
  if (categoriesLoading.value) return
  categoriesLoading.value = true
  categoriesError.value = ''
  try {
    const data = await adminApi.categories({ include_inactive: true }) as Category[]
    const list = Array.isArray(data) ? data : []
    animes.value = list.filter((item) => item.kind === 'anime')
    productCategories.value = list.filter((item) => item.kind === 'product')
  } catch (cause) {
    categoriesError.value = cause instanceof ApiError ? cause.message : 'Kategori gagal dimuat.'
  } finally {
    categoriesLoading.value = false
  }
}

/* ---------- SKU otomatis ----------
   SKU wajib & unik di backend. Supaya tidak perlu mengetik,
   SKU dibentuk dari jenis produk + nama produk + 4 karakter acak.
   Begitu pengguna mengedit kolom SKU, mode otomatis berhenti. */
const SKU_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSuffix(length = 4) {
  return Array.from({ length }, () => SKU_CHARS[Math.floor(Math.random() * SKU_CHARS.length)]).join('')
}

function skuFromName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function generateSku() {
  const base = skuFromName(draft.value.name).slice(0, 70).replace(/-+$/, '') || 'PRODUK'
  const prefix = draft.value.product_type === 'handmade' ? 'HTM' : 'IMP'
  const suffix = skuSuffix.value || (skuSuffix.value = randomSuffix())
  draft.value.sku = `${prefix}-${base}-${suffix}`.slice(0, 100).replace(/-+$/, '')
}

function toggleSkuMode() {
  if (skuManual.value) {
    skuManual.value = false
    generateSku()
    return
  }
  skuSuffix.value = randomSuffix()
  generateSku()
}

watch(() => draft.value.name, () => { if (!skuManual.value) generateSku() })
watch(() => draft.value.product_type, () => { if (!skuManual.value) generateSku() })

function imageDraft(image: CatalogImage, index: number): ImageDraft {
  return { key: `existing-${image.id}`, id: image.id, object_key: image.object_key, url: image.url || undefined, alt_text: image.alt_text || '', is_primary: image.is_primary, sort_order: image.sort_order ?? index, existing: true }
}
function revokePreview(image?: ImageDraft | null) {
  if (image?.preview_url) URL.revokeObjectURL(image.preview_url)
}
function reset() {
  error.value = ''; removedImageIds.value = []; primaryImageKey.value = ''; replaceTargetKey.value = null; uploadingCount.value = 0
  images.value.forEach(revokePreview)
  const product = props.product
  draft.value = product ? {
    name: product.name, slug: product.slug || '', sku: product.sku || '', description: product.description || '',
    product_type: product.product_type || 'imported', price: String(product.price ?? ''), stock: product.stock ?? 0, status: product.status || 'draft',
    anime_id: product.anime_id ?? product.anime?.id ?? null,
    category_id: product.category_id ?? product.category?.id ?? null,
  } : emptyProduct()
  skuSuffix.value = randomSuffix()
  skuManual.value = Boolean(product)
  if (!product) generateSku()
  images.value = (product?.images || []).map(imageDraft)
  primaryImageKey.value = images.value.find((image) => image.is_primary)?.key || ''
}
watch(() => [props.modelValue, props.product] as const, ([open]) => { if (open) { reset(); void loadCategories() } })

/* ---------- Upload gambar ----------
   Admin memilih file langsung; file dikirim ke endpoint upload backend,
   lalu object key hasilnya disimpan bersama produk. Tidak ada input URL. */
function openFilePicker(targetKey: string | null = null) {
  if (isUploading.value) return
  replaceTargetKey.value = targetKey
  fileInput.value?.click()
}
function removeImage(index: number) {
  const [removed] = images.value.splice(index, 1)
  revokePreview(removed)
  if (removed?.id) removedImageIds.value.push(removed.id)
  if (primaryImageKey.value === removed?.key) primaryImageKey.value = images.value[0]?.key || ''
  images.value.forEach((image, order) => { image.sort_order = order })
}

async function uploadFile(file: File): Promise<string | null> {
  error.value = ''
  if (!file.type.startsWith('image/')) {
    error.value = `"${file.name}" bukan file gambar.`
    return null
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    error.value = `"${file.name}" terlalu besar. Maksimal ${MAX_IMAGE_MB} MB per gambar.`
    return null
  }

  const key = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const draftImage: ImageDraft = {
    key,
    object_key: '',
    preview_url: URL.createObjectURL(file),
    alt_text: draft.value.name || '',
    is_primary: false,
    sort_order: images.value.length,
    existing: false,
    uploading: true,
  }
  images.value.push(draftImage)
  uploadingCount.value += 1

  try {
    const uploaded = await adminApi.uploadProductImage(file)
    const target = images.value.find((image) => image.key === key)
    if (!target) return null
    revokePreview(target)
    target.preview_url = undefined
    target.object_key = uploaded.object_key
    target.url = uploaded.url
    target.uploading = false
    if (!primaryImageKey.value) primaryImageKey.value = key
    return key
  } catch (cause) {
    const index = images.value.findIndex((image) => image.key === key)
    if (index >= 0) removeImage(index)
    error.value = cause instanceof ApiError ? cause.message : `"${file.name}" gagal diunggah. Coba lagi.`
    return null
  } finally {
    uploadingCount.value = Math.max(0, uploadingCount.value - 1)
  }
}

async function handleFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  const replaceKey = replaceTargetKey.value
  input.value = ''
  replaceTargetKey.value = null
  if (!files.length) return

  let primaryMoved = false
  if (replaceKey) {
    const index = images.value.findIndex((image) => image.key === replaceKey)
    if (index >= 0) {
      primaryMoved = primaryImageKey.value === replaceKey
      removeImage(index)
    }
  }

  for (const file of files) {
    const key = await uploadFile(file)
    if (primaryMoved && key) {
      primaryImageKey.value = key
      primaryMoved = false
    }
  }
}

async function syncImages(productId: number, isNew: boolean) {
  const ids = new Map<string, number>()
  for (const image of images.value) if (image.id) ids.set(image.key, image.id)
  if (isNew) {
    for (const image of images.value) {
      const created = await adminApi.addProductImage(productId, { object_key: image.object_key.trim(), alt_text: image.alt_text.trim() || null, is_primary: false, sort_order: image.sort_order }) as { id?: number }
      if (created.id) ids.set(image.key, created.id)
    }
  } else {
    for (const id of removedImageIds.value) await adminApi.deleteProductImage(productId, id)
    for (const image of images.value.filter((item) => item.existing && item.id)) {
      await adminApi.updateProductImage(productId, image.id!, { alt_text: image.alt_text.trim() || null, is_primary: false, sort_order: image.sort_order })
    }
    for (const image of images.value.filter((item) => !item.existing)) {
      const created = await adminApi.addProductImage(productId, { object_key: image.object_key.trim(), alt_text: image.alt_text.trim() || null, is_primary: false, sort_order: image.sort_order }) as { id?: number }
      if (created.id) ids.set(image.key, created.id)
    }
  }

  const chosen = images.value.find((image) => image.key === primaryImageKey.value)
  if (!chosen) return
  const chosenId = ids.get(chosen.key)
  if (chosenId) await adminApi.updateProductImage(productId, chosenId, { is_primary: true })
}

async function submit() {
  error.value = ''
  if (!draft.value.sku.trim()) generateSku()
  if (!draft.value.sku.trim()) { error.value = 'SKU belum terisi. Isi nama produk atau tulis SKU manual.'; return }
  if (String(draft.value.price).trim() === '' || Number(draft.value.price) < 0) { error.value = 'Masukkan harga nol atau lebih.'; return }
  if (isUploading.value) { error.value = 'Tunggu proses upload gambar selesai.'; return }
  if (images.value.some((image) => !image.object_key.trim())) { error.value = 'Ada gambar yang belum selesai diunggah. Hapus lalu unggah ulang.'; return }
  busy.value = true
  try {
    const payload = { ...draft.value, slug: draft.value.slug.trim() || null, price: Number(draft.value.price), stock: Number(draft.value.stock) }
    let productId: number
    if (props.product) {
      await adminApi.updateProduct(props.product.id, payload)
      productId = props.product.id
      await syncImages(productId, false)
    } else {
      const created = await adminApi.createProduct({ ...payload, images: [] }) as { id: number }
      productId = created.id
      await syncImages(productId, true)
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch (cause) {
    if (cause instanceof ApiError && Array.isArray(cause.detail)) {
      error.value = cause.detail.map((item: { loc?: unknown[]; msg?: string }) => `${Array.isArray(item.loc) ? item.loc.slice(1).join('.') : 'Form'}: ${item.msg || 'nilai tidak valid'}`).join(' · ')
    } else error.value = cause instanceof ApiError ? cause.message : 'Produk tersimpan sebagian atau gagal disimpan. Muat ulang data sebelum mencoba kembali.'
  } finally { busy.value = false }
}
</script>

<template>
  <AdminDialog :model-value="modelValue" :title="isEditing ? 'Edit produk' : 'Tambah produk'" description="Lengkapi informasi katalog dan stok produk." @update:model-value="emit('update:modelValue', $event)">
    <form id="admin-product-form" class="grid gap-[22px]" @submit.prevent="submit">
      <!-- Informasi produk -->
      <section :class="sectionCls">
        <header>
          <h3 :class="headTitleCls">Informasi produk</h3>
          <p :class="headDescCls">Nama, SKU, jenis produk, dan deskripsi yang dilihat pelanggan.</p>
        </header>
        <div :class="gridCls">
          <label class="admin-field col-span-full">
            <span class="admin-field__label">Nama produk <b class="text-destructive" aria-hidden="true">*</b></span>
            <input v-model.trim="draft.name" name="name" required minlength="2" maxlength="255" autocomplete="off" placeholder="Contoh: Figur Gojo Satoru 30 cm" :class="inputCls" />
          </label>

          <div class="admin-field">
            <label class="admin-field__label" for="product-sku">
              SKU <b class="text-destructive" aria-hidden="true">*</b>
              <small class="font-medium text-muted-foreground">{{ skuManual ? 'manual' : 'otomatis' }}</small>
            </label>
            <input id="product-sku" v-model.trim="draft.sku" name="sku" required maxlength="100" autocomplete="off" placeholder="FIG-GOJO-30" :class="inputCls" @input="skuManual = true" />
            <span class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <button type="button" :class="linkCls" @click="toggleSkuMode"><RefreshCw :size="12" /> {{ skuManual ? 'Pakai SKU otomatis' : 'Acak ulang' }}</button>
              <small class="admin-field__hint mt-0!">{{ skuManual ? 'Kamu mengetik SKU sendiri.' : 'Dibuat dari nama produk.' }}</small>
            </span>
          </div>

          <label class="admin-field">
            <span class="admin-field__label">Slug <small class="font-medium text-muted-foreground">opsional</small></span>
            <input v-model.trim="draft.slug" name="slug" maxlength="255" autocomplete="off" placeholder="figur-gojo-satoru-30-cm" :class="inputCls" />
            <small class="admin-field__hint">Dibuat otomatis dari nama jika dikosongkan.</small>
          </label>

          <div class="admin-field">
            <span class="admin-field__label">Jenis produk <b class="text-destructive" aria-hidden="true">*</b></span>
            <AppSelect v-model="draft.product_type" :options="productTypeOptions" variant="admin" block />
          </div>

          <label class="admin-field col-span-full">
            <span class="admin-field__label">Deskripsi</span>
            <textarea v-model="draft.description" name="description" rows="4" placeholder="Bahan, ukuran, kondisi, atau detail yang perlu diketahui pembeli." :class="textareaCls" />
          </label>
        </div>
      </section>

      <!-- Klasifikasi -->
      <section :class="sectionCls">
        <header>
          <h3 :class="headTitleCls">Klasifikasi katalog</h3>
          <p :class="headDescCls">Pilih seri anime dan jenis barang agar produk mudah difilter pembeli.</p>
        </header>
        <div :class="gridCls">
          <div class="admin-field">
            <span class="admin-field__label">Seri anime</span>
            <AppSelect v-model="draft.anime_id" :options="animeOptions" :disabled="categoriesLoading" variant="admin" searchable block />
          </div>
          <div class="admin-field">
            <span class="admin-field__label">Jenis produk</span>
            <AppSelect v-model="draft.category_id" :options="categoryOptions" :disabled="categoriesLoading" variant="admin" searchable block />
          </div>
          <p class="admin-field__hint col-span-full -mt-1">
            {{ categoriesLoading ? 'Memuat daftar kategori…' : categoriesError || 'Daftar kategori dikelola di menu Kategori.' }}
          </p>
        </div>
      </section>

      <!-- Harga & stok -->
      <section :class="sectionCls">
        <header>
          <h3 :class="headTitleCls">Harga dan ketersediaan</h3>
          <p :class="headDescCls">Nilai disimpan sebagai rupiah dan jumlah stok berupa bilangan bulat.</p>
        </header>
        <div :class="gridCls">
          <label class="admin-field">
            <span class="admin-field__label">Harga (Rp) <b class="text-destructive" aria-hidden="true">*</b></span>
            <input v-model="draft.price" name="price" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="250000" :class="inputCls" />
          </label>
          <label class="admin-field">
            <span class="admin-field__label">Stok <b class="text-destructive" aria-hidden="true">*</b></span>
            <input v-model.number="draft.stock" name="stock" type="number" min="0" step="1" inputmode="numeric" required :class="inputCls" />
          </label>
          <div class="admin-field">
            <span class="admin-field__label">Status katalog <b class="text-destructive" aria-hidden="true">*</b></span>
            <AppSelect v-model="draft.status" :options="statusOptions" variant="admin" block />
          </div>
        </div>
      </section>

      <!-- Gambar -->
      <section :class="sectionCls">
        <header class="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <h3 :class="headTitleCls">Gambar produk</h3>
            <p :class="headDescCls">Unggah file JPG, PNG, WebP, GIF, atau AVIF. Maksimal {{ MAX_IMAGE_MB }} MB per gambar.</p>
          </div>
          <AdminButton type="button" variant="secondary" :disabled="isUploading" @click="openFilePicker()">
            <Upload :size="15" /> Unggah gambar
          </AdminButton>
        </header>

        <input ref="fileInput" type="file" class="hidden" :accept="IMAGE_ACCEPT" multiple @change="handleFileInput" />

        <div v-if="images.length" class="grid gap-2.5">
          <div
            v-for="(image, index) in images"
            :key="image.key"
            class="grid grid-cols-[24px_minmax(0,1fr)_30px] items-start gap-2 rounded-xl border-2 border-ink bg-white p-2.5 sm:grid-cols-[28px_minmax(0,1fr)_34px] sm:gap-3 sm:p-3"
          >
            <div class="mt-px grid size-6 place-items-center rounded-lg border-2 border-ink bg-sun font-body text-[11px] font-bold sm:size-7" aria-hidden="true">
              {{ String(index + 1).padStart(2, '0') }}
            </div>

            <div class="grid min-w-0 gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <div class="relative col-span-full aspect-[4/3] w-full max-w-60 overflow-hidden rounded-xl border-2 border-ink bg-bg">
                <img
                  v-if="image.preview_url || image.url || imageUrl(image.object_key)"
                  :src="optimizedImageUrl(image.preview_url || image.url || imageUrl(image.object_key), 320) || undefined"
                  :alt="image.alt_text || draft.name || 'Pratinjau gambar produk'"
                  width="320"
                  height="320"
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                  sizes="240px"
                  class="block size-full object-contain"
                />
                <div v-else class="grid size-full place-items-center content-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                  <ImagePlus :size="22" />
                  <span>Belum ada file</span>
                </div>
                <span v-if="image.uploading" class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-ink/85 p-1.5 text-[11px] font-bold text-white">
                  <Loader2 :size="16" class="animate-spin" /> Mengunggah…
                </span>
              </div>

              <label class="admin-field">
                <span class="admin-field__label">Teks alternatif</span>
                <input v-model.trim="image.alt_text" :name="`image-${index}-alt`" maxlength="255" placeholder="Figur Gojo Satoru tampak depan" :class="inputCls" />
              </label>

              <div class="flex flex-wrap items-center justify-between gap-2.5 self-end">
                <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink sm:min-h-10">
                  <input v-model="primaryImageKey" type="radio" name="primary-image" :value="image.key" class="accent-ink" />
                  <span>Gambar utama</span>
                </label>
                <button type="button" :class="linkCls" :disabled="image.uploading || isUploading" @click="openFilePicker(image.key)">
                  <RefreshCw :size="12" /> Ganti file
                </button>
              </div>
            </div>

            <button
              type="button"
              class="mt-px grid size-[30px] cursor-pointer place-items-center rounded-lg border-2 border-ink bg-white text-destructive shadow-[2px_2px_0_#1B2430] transition-[transform,box-shadow,background-color] duration-100 hover:bg-pinky active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:size-[34px]"
              :aria-label="`Hapus gambar ${index + 1}`"
              @click="removeImage(index)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
        <p v-else class="m-0 rounded-xl border-2 border-dashed border-ink/40 p-3.5 text-xs leading-normal text-muted-foreground">
          Belum ada gambar. Unggah minimal satu gambar agar produk punya visual di katalog.
        </p>
      </section>

      <AdminState v-if="error" kind="error" :message="error" />
    </form>

    <template #footer>
      <AdminButton variant="secondary" :disabled="busy" @click="emit('update:modelValue', false)">Batal</AdminButton>
      <AdminButton type="submit" variant="primary" :disabled="busy || isUploading" form="admin-product-form">{{ busy ? 'Menyimpan…' : isUploading ? 'Menunggu upload…' : isEditing ? 'Simpan perubahan' : 'Buat produk' }}</AdminButton>
    </template>
  </AdminDialog>
</template>
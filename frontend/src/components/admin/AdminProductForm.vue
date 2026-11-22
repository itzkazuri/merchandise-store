<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ImagePlus, Loader2, RefreshCw, Trash2, Upload } from 'lucide-vue-next'
import AdminDialog from '@/components/ui/AdminDialog.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminState from '@/components/ui/AdminState.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
import { imageUrl, optimizedImageUrl } from '@/lib/productVisual'
import type { CatalogImage, CatalogProduct, Category } from '@/types/catalog'

interface ProductDraft { name: string; slug: string; sku: string; description: string; product_type: 'imported' | 'handmade'; price: string; stock: number; status: 'draft' | 'active' | 'archived'; anime_id: number | null; category_id: number | null }
interface ImageDraft { key: string; id?: number; object_key: string; url?: string; preview_url?: string; alt_text: string; is_primary: boolean; sort_order: number; existing: boolean; uploading?: boolean }

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
    <form id="admin-product-form" class="product-form" @submit.prevent="submit">
      <section class="product-form__section">
        <header class="product-form__head">
          <h3>Informasi produk</h3>
          <p>Nama, SKU, jenis produk, dan deskripsi yang dilihat pelanggan.</p>
        </header>
        <div class="product-form__grid">
          <label class="admin-field product-form__full">
            <span>Nama produk <b aria-hidden="true">*</b></span>
            <input v-model.trim="draft.name" name="name" required minlength="2" maxlength="255" autocomplete="off" placeholder="Contoh: Figur Gojo Satoru 30 cm" />
          </label>
          <div class="admin-field">
            <label class="admin-field__label" for="product-sku">SKU <b aria-hidden="true">*</b> <small>{{ skuManual ? 'manual' : 'otomatis' }}</small></label>
            <input id="product-sku" v-model.trim="draft.sku" name="sku" required maxlength="100" autocomplete="off" placeholder="FIG-GOJO-30" @input="skuManual = true" />
            <span class="admin-field__tools">
              <button type="button" class="admin-field__link" @click="toggleSkuMode"><RefreshCw :size="12" /> {{ skuManual ? 'Pakai SKU otomatis' : 'Acak ulang' }}</button>
              <small class="admin-field__hint">{{ skuManual ? 'Kamu mengetik SKU sendiri.' : 'Dibuat dari nama produk.' }}</small>
            </span>
          </div>
          <label class="admin-field">
            <span>Slug <small>opsional</small></span>
            <input v-model.trim="draft.slug" name="slug" maxlength="255" autocomplete="off" placeholder="figur-gojo-satoru-30-cm" />
            <small class="admin-field__hint">Dibuat otomatis dari nama jika dikosongkan.</small>
          </label>
          <label class="admin-field">
            <span>Jenis produk <b aria-hidden="true">*</b></span>
            <select v-model="draft.product_type" name="product_type" required>
              <option value="imported">Produk impor</option>
              <option value="handmade">Buatan tangan</option>
            </select>
          </label>
          <label class="admin-field product-form__full">
            <span>Deskripsi</span>
            <textarea v-model="draft.description" name="description" rows="4" placeholder="Bahan, ukuran, kondisi, atau detail yang perlu diketahui pembeli." />
          </label>
        </div>
      </section>

      <section class="product-form__section">
        <header class="product-form__head">
          <h3>Klasifikasi katalog</h3>
          <p>Pilih seri anime dan jenis barang agar produk mudah difilter pembeli.</p>
        </header>
        <div class="product-form__grid">
          <label class="admin-field">
            <span>Seri anime</span>
            <select v-model="draft.anime_id" name="anime_id" :disabled="categoriesLoading">
              <option :value="null">Belum diatur</option>
              <option v-for="item in animes" :key="item.id" :value="item.id">
                {{ item.name }}{{ item.is_active ? '' : ' (nonaktif)' }}
              </option>
            </select>
          </label>
          <label class="admin-field">
            <span>Jenis produk</span>
            <select v-model="draft.category_id" name="category_id" :disabled="categoriesLoading">
              <option :value="null">Belum diatur</option>
              <option v-for="item in productCategories" :key="item.id" :value="item.id">
                {{ item.name }}{{ item.is_active ? '' : ' (nonaktif)' }}
              </option>
            </select>
          </label>
          <p class="admin-field__hint product-form__classification-hint">
            {{ categoriesLoading ? 'Memuat daftar kategori…' : categoriesError || 'Daftar kategori dikelola di menu Kategori.' }}
          </p>
        </div>
      </section>

      <section class="product-form__section">
        <header class="product-form__head">
          <h3>Harga dan ketersediaan</h3>
          <p>Nilai disimpan sebagai rupiah dan jumlah stok berupa bilangan bulat.</p>
        </header>
        <div class="product-form__grid">
          <label class="admin-field">
            <span>Harga (Rp) <b aria-hidden="true">*</b></span>
            <input v-model="draft.price" name="price" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="250000" />
          </label>
          <label class="admin-field">
            <span>Stok <b aria-hidden="true">*</b></span>
            <input v-model.number="draft.stock" name="stock" type="number" min="0" step="1" inputmode="numeric" required />
          </label>
          <label class="admin-field">
            <span>Status katalog <b aria-hidden="true">*</b></span>
            <select v-model="draft.status" name="status" required>
              <option value="draft">Draft</option>
              <option value="active">Aktif</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </label>
        </div>
      </section>

      <section class="product-form__section">
        <header class="product-form__head product-form__head--row">
          <div>
            <h3>Gambar produk</h3>
            <p>Unggah file JPG, PNG, WebP, GIF, atau AVIF. Maksimal {{ MAX_IMAGE_MB }} MB per gambar.</p>
          </div>
          <AdminButton type="button" variant="secondary" :disabled="isUploading" @click="openFilePicker()">
            <Upload :size="15" /> Unggah gambar
          </AdminButton>
        </header>

        <input
          ref="fileInput"
          type="file"
          class="product-form__file-input"
          :accept="IMAGE_ACCEPT"
          multiple
          @change="handleFileInput"
        />

        <div v-if="images.length" class="product-form__images">
          <div v-for="(image, index) in images" :key="image.key" class="product-image-row">
            <div class="product-image-row__mark" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</div>
            <div class="product-image-row__fields">
              <div class="product-image-preview">
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
                />
                <div v-else class="product-image-preview__placeholder">
                  <ImagePlus :size="22" />
                  <span>Belum ada file</span>
                </div>
                <span v-if="image.uploading" class="product-image-preview__loading">
                  <Loader2 :size="16" class="product-image-preview__spin" /> Mengunggah…
                </span>
              </div>

              <label class="admin-field">
                <span>Teks alternatif</span>
                <input v-model.trim="image.alt_text" :name="`image-${index}-alt`" maxlength="255" placeholder="Figur Gojo Satoru tampak depan" />
              </label>

              <div class="product-image-row__side">
                <label class="product-image-primary">
                  <input v-model="primaryImageKey" type="radio" name="primary-image" :value="image.key" />
                  <span>Gambar utama</span>
                </label>
                <button
                  type="button"
                  class="admin-field__link"
                  :disabled="image.uploading || isUploading"
                  @click="openFilePicker(image.key)"
                >
                  <RefreshCw :size="12" /> Ganti file
                </button>
              </div>
            </div>
            <button type="button" class="admin-icon-button product-image-row__remove" :aria-label="`Hapus gambar ${index + 1}`" @click="removeImage(index)"><Trash2 :size="16" /></button>
          </div>
        </div>
        <p v-else class="product-form__empty-images">Belum ada gambar. Unggah minimal satu gambar agar produk punya visual di katalog.</p>
      </section>

      <AdminState v-if="error" kind="error" :message="error" />
    </form>
    <template #footer>
      <AdminButton variant="secondary" :disabled="busy" @click="emit('update:modelValue', false)">Batal</AdminButton>
      <AdminButton type="submit" variant="primary" :disabled="busy || isUploading" form="admin-product-form">{{ busy ? 'Menyimpan…' : isUploading ? 'Menunggu upload…' : isEditing ? 'Simpan perubahan' : 'Buat produk' }}</AdminButton>
    </template>
  </AdminDialog>
</template>

<style scoped>
/* ---------- Kerangka form ---------- */
.product-form {
  display: grid;
  gap: 22px;
}

.product-form__section {
  display: grid;
  gap: 13px;
}

.product-form__section + .product-form__section {
  padding-top: 20px;
  border-top: 1px solid #e8e5dd;
}

.product-form__head h3 {
  margin: 0;
  font: 600 15px var(--font-head);
  letter-spacing: -0.01em;
}

.product-form__head p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #68717b;
}

.product-form__head--row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

/* ---------- Grid ---------- */
.product-form__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 16px;
}

.product-form__full {
  grid-column: 1 / -1;
}

.product-form__classification-hint {
  grid-column: 1 / -1;
  margin-top: -4px;
}

/* ---------- Field ---------- */
.admin-field {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: #3f4954;
}

.admin-field > span,
.admin-field__label {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-height: 15px;
}

.admin-field > span b,
.admin-field__label b {
  color: #a33b2b;
}

.admin-field > span small,
.admin-field__label small {
  font-size: 11px;
  font-weight: 500;
  color: #828a93;
}

.admin-field__hint {
  margin-top: -2px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  color: #828a93;
}

.admin-field__tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px 9px;
  margin-top: -1px;
}

.admin-field__tools .admin-field__hint {
  margin-top: 0;
}

.admin-field__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: #8a5b00;
  font: 700 11px var(--font-body);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.admin-field__link:hover {
  color: #5d3c00;
}

.admin-field input,
.admin-field select,
.admin-field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid #d8d4ca;
  border-radius: 7px;
  background: #fff;
  color: #1b2430;
  font: 400 13px var(--font-body);
  padding: 0 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.admin-field input,
.admin-field select {
  height: 40px;
}

.admin-field textarea {
  padding: 9px 10px;
  line-height: 1.5;
  resize: vertical;
}

.admin-field input::placeholder,
.admin-field textarea::placeholder {
  color: #9aa1a9;
}

.admin-field input:focus-visible,
.admin-field select:focus-visible,
.admin-field textarea:focus-visible {
  outline: none;
  border-color: #d9b04a;
  box-shadow: 0 0 0 3px #f6e6b3;
}

.admin-field input[readonly] {
  background: #f6f4ef;
  color: #69727b;
}

/* ---------- Gambar ---------- */
.product-form__file-input {
  display: none;
}

.product-form__images {
  display: grid;
  gap: 10px;
}

.product-image-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 34px;
  gap: 12px;
  align-items: start;
  padding: 12px;
  border: 1px solid #e5e1d7;
  border-radius: 8px;
  background: #fff;
}

.product-image-row__mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 1px;
  border-radius: 7px;
  background: #f3efe5;
  color: #70664f;
  font: 700 11px var(--font-body);
}

.product-image-row__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  min-width: 0;
}

.product-image-row__full,
.product-image-key-note {
  grid-column: 1 / -1;
}

.product-image-preview {
  grid-column: 1 / -1;
  position: relative;
  width: min(100%, 240px);
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: 1px solid #dedbd3;
  border-radius: 8px;
  background: #f6f3ec;
}

.product-image-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.product-image-preview__placeholder {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  color: #9a917e;
  font-size: 11px;
  font-weight: 600;
}

.product-image-preview__loading {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px;
  background: rgb(27 36 48 / 82%);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.product-image-preview__spin {
  animation: product-image-spin 0.9s linear infinite;
}

@keyframes product-image-spin {
  to {
    transform: rotate(360deg);
  }
}

.product-image-row__side {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  align-self: end;
}

.product-image-row__side .admin-field__link:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.product-image-key-note {
  margin: -4px 0 0;
  font-size: 10px;
  line-height: 1.45;
  color: #747c85;
}

.product-image-primary {
  display: flex;
  align-items: center;
  gap: 7px;
  align-self: end;
  min-height: 40px;
  font-size: 12px;
  color: #505963;
  cursor: pointer;
}

.product-image-primary input {
  accent-color: #9b6d00;
}

.product-image-row__remove {
  margin-top: 1px;
  color: #8b5449;
}

.product-form__empty-images {
  margin: 0;
  padding: 14px;
  border: 1px dashed #d8d4ca;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #68717b;
}

/* ---------- Responsif ---------- */
@media (max-width: 680px) {
  .product-form__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .product-form__head--row {
    flex-direction: column;
  }

  .product-image-row {
    grid-template-columns: 24px minmax(0, 1fr) 30px;
    gap: 8px;
    padding: 9px;
  }

  .product-image-row__mark {
    width: 24px;
    height: 24px;
  }

  .product-image-row__fields {
    grid-template-columns: minmax(0, 1fr);
  }

  .product-image-row__full,
  .product-image-key-note {
    grid-column: auto;
  }

  .product-image-primary {
    min-height: 0;
  }
}
</style>

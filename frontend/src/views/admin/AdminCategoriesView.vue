<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-vue-next'
import AdminPageHeader from '@/components/ui/AdminPageHeader.vue'
import AdminButton from '@/components/ui/AdminButton.vue'
import AdminDialog from '@/components/ui/AdminDialog.vue'
import AdminState from '@/components/ui/AdminState.vue'
import { adminApi } from '@/api/admin'
import { ApiError } from '@/api/client'
import type { Category } from '@/types/catalog'
import { hasAnyRole, useAuth } from '@/composables/useAuth'

type Kind = 'anime' | 'product'
interface CategoryForm { name: string; slug: string; description: string; is_active: boolean; sort_order: number }

const { user } = useAuth()
const canDelete = computed(() => hasAnyRole(user.value, ['admin']))
const items = ref<Category[]>([])
const loading = ref(true)
const busyId = ref<number | null>(null)
const error = ref('')
const notice = ref('')
const activeKind = ref<Kind>('anime')

const dialogOpen = ref(false)
const editing = ref<Category | null>(null)
const form = ref<CategoryForm>({ name: '', slug: '', description: '', is_active: true, sort_order: 0 })
const formBusy = ref(false)
const formError = ref('')

const tabs: { kind: Kind; label: string; hint: string }[] = [
  { kind: 'anime', label: 'Anime', hint: 'Seri asal produk' },
  { kind: 'product', label: 'Jenis produk', hint: 'Bentuk barang' },
]

const animeCount = computed(() => items.value.filter((item) => item.kind === 'anime').length)
const productCount = computed(() => items.value.filter((item) => item.kind === 'product').length)
const visible = computed(() => items.value.filter((item) => item.kind === activeKind.value))
const activeTab = computed(() => tabs.find((tab) => tab.kind === activeKind.value) ?? { kind: 'anime' as Kind, label: 'Anime', hint: 'Seri asal produk' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await adminApi.categories({ include_inactive: true }) as Category[]
    items.value = Array.isArray(data) ? data : []
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Kategori gagal dimuat.'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', slug: '', description: '', is_active: true, sort_order: visible.value.length }
  formError.value = ''
  dialogOpen.value = true
}

function openEdit(item: Category) {
  editing.value = item
  form.value = {
    name: item.name,
    slug: item.slug,
    description: item.description || '',
    is_active: item.is_active,
    sort_order: item.sort_order ?? 0,
  }
  formError.value = ''
  dialogOpen.value = true
}

async function submit() {
  formError.value = ''
  const name = form.value.name.trim()
  if (!name) { formError.value = 'Nama kategori wajib diisi.'; return }
  formBusy.value = true
  try {
    const payload = {
      name,
      slug: form.value.slug.trim() || null,
      description: form.value.description.trim() || null,
      is_active: form.value.is_active,
      sort_order: Number(form.value.sort_order) || 0,
    }
    if (editing.value) await adminApi.updateCategory(editing.value.id, payload)
    else await adminApi.createCategory({ ...payload, kind: activeKind.value })
    dialogOpen.value = false
    notice.value = editing.value ? 'Kategori diperbarui.' : 'Kategori ditambahkan.'
    await load()
  } catch (cause) {
    formError.value = cause instanceof ApiError ? cause.message : 'Kategori gagal disimpan.'
  } finally {
    formBusy.value = false
  }
}

async function remove(item: Category) {
  if (!canDelete.value) return
  if (!window.confirm(`Hapus kategori “${item.name}”?`)) return
  busyId.value = item.id
  error.value = ''
  notice.value = ''
  try {
    await adminApi.deleteCategory(item.id)
    notice.value = `Kategori “${item.name}” dihapus.`
    await load()
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : 'Kategori gagal dihapus.'
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="admin-categories-page">
    <AdminPageHeader title="Kategori" description="Kelola seri anime dan jenis produk yang dipakai untuk mengelompokkan katalog.">
      <AdminButton variant="primary" @click="openCreate"><Plus :size="16" /> Tambah {{ activeTab.label.toLowerCase() }}</AdminButton>
    </AdminPageHeader>

    <div v-if="error" class="admin-categories-alert" role="alert">{{ error }}</div>
    <div v-else-if="notice" class="admin-categories-alert admin-categories-alert--ok" role="status">{{ notice }}</div>

    <section class="admin-panel admin-categories-panel" aria-label="Daftar kategori">
      <div class="admin-category-tabs" role="tablist" aria-label="Jenis kategori">
        <button
          v-for="tab in tabs"
          :key="tab.kind"
          type="button"
          role="tab"
          class="admin-category-tab"
          :class="{ 'is-active': activeKind === tab.kind }"
          :aria-selected="activeKind === tab.kind"
          @click="activeKind = tab.kind"
        >
          <strong>{{ tab.label }}</strong>
          <span>{{ tab.kind === 'anime' ? animeCount : productCount }}</span>
          <small>{{ tab.hint }}</small>
        </button>
      </div>

      <AdminState v-if="loading" kind="loading" message="Memuat kategori…" />
      <div v-else-if="!visible.length" class="admin-categories-empty">
        <Tags :size="22" />
        <strong>Belum ada {{ activeTab.label.toLowerCase() }}</strong>
        <span>Tambahkan kategori agar produk bisa difilter dengan rapi.</span>
        <AdminButton variant="secondary" @click="openCreate"><Plus :size="15" /> Tambah {{ activeTab.label.toLowerCase() }}</AdminButton>
      </div>

      <ul v-else class="admin-category-list">
        <li v-for="item in visible" :key="item.id" class="admin-category-row" :class="{ 'is-inactive': !item.is_active }">
          <div class="admin-category-row__main">
            <strong>{{ item.name }}</strong>
            <code>{{ item.slug }}</code>
            <p v-if="item.description">{{ item.description }}</p>
          </div>
          <div class="admin-category-row__meta">
            <span class="admin-category-count">{{ item.product_count || 0 }} produk</span>
            <span class="admin-category-status" :data-active="item.is_active">{{ item.is_active ? 'Aktif' : 'Nonaktif' }}</span>
          </div>
          <div class="admin-category-row__actions">
            <button type="button" class="admin-category-action" @click="openEdit(item)"><Pencil :size="14" /> Edit</button>
            <button
              v-if="canDelete"
              type="button"
              class="admin-category-action admin-category-action--danger"
              :disabled="busyId === item.id"
              @click="remove(item)"
            >
              <Trash2 :size="14" /> Hapus
            </button>
          </div>
        </li>
      </ul>
    </section>

    <AdminDialog
      v-model="dialogOpen"
      :title="editing ? 'Edit kategori' : `Tambah ${activeTab.label.toLowerCase()}`"
      :description="editing ? 'Perubahan langsung dipakai pada filter katalog.' : `Kategori baru akan masuk ke kelompok ${activeTab.label.toLowerCase()}.`"
    >
      <form id="admin-category-form" class="admin-category-form" @submit.prevent="submit">
        <label class="admin-field">
          <span>Nama <b aria-hidden="true">*</b></span>
          <input v-model="form.name" name="name" required maxlength="120" autocomplete="off" :placeholder="activeKind === 'anime' ? 'Contoh: Jujutsu Kaisen' : 'Contoh: Gantungan kunci'" />
        </label>
        <label class="admin-field">
          <span>Slug <small>opsional</small></span>
          <input v-model="form.slug" name="slug" maxlength="140" autocomplete="off" placeholder="dibuat-otomatis-dari-nama" />
          <small class="admin-field__hint">Dipakai di URL filter, misalnya ?anime=jujutsu-kaisen.</small>
        </label>
        <label class="admin-field">
          <span>Deskripsi <small>opsional</small></span>
          <input v-model="form.description" name="description" maxlength="255" autocomplete="off" placeholder="Catatan singkat kategori" />
        </label>
        <label class="admin-field">
          <span>Urutan tampil</span>
          <input v-model.number="form.sort_order" name="sort_order" type="number" min="0" step="1" inputmode="numeric" />
        </label>
        <label class="admin-category-active">
          <input v-model="form.is_active" type="checkbox" />
          <span>Tampilkan di filter toko</span>
        </label>
        <AdminState v-if="formError" kind="error" :message="formError" />
      </form>
      <template #footer>
        <AdminButton variant="secondary" :disabled="formBusy" @click="dialogOpen = false">Batal</AdminButton>
        <AdminButton type="submit" variant="primary" :disabled="formBusy" form="admin-category-form">{{ formBusy ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah kategori' }}</AdminButton>
      </template>
    </AdminDialog>
  </div>
</template>

<style scoped>
.admin-categories-panel {
  overflow: hidden;
}

.admin-categories-alert {
  margin-bottom: 14px;
  padding: 10px 13px;
  border: 1px solid #e4c3bc;
  border-radius: 8px;
  background: #fbefec;
  color: #8a453a;
  font-size: 12.5px;
  font-weight: 600;
}

.admin-categories-alert--ok {
  border-color: #c6ddc9;
  background: #eef5ef;
  color: #2f5b38;
}

/* ---------- Tab ---------- */
.admin-category-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 13px 16px;
  border-bottom: 1px solid #e8e5dd;
  background: #fdfcf8;
}

.admin-category-tab {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-content: start;
  column-gap: 8px;
  row-gap: 1px;
  padding: 9px 12px;
  border: 1px solid #ddd9ce;
  border-radius: 9px;
  background: #fff;
  color: #4e5863;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.admin-category-tab strong {
  font: 700 13px var(--font-body);
}

.admin-category-tab span {
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 19px;
  padding: 0 6px;
  border-radius: 999px;
  background: #efece4;
  color: #5f6770;
  font-size: 10.5px;
  font-weight: 800;
}

.admin-category-tab small {
  grid-column: 1 / -1;
  color: #828a93;
  font-size: 10.5px;
}

.admin-category-tab:hover {
  border-color: #d3c19a;
}

.admin-category-tab.is-active {
  border-color: #d9b04a;
  background: #fff8e4;
  box-shadow: inset 0 0 0 1px #f0d692;
}

.admin-category-tab.is-active strong {
  color: #5d4200;
}

.admin-category-tab.is-active span {
  background: #1b2430;
  color: #fff;
}

/* ---------- Daftar ---------- */
.admin-category-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin-category-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eeeae0;
}

.admin-category-row:last-child {
  border-bottom: 0;
}

.admin-category-row.is-inactive {
  background: #fbfaf6;
}

.admin-category-row__main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.admin-category-row__main strong {
  font: 700 13.5px var(--font-body);
}

.admin-category-row__main code {
  overflow: hidden;
  color: #828a93;
  font: 500 11px ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.admin-category-row__main p {
  margin: 2px 0 0;
  color: #68717b;
  font-size: 11.5px;
  line-height: 1.5;
}

.admin-category-row__meta {
  display: flex;
  align-items: center;
  gap: 7px;
}

.admin-category-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3efe5;
  color: #6d6450;
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
}

.admin-category-status {
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef5ef;
  color: #2f5b38;
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
}

.admin-category-status[data-active='false'] {
  background: #f2eee8;
  color: #7b7368;
}

.admin-category-row__actions {
  display: flex;
  gap: 6px;
}

.admin-category-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #ddd9ce;
  border-radius: 7px;
  background: #fff;
  color: #3f4852;
  font: 700 11.5px var(--font-body);
  cursor: pointer;
}

.admin-category-action:hover {
  background: #f6f3ea;
}

.admin-category-action--danger {
  border-color: #e3d9d5;
  color: #8b5449;
}

.admin-category-action--danger:hover {
  background: #fbf1ee;
}

.admin-category-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-categories-empty {
  display: grid;
  justify-items: center;
  gap: 7px;
  padding: 40px 20px;
  color: #68717b;
  text-align: center;
}

.admin-categories-empty strong {
  color: #1b2430;
  font: 600 15px var(--font-head);
}

.admin-categories-empty span {
  max-width: 34ch;
  font-size: 12.5px;
  line-height: 1.55;
}

/* ---------- Form ---------- */
.admin-category-form {
  display: grid;
  gap: 14px;
}

.admin-field {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
  color: #3f4954;
  font-size: 12px;
  font-weight: 700;
}

.admin-field > span {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-height: 15px;
}

.admin-field > span b {
  color: #a33b2b;
}

.admin-field > span small {
  color: #828a93;
  font-size: 11px;
  font-weight: 500;
}

.admin-field input:not([type='checkbox']) {
  width: 100%;
  height: 40px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid #d8d4ca;
  border-radius: 7px;
  background: #fff;
  color: #1b2430;
  font: 400 13px var(--font-body);
}

.admin-field input:focus-visible {
  outline: none;
  border-color: #d9b04a;
  box-shadow: 0 0 0 3px #f6e6b3;
}

.admin-field__hint {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  color: #828a93;
}

.admin-category-active {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #505963;
  cursor: pointer;
}

.admin-category-active input {
  accent-color: #9b6d00;
}

@media (max-width: 720px) {
  .admin-category-tabs {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-category-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .admin-category-row__meta {
    justify-content: flex-end;
  }

  .admin-category-row__actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>

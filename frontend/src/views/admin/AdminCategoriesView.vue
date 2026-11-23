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

/* ---------- Kelas Tailwind yang dipakai berulang ---------- */
const inputCls =
  'h-10 w-full min-w-0 rounded-xl border-2 border-ink bg-white px-3 font-body text-sm text-ink ' +
  'placeholder:text-muted-foreground focus:bg-[#fffaf0]'
const tabBase =
  'grid cursor-pointer grid-cols-[auto_auto] items-center justify-start gap-x-2 gap-y-px rounded-xl border-2 border-ink px-3 py-2.5 text-left text-ink ' +
  'shadow-[2px_2px_0_#1B2430] transition-[transform,box-shadow,background-color] duration-100 ' +
  'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
const actionBase =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-ink bg-white px-2.5 font-body text-xs font-extrabold ' +
  'shadow-[2px_2px_0_#1B2430] transition-[transform,box-shadow,background-color] duration-100 ' +
  'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50'
const pillBase = 'whitespace-nowrap rounded-full border-[1.5px] border-ink px-2 text-[11px] font-bold leading-5 text-ink'

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
  <div>
    <AdminPageHeader title="Kategori" description="Kelola seri anime dan jenis produk yang dipakai untuk mengelompokkan katalog.">
      <AdminButton variant="primary" @click="openCreate"><Plus :size="16" /> Tambah {{ activeTab.label.toLowerCase() }}</AdminButton>
    </AdminPageHeader>

    <div v-if="error" class="mb-3.5 rounded-xl border-2 border-ink bg-pinky px-3 py-2.5 text-sm font-bold text-ink" role="alert">{{ error }}</div>
    <div v-else-if="notice" class="mb-3.5 rounded-xl border-2 border-ink bg-mint px-3 py-2.5 text-sm font-bold text-ink" role="status">{{ notice }}</div>

    <section class="admin-panel overflow-hidden" aria-label="Daftar kategori">
      <!-- Tab -->
      <div class="grid gap-2.5 border-b-2 border-ink/10 bg-bg px-4 py-3.5 sm:grid-cols-2" role="tablist" aria-label="Jenis kategori">
        <button
          v-for="tab in tabs"
          :key="tab.kind"
          type="button"
          role="tab"
          :class="[tabBase, activeKind === tab.kind ? 'bg-banner-sun' : 'bg-white hover:bg-muted']"
          :aria-selected="activeKind === tab.kind"
          @click="activeKind = tab.kind"
        >
          <strong class="font-body text-sm font-extrabold">{{ tab.label }}</strong>
          <span
            class="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-extrabold"
            :class="activeKind === tab.kind ? 'bg-ink text-white' : 'bg-soft text-ink'"
          >{{ tab.kind === 'anime' ? animeCount : productCount }}</span>
          <small class="col-span-full text-[11px] text-muted-foreground">{{ tab.hint }}</small>
        </button>
      </div>

      <AdminState v-if="loading" kind="loading" message="Memuat kategori…" />

      <div v-else-if="!visible.length" class="grid justify-items-center gap-2 px-5 py-10 text-center text-muted-foreground">
        <Tags :size="22" />
        <strong class="font-head text-[15px] font-semibold text-ink">Belum ada {{ activeTab.label.toLowerCase() }}</strong>
        <span class="max-w-[34ch] text-sm leading-relaxed">Tambahkan kategori agar produk bisa difilter dengan rapi.</span>
        <AdminButton variant="secondary" class="mt-1!" @click="openCreate"><Plus :size="15" /> Tambah {{ activeTab.label.toLowerCase() }}</AdminButton>
      </div>

      <!-- Daftar -->
      <ul v-else class="m-0 list-none p-0">
        <li
          v-for="item in visible"
          :key="item.id"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b-2 border-ink/10 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-3"
          :class="item.is_active ? '' : 'bg-bg'"
        >
          <div class="grid min-w-0 gap-0.5">
            <strong class="font-body text-sm font-bold">{{ item.name }}</strong>
            <code class="truncate font-mono text-[11px] text-muted-foreground">{{ item.slug }}</code>
            <p v-if="item.description" class="m-0 mt-0.5 text-xs leading-normal text-muted-foreground">{{ item.description }}</p>
          </div>

          <div class="flex items-center gap-2 max-sm:justify-end">
            <span :class="[pillBase, 'bg-banner-sky']">{{ item.product_count || 0 }} produk</span>
            <span :class="[pillBase, item.is_active ? 'bg-mint' : 'bg-soft']">{{ item.is_active ? 'Aktif' : 'Nonaktif' }}</span>
          </div>

          <div class="flex gap-1.5 max-sm:col-span-full max-sm:justify-end">
            <button type="button" :class="[actionBase, 'hover:bg-banner-sun']" @click="openEdit(item)"><Pencil :size="14" /> Edit</button>
            <button
              v-if="canDelete"
              type="button"
              :class="[actionBase, 'text-destructive enabled:hover:bg-pinky']"
              :disabled="busyId === item.id"
              @click="remove(item)"
            >
              <Trash2 :size="14" /> Hapus
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Dialog form -->
    <AdminDialog
      v-model="dialogOpen"
      :title="editing ? 'Edit kategori' : `Tambah ${activeTab.label.toLowerCase()}`"
      :description="editing ? 'Perubahan langsung dipakai pada filter katalog.' : `Kategori baru akan masuk ke kelompok ${activeTab.label.toLowerCase()}.`"
    >
      <form id="admin-category-form" class="grid gap-3.5" @submit.prevent="submit">
        <label class="admin-field">
          <span class="admin-field__label">Nama <b class="text-destructive" aria-hidden="true">*</b></span>
          <input v-model="form.name" name="name" required maxlength="120" autocomplete="off" :placeholder="activeKind === 'anime' ? 'Contoh: Jujutsu Kaisen' : 'Contoh: Gantungan kunci'" :class="inputCls" />
        </label>
        <label class="admin-field">
          <span class="admin-field__label">Slug <small class="font-medium text-muted-foreground">opsional</small></span>
          <input v-model="form.slug" name="slug" maxlength="140" autocomplete="off" placeholder="dibuat-otomatis-dari-nama" :class="inputCls" />
          <small class="admin-field__hint">Dipakai di URL filter, misalnya ?anime=jujutsu-kaisen.</small>
        </label>
        <label class="admin-field">
          <span class="admin-field__label">Deskripsi <small class="font-medium text-muted-foreground">opsional</small></span>
          <input v-model="form.description" name="description" maxlength="255" autocomplete="off" placeholder="Catatan singkat kategori" :class="inputCls" />
        </label>
        <label class="admin-field">
          <span class="admin-field__label">Urutan tampil</span>
          <input v-model.number="form.sort_order" name="sort_order" type="number" min="0" step="1" inputmode="numeric" :class="inputCls" />
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input v-model="form.is_active" type="checkbox" class="accent-ink" />
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
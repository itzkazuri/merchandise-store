<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'
import {
  ChevronRight,
  Heart,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Wallet,
} from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import ProductArt from '@/components/ProductArt.vue'
import ProductCard from '@/components/ProductCard.vue'
import { catalogApi } from '@/api/catalog'
import { ApiError } from '@/api/client'
import { rupiah } from '@/lib/format'
import {
  decorateProduct,
  productCategoryLabel,
  productImageUrl,
  productSeries,
  visualForCategory,
} from '@/lib/productVisual'
import type { CatalogProduct } from '@/types/catalog'
import { useCart } from '@/composables/useCart'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { addToCart, openCart } = useCart()
const { isAuthenticated } = useAuth()
const { showToast } = useToast()

const product = ref<CatalogProduct | null>(null)
const related = ref<CatalogProduct[]>([])
const loading = ref(true)
const error = ref('')
const qty = ref(1)
const liked = ref(false)

const maxStock = computed(() => Math.max(0, Number(product.value?.stock ?? 0)))
const soldOut = computed(() => maxStock.value <= 0)
const lowStock = computed(() => maxStock.value > 0 && maxStock.value <= 5)
const subtotal = computed(() => Number(product.value?.price || 0) * qty.value)
const categoryVisual = computed(() => visualForCategory(product.value?.category || null))

useHead(() => {
  const current = product.value
  const title = current ? `${current.name} · Mochibako` : 'Detail Produk · Mochibako'
  const description = current?.description?.trim()
    || 'Lihat detail produk merchandise anime di Mochibako: harga, stok, dan cara pengambilan.'
  const image = current ? productImageUrl(current) : null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const siteUrl = (import.meta.env.VITE_SITE_URL || origin).replace(/\/$/, '')
  const canonical = current
    ? `${siteUrl}/produk/${encodeURIComponent(current.slug || String(current.id))}`
    : `${siteUrl}${route.path}`
  const jsonLd = current ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: current.name,
    description,
    sku: current.sku || undefined,
    image: image ? [image] : undefined,
    brand: { '@type': 'Brand', name: 'Mochibako' },
    offers: {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: import.meta.env.VITE_CURRENCY || 'IDR',
      price: Number(current.price),
      availability: Number(current.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  } : null

  return {
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: 'index,follow' },
      { property: 'og:type', content: 'product' },
      { property: 'og:site_name', content: 'Mochibako' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      ...(image ? [
        { property: 'og:image', content: image },
        { property: 'og:image:alt', content: current?.name || '' },
      ] : []),
      { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(image ? [{ name: 'twitter:image', content: image }] : []),
    ],
    link: [{ rel: 'canonical', href: canonical }],
    script: jsonLd ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }] : [],
  }
})

async function loadProduct() {
  loading.value = true
  error.value = ''
  product.value = null
  related.value = []
  qty.value = 1

  try {
    const data = await catalogApi.product(String(route.params.slug))
    product.value = decorateProduct(data)
    liked.value = Boolean(data.is_liked || data.isLiked)
    await loadRelated(data)
  } catch (cause) {
    error.value = cause instanceof ApiError
      ? cause.message
      : 'Detail produk gagal dimuat. Coba lagi sebentar.'
  } finally {
    loading.value = false
  }
}

async function loadRelated(current: CatalogProduct) {
  const params: Record<string, unknown> = { size: 5, sort: 'best_seller' }
  if (current.category?.slug) params.category = current.category.slug
  else if (current.anime?.slug) params.anime = current.anime.slug
  else return

  try {
    const data = await catalogApi.products(params)
    related.value = (data.items || [])
      .filter((item) => item.id !== current.id)
      .slice(0, 4)
      .map(decorateProduct)
  } catch {
    related.value = []
  }
}

function step(delta: number) {
  qty.value = Math.min(maxStock.value, Math.max(1, qty.value + delta))
}

function handleAdd() {
  if (!product.value || soldOut.value) return
  if (!isAuthenticated.value) {
    showToast('Masuk dulu untuk menambah ke keranjang')
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  addToCart(product.value, qty.value)
  openCart()
}

function buyNow() {
  if (!product.value || soldOut.value) return
  if (!isAuthenticated.value) {
    showToast('Masuk dulu untuk membeli')
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  addToCart(product.value, qty.value)
  router.push('/keranjang')
}

async function toggleLike() {
  if (!product.value) return
  if (!isAuthenticated.value) {
    showToast('Masuk dulu untuk menyimpan produk favorit')
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  try {
    if (liked.value) await catalogApi.unlike(product.value.id)
    else await catalogApi.like(product.value.id)
    liked.value = !liked.value
    product.value.is_liked = liked.value
    product.value.isLiked = liked.value
  } catch {
    showToast('Gagal menyimpan produk. Coba lagi.')
  }
}

function addRelated(item: CatalogProduct) {
  if (Number(item.stock ?? 0) <= 0) {
    showToast(`${item.name} sedang habis`)
    return
  }
  if (!isAuthenticated.value) {
    showToast('Masuk dulu untuk menambah ke keranjang')
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  addToCart(item)
}

watch(() => route.params.slug, loadProduct, { immediate: true })
</script>

<template>
  <StoreShell>
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">
      <!-- Breadcrumb -->
      <nav class="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs font-bold text-ink/55" aria-label="Breadcrumb">
        <RouterLink to="/" class="hover:text-ink">Beranda</RouterLink>
        <ChevronRight :size="12" class="shrink-0" />
        <RouterLink
          :to="product?.category?.slug ? `/?kategori=${product.category.slug}` : '/'"
          class="hover:text-ink"
        >
          {{ product ? productCategoryLabel(product) : 'Katalog' }}
        </RouterLink>
        <ChevronRight v-if="product" :size="12" class="shrink-0" />
        <span v-if="product" class="truncate max-w-[45vw] text-ink/75">{{ product.name }}</span>
      </nav>

      <!-- Loading -->
      <div v-if="loading" class="mt-5 grid gap-6 lg:grid-cols-[1.05fr_.95fr] animate-pulse">
        <div class="nb p-3"><div class="aspect-square rounded-xl bg-soft/70"></div></div>
        <div class="space-y-4 pt-2">
          <div class="h-4 w-1/3 rounded bg-soft/80"></div>
          <div class="h-9 w-4/5 rounded bg-soft/80"></div>
          <div class="h-5 w-1/2 rounded bg-soft/70"></div>
          <div class="h-20 rounded-xl bg-soft/60"></div>
          <div class="h-11 rounded-full bg-soft/70"></div>
          <div class="h-11 rounded-full bg-soft/60"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error || !product" class="nb mt-6 p-6 sm:p-10 text-center max-w-xl mx-auto">
        <PackageCheck :size="42" class="mx-auto text-ink/35 mb-3" />
        <h1 class="font-head text-xl font-bold text-ink">Produk tidak bisa dibuka</h1>
        <p class="mt-1.5 text-sm font-semibold text-ink/65">{{ error || 'Produk tidak ditemukan atau sudah tidak dijual.' }}</p>
        <div class="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" class="btn bg-white text-ink px-4 h-9 text-sm font-head font-semibold" @click="loadProduct">Coba lagi</button>
          <RouterLink to="/" class="btn bg-sun text-ink px-4 h-9 text-sm font-head font-semibold">Kembali ke katalog</RouterLink>
        </div>
      </div>

      <!-- Product -->
      <template v-else>
        <div class="mt-5 grid gap-6 sm:gap-8 lg:grid-cols-[1.05fr_.95fr] items-start">
          <!-- Artwork -->
          <div class="lg:sticky lg:top-24">
            <div class="nb p-2.5 sm:p-3 rotate-[-0.6deg]">
              <ProductArt
                :product="product"
                :icon-size="132"
                :image-width="960"
                image-sizes="(max-width: 1024px) 92vw, 560px"
                eager
                class="aspect-square w-full rounded-xl border-2 border-ink"
              />
            </div>

            <div class="mt-4 grid grid-cols-3 gap-2">
              <div class="nb p-2.5 sm:p-3 text-center">
                <PackageCheck :size="18" class="mx-auto mb-1 text-ink" />
                <p class="text-[11px] font-extrabold leading-tight">Stok {{ product.stock }}</p>
              </div>
              <div class="nb p-2.5 sm:p-3 text-center">
                <Store :size="18" class="mx-auto mb-1 text-ink" />
                <p class="text-[11px] font-extrabold leading-tight">Ambil di toko</p>
              </div>
              <div class="nb p-2.5 sm:p-3 text-center">
                <Truck :size="18" class="mx-auto mb-1 text-ink" />
                <p class="text-[11px] font-extrabold leading-tight">Bisa dikirim</p>
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                v-if="product.anime"
                class="inline-flex items-center rounded-full border-2 border-ink bg-banner-sky px-2.5 py-0.5 text-[11px] font-extrabold"
              >
                {{ product.anime.name }}
              </span>
              <span :class="['inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-0.5 text-[11px] font-extrabold', categoryVisual.color]">
                {{ productCategoryLabel(product) }}
              </span>
              <span
                v-if="product.product_type"
                class="inline-flex items-center rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[11px] font-extrabold"
              >
                {{ product.product_type === 'handmade' ? 'Handmade' : 'Imported' }}
              </span>
            </div>

            <h1 class="mt-2.5 font-head text-2xl sm:text-3xl md:text-4xl font-bold leading-[1.1] text-ink">
              {{ product.name }}
            </h1>

            <p class="mt-1.5 text-sm font-bold text-ink/55">{{ productSeries(product) }} · SKU {{ product.sku }}</p>

            <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="font-head text-3xl sm:text-4xl font-bold text-ink">{{ rupiah(product.price) }}</p>
                <p class="mt-0.5 text-xs font-semibold text-ink/55">
                  {{ product.sold_count ? `Terjual ${product.sold_count} · ` : '' }}Harga sudah termasuk pajak
                </p>
              </div>
              <span
                :class="[
                  'rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold',
                  soldOut ? 'bg-destructive text-white' : lowStock ? 'bg-sun text-ink' : 'bg-mint text-ink',
                ]"
              >
                {{ soldOut ? 'Stok habis' : lowStock ? `Sisa ${product.stock}` : 'Stok tersedia' }}
              </span>
            </div>

            <p v-if="product.description" class="mt-4 text-sm sm:text-[15px] leading-relaxed font-semibold text-ink/75 whitespace-pre-line">
              {{ product.description }}
            </p>
            <p v-else class="mt-4 text-sm leading-relaxed font-semibold text-ink/60">
              Koleksi {{ productCategoryLabel(product).toLowerCase() }} pilihan dari Mochibako. Dikemas rapi dan siap masuk rak koleksimu.
            </p>

            <!-- Quantity + actions -->
            <div class="nb mt-5 p-3.5 sm:p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-[11px] font-extrabold uppercase tracking-wide text-ink/50">Jumlah</p>
                  <div class="mt-1.5 inline-flex items-center gap-2">
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full border-2 border-ink bg-white grid place-items-center disabled:opacity-40"
                      :disabled="qty <= 1 || soldOut"
                      aria-label="Kurangi jumlah"
                      @click="step(-1)"
                    >
                      <Minus :size="14" :stroke-width="2.6" />
                    </button>
                    <span class="w-9 text-center font-head text-lg font-bold">{{ qty }}</span>
                    <button
                      type="button"
                      class="w-8 h-8 rounded-full border-2 border-ink bg-sun grid place-items-center disabled:opacity-40"
                      :disabled="qty >= maxStock || soldOut"
                      aria-label="Tambah jumlah"
                      @click="step(1)"
                    >
                      <Plus :size="14" :stroke-width="2.6" />
                    </button>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-[11px] font-extrabold uppercase tracking-wide text-ink/50">Subtotal</p>
                  <p class="font-head text-lg sm:text-xl font-bold">{{ rupiah(subtotal) }}</p>
                </div>
              </div>

              <div class="mt-3.5 grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  class="btn bg-ink text-bg h-11 px-4 font-head font-semibold text-sm sm:text-base disabled:opacity-50"
                  :disabled="soldOut"
                  @click="handleAdd"
                >
                  <ShoppingBag :size="17" class="mr-1.5" />
                  {{ soldOut ? 'Stok habis' : 'Tambah ke keranjang' }}
                </button>
                <button
                  type="button"
                  class="btn bg-sun text-ink h-11 px-4 font-head font-semibold text-sm sm:text-base disabled:opacity-50"
                  :disabled="soldOut"
                  @click="buyNow"
                >
                  Beli sekarang
                </button>
              </div>

              <div class="mt-2.5 flex items-center justify-between gap-3">
                <p class="text-[11px] font-semibold text-ink/55">
                  <ShieldCheck :size="13" class="inline -mt-0.5 mr-1" />
                  Stok dan harga dicek ulang saat checkout.
                </p>
                <button
                  type="button"
                  class="wish inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold text-ink/70 hover:text-ink"
                  :aria-pressed="liked"
                  @click="toggleLike"
                >
                  <Heart :size="15" :stroke-width="2.4" /> {{ liked ? 'Tersimpan' : 'Simpan' }}
                </button>
              </div>
            </div>

            <!-- Payment / delivery notes -->
            <div class="mt-4 grid gap-2 sm:grid-cols-3">
              <div class="rounded-xl border-2 border-ink/15 bg-white/70 p-2.5">
                <Store :size="16" class="mb-1 text-ink" />
                <p class="text-[11px] font-extrabold leading-tight">Ambil di toko</p>
                <p class="mt-0.5 text-[10.5px] font-semibold text-ink/55">Gratis, siap diambil setelah dikonfirmasi.</p>
              </div>
              <div class="rounded-xl border-2 border-ink/15 bg-white/70 p-2.5">
                <Truck :size="16" class="mb-1 text-ink" />
                <p class="text-[11px] font-extrabold leading-tight">Dikirim kurir</p>
                <p class="mt-0.5 text-[10.5px] font-semibold text-ink/55">Ongkir dikonfirmasi admin saat proses.</p>
              </div>
              <div class="rounded-xl border-2 border-ink/15 bg-white/70 p-2.5">
                <Wallet :size="16" class="mb-1 text-ink" />
                <p class="text-[11px] font-extrabold leading-tight">Midtrans</p>
                <p class="mt-0.5 text-[10.5px] font-semibold text-ink/55">QRIS, VA, e-wallet, atau tunai di toko.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Related -->
        <section v-if="related.length" class="mt-10 sm:mt-14">
          <div class="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 class="font-head text-xl sm:text-2xl font-bold text-ink">Kamu mungkin suka</h2>
              <p class="text-xs sm:text-sm font-semibold text-ink/55">Koleksi lain dari seri dan jenis yang sama.</p>
            </div>
            <RouterLink
              :to="product.category?.slug ? `/?kategori=${product.category.slug}` : '/'"
              class="hidden sm:inline-flex items-center gap-1 text-xs font-extrabold text-ink/60 hover:text-ink"
            >
              Lihat semua <ChevronRight :size="13" />
            </RouterLink>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <ProductCard
              v-for="(item, index) in related"
              :key="item.id"
              :product="item"
              :index="index"
              @add="addRelated"
              @toggle-like="() => {}"
            />
          </div>
        </section>
      </template>
    </div>
  </StoreShell>
</template>

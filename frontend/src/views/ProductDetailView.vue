<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { Sparkles } from 'lucide-vue-next'
import StoreShell from '@/components/StoreShell.vue'
import ProductBreadcrumb from '@/components/product/ProductBreadcrumb.vue'
import ProductGallery from '@/components/product/ProductGallery.vue'
import ProductSummary from '@/components/product/ProductSummary.vue'
import ProductPurchasePanel from '@/components/product/ProductPurchasePanel.vue'
import RelatedProductsSection from '@/components/product/RelatedProductsSection.vue'
import ProductDetailSkeleton from '@/components/product/ProductDetailSkeleton.vue'
import ProductDetailError from '@/components/product/ProductDetailError.vue'
import { useProductDetail } from '@/composables/useProductDetail'

const {
  product,
  related,
  loading,
  error,
  usingFallback,
  qty,
  liked,
  maxStock,
  soldOut,
  subtotal,
  productImage,
  loadProduct,
  handleAdd,
  buyNow,
  toggleLike,
  addRelated,
  toggleRelatedLike,
} = useProductDetail()

useHead(() => {
  const current = product.value
  const isDemo = usingFallback.value
  const title = current ? `${current.name} · Mochibako` : 'Detail Produk · Mochibako'
  const description =
    current?.description?.trim() ||
    'Lihat detail produk merchandise anime di Mochibako: harga, stok, dan cara pengambilan.'
  const image = productImage.value
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const siteUrl = (import.meta.env.VITE_SITE_URL || origin).replace(/\/$/, '')
  const canonical = current
    ? `${siteUrl}/produk/${encodeURIComponent(current.slug || String(current.id))}`
    : `${siteUrl}/produk`

  const jsonLd = current && !isDemo
    ? {
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
          availability:
            Number(current.stock) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      }
    : null

  return {
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'robots', content: isDemo ? 'noindex,nofollow,noarchive' : 'index,follow' },
      { property: 'og:type', content: 'product' },
      { property: 'og:site_name', content: 'Mochibako' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      ...(image
        ? [
            { property: 'og:image', content: image },
            { property: 'og:image:alt', content: current?.name || '' },
          ]
        : []),
      { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(image ? [{ name: 'twitter:image', content: image }] : []),
    ],
    link: [{ rel: 'canonical', href: canonical }],
    script: jsonLd
      ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }]
      : [],
  }
})
</script>

<template>
  <StoreShell>
    <div class="max-w-6xl mx-auto px-3.5 sm:px-5 py-5 sm:py-8">
      <ProductBreadcrumb :product="product" />

      <ProductDetailSkeleton v-if="loading" />

      <ProductDetailError
        v-else-if="error || !product"
        :message="error || 'Produk tidak ditemukan atau sudah tidak dijual.'"
        @retry="loadProduct"
      />

      <template v-else>
        <div
          v-if="usingFallback"
          class="mt-4 flex items-start gap-2 rounded-xl border-2 border-ink/15 bg-lilac/35 px-3.5 py-2.5"
        >
          <Sparkles :size="15" class="mt-0.5 shrink-0 text-ink/55" />
          <p class="text-xs font-semibold leading-relaxed text-ink/65">
            Mode demo statis: halaman ini memakai data contoh karena produk belum tersedia di server.
            Tampilan dan komponennya sama dengan halaman detail asli.
          </p>
        </div>

        <div class="mt-5 grid gap-6 sm:gap-8 lg:grid-cols-[1.05fr_.95fr] items-start">
          <ProductGallery :product="product" />

          <div class="min-w-0">
            <ProductSummary :product="product" />
            <ProductPurchasePanel
              v-model:qty="qty"
              :max-stock="maxStock"
              :subtotal="subtotal"
              :sold-out="soldOut"
              :liked="liked"
              @add="handleAdd"
              @buy="buyNow"
              @toggle-like="toggleLike"
            />
          </div>
        </div>

        <RelatedProductsSection
          v-if="related.length"
          :products="related"
          :category-slug="product.category?.slug"
          @add="addRelated"
          @toggle-like="toggleRelatedLike"
        />
      </template>
    </div>
  </StoreShell>
</template>

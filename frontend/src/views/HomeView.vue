<script setup lang="ts">
import { useSeo } from '@/composables/useSeo'
import SiteHeader from '@/components/SiteHeader.vue'
import BannerCarousel from '@/components/BannerCarousel.vue'
import CartDrawer from '@/components/CartDrawer.vue'
import ToastNotice from '@/components/ToastNotice.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import GoogleOneTap from '@/components/GoogleOneTap.vue'
import LatestProductsSection from '@/components/home/LatestProductsSection.vue'
import SimilarProductsSection from '@/components/home/SimilarProductsSection.vue'
import PreorderSection from '@/components/home/PreorderSection.vue'
import HotSaleSection from '@/components/home/HotSaleSection.vue'
import CatalogSection from '@/components/home/CatalogSection.vue'
import { storefrontBanners } from '@/data/banners'
import { useHomeCatalog } from '@/composables/useHomeCatalog'

useSeo({
  title: 'Katalog Merchandise & Mainan Anime',
  description: 'Temukan koleksi figure, plushie, blind box, cetak art, dan aksesori anime favoritmu di Mochibako.',
  keywords: ['anime merch', 'figure', 'plushie', 'blind box', 'mochibako', 'umkm anime'],
  type: 'website',
})

const {
  products,
  heroProducts,
  categoryChips,
  loading,
  loadingMore,
  error,
  usingFallback,
  fallbackNote,
  total,
  hasNext,
  searchQuery,
  selectedCategory,
  sortOption,
  activeFilters,
  newArrivals,
  hotSale,
  preorderProducts,
  similarAnchor,
  similarProducts,
  runSearch,
  resetFilters,
  retryCatalog,
  loadMore,
  handleAdd,
  handleToggleLike,
} = useHomeCatalog()
</script>

<template>
  <div class="min-h-screen bg-bg text-ink font-body flex flex-col">
    <SiteHeader v-model:search-model="searchQuery" @search="runSearch" />

    <h1 class="sr-only">Mochibako — katalog merchandise dan mainan anime</h1>

    <BannerCarousel
      :banners="storefrontBanners"
      :products="heroProducts"
      @add="handleAdd"
    />

    <main class="w-full flex-1">
      <LatestProductsSection
        :products="newArrivals"
        :loading="loading"
        @add="handleAdd"
        @toggle-like="handleToggleLike"
      />

      <SimilarProductsSection
        v-if="similarAnchor && similarProducts.length"
        :anchor="similarAnchor"
        :products="similarProducts"
        @add="handleAdd"
      />

      <PreorderSection
        v-if="preorderProducts.length"
        :products="preorderProducts"
        @add="handleAdd"
        @toggle-like="handleToggleLike"
      />

      <HotSaleSection
        v-if="hotSale.length"
        :products="hotSale"
        @add="handleAdd"
      />

      <CatalogSection
        v-model:selected-category="selectedCategory"
        v-model:sort-option="sortOption"
        :products="products"
        :category-chips="categoryChips"
        :loading="loading"
        :loading-more="loadingMore"
        :error="error"
        :using-fallback="usingFallback"
        :fallback-note="fallbackNote"
        :total="total"
        :active-filters="activeFilters"
        :has-next="hasNext"
        @add="handleAdd"
        @toggle-like="handleToggleLike"
        @reset="resetFilters"
        @retry="retryCatalog"
        @load-more="loadMore"
      />
    </main>

    <CartDrawer />
    <ToastNotice />
    <GoogleOneTap />
    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { productCategoryLabel } from '@/lib/productVisual'
import type { CatalogProduct } from '@/types/catalog'

defineProps<{
  product: CatalogProduct | null
}>()
</script>

<template>
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
</template>

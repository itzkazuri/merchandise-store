<script setup lang="ts">
import { computed } from 'vue'
import DynamicIcon from './DynamicIcon.vue'
import type { CatalogProduct } from '@/types/catalog'
import { catalogImageUrl, primaryImage, productImageSrcSet, productImageUrl, visualFor } from '@/lib/productVisual'

const props = withDefaults(
  defineProps<{
    product: CatalogProduct
    iconSize?: number
    eager?: boolean
    imageWidth?: number
    imageSizes?: string
  }>(),
  {
    iconSize: 44,
    eager: false,
    imageWidth: 640,
    imageSizes: '(max-width: 640px) 44vw, 320px',
  },
)

const visual = computed(() => visualFor(props.product))
const src = computed(() => productImageUrl(props.product, props.imageWidth))
const srcset = computed(() => productImageSrcSet(props.product, props.imageWidth))
const fallbackSrc = computed(() => catalogImageUrl(primaryImage(props.product)))

let fellBack = false
function handleImageError(event: Event) {
  if (fellBack) return
  const image = event.target as HTMLImageElement
  const raw = fallbackSrc.value
  if (!raw) return
  fellBack = true
  image.removeAttribute('srcset')
  image.src = raw
}
</script>

<template>
  <div :class="['relative grid place-items-center overflow-hidden', visual.color]">
    <template v-if="src">
      <img
        :src="src"
        :srcset="srcset"
        :sizes="imageSizes"
        :alt="product.name"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : 'low'"
        decoding="async"
        :width="imageWidth"
        :height="imageWidth"
        class="absolute inset-0 h-full w-full object-cover"
        @error="handleImageError"
      />
    </template>
    <template v-else>
      <span class="absolute w-3/5 aspect-square rounded-full bg-white/45" aria-hidden="true"></span>
      <DynamicIcon
        :name="visual.icon"
        :size="iconSize"
        :stroke-width="2.2"
        class="relative text-ink"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Box,
  Search,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Crown,
  Heart,
  Gift,
  KeyRound,
  Image,
  Shirt,
  WandSparkles,
  Cat,
  Smile,
  Cloud,
  Sticker,
  Coffee,
  Star,
  Sparkles,
  Plus,
  Minus,
  X,
  User,
  Lock,
  Mail,
  ArrowLeft,
  LogIn,
  LogOut,
  Check,
  Package,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    strokeWidth?: number | string
  }>(),
  {
    size: 20,
    strokeWidth: 2.4,
  },
)

const iconMap: Record<string, any> = {
  box: Box,
  package: Package,
  search: Search,
  'shopping-bag': ShoppingBag,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'layout-grid': LayoutGrid,
  crown: Crown,
  heart: Heart,
  gift: Gift,
  'key-round': KeyRound,
  image: Image,
  shirt: Shirt,
  'wand-sparkles': WandSparkles,
  cat: Cat,
  smile: Smile,
  cloud: Cloud,
  sticker: Sticker,
  coffee: Coffee,
  star: Star,
  sparkles: Sparkles,
  plus: Plus,
  minus: Minus,
  x: X,
  user: User,
  lock: Lock,
  mail: Mail,
  'arrow-left': ArrowLeft,
  'log-in': LogIn,
  'log-out': LogOut,
  check: Check,
}

const resolvedComponent = computed(() => {
  const key = props.name?.toLowerCase().trim() || 'box'
  return iconMap[key] || Box
})
</script>

<template>
  <component
    :is="resolvedComponent"
    :size="size"
    :stroke-width="strokeWidth"
    class="lucide shrink-0"
  />
</template>

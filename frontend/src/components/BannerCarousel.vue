<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, ShoppingBag } from 'lucide-vue-next'
import DynamicIcon from './DynamicIcon.vue'
import ProductArt from './ProductArt.vue'
import { rupiah } from '@/lib/format'
import type { CatalogProduct } from '@/types/catalog'
import type { BannerConfig, BannerCta, BannerPattern, ImageBanner, ProductBanner } from '@/data/banners'

const props = withDefaults(
  defineProps<{
    banners: BannerConfig[]
    /** Produk dari API, dipakai banner tipe 'product' (cocok via slug/id). */
    products?: CatalogProduct[]
    autoplayMs?: number
  }>(),
  {
    products: () => [],
    autoplayMs: 7000,
  },
)

const emit = defineEmits<{
  add: [product: CatalogProduct]
}>()

const rootEl = ref<HTMLElement | null>(null)
const currentIdx = ref(0)
const userPaused = ref(false)
const hovering = ref(false)
const focusWithin = ref(false)
const pageHidden = ref(false)
const reducedMotion = ref(false)
const progressKey = ref(0)

let timer: ReturnType<typeof setTimeout> | undefined
let motionQuery: MediaQueryList | undefined
let touchStartX: number | null = null
let touchStartY: number | null = null

const total = computed(() => props.banners.length)

const autoplayActive = computed(
  () =>
    total.value > 1 &&
    !userPaused.value &&
    !hovering.value &&
    !focusWithin.value &&
    !pageHidden.value &&
    !reducedMotion.value,
)

const trackTransform = computed(() => `translateX(-${(currentIdx.value * 100) / (total.value || 1)}%)`)

function isImageBanner(banner: BannerConfig): banner is ImageBanner {
  return banner.type === 'image'
}

function isProductBanner(banner: BannerConfig): banner is ProductBanner {
  return banner.type === 'product'
}

function slideProduct(banner: BannerConfig, index: number): CatalogProduct | null {
  if (!isProductBanner(banner)) return null

  const wantedSlug = banner.productSlug?.trim()
  const wantedId = banner.productId
  const fromApi =
    (wantedSlug ? props.products.find((product) => product.slug === wantedSlug) : undefined) ??
    (wantedId ? props.products.find((product) => product.id === wantedId) : undefined)

  if (fromApi) return fromApi

  const fallback = banner.fallback
  if (!fallback) return null

  return {
    id: -(index + 1),
    name: fallback.name,
    slug: fallback.slug,
    series: fallback.series,
    price: fallback.price,
    badge: fallback.badge,
    spec: fallback.spec,
    stock: 1,
    images: fallback.image
      ? [
          {
            id: index + 1,
            object_key: fallback.image,
            alt_text: fallback.name,
            is_primary: true,
            sort_order: 0,
            created_at: '',
          },
        ]
      : [],
  }
}

function slideSlug(banner: BannerConfig, index: number): string | undefined {
  if (banner.type === 'product') return slideProduct(banner, index)?.slug
  return undefined
}

function patternStyle(pattern?: BannerPattern): Record<string, string> {
  if (pattern === 'grid') {
    return {
      backgroundImage:
        'linear-gradient(#1B2430 1px, transparent 1px), linear-gradient(90deg, #1B2430 1px, transparent 1px)',
      backgroundSize: '26px 26px',
      opacity: '0.06',
    }
  }
  if (pattern === 'dots') {
    return {
      backgroundImage: 'radial-gradient(#1B2430 2px, transparent 2px)',
      backgroundSize: '18px 18px',
      opacity: '0.08',
    }
  }
  if (pattern === 'rays') {
    return {
      backgroundImage: 'repeating-conic-gradient(from 0deg at 50% 50%, #ffffff 0deg 9deg, transparent 9deg 18deg)',
      opacity: '0.22',
    }
  }
  return {}
}

function imageOverlay(banner: ImageBanner, vertical = false): Record<string, string> {
  const strength = Math.min(1, Math.max(0, banner.overlay ?? 0.9))
  const channel = banner.tone === 'light' ? '27,36,48' : '255,255,255'
  const strong = (0.96 * strength).toFixed(3)
  const mid = (0.72 * strength).toFixed(3)
  const soft = (0.08 * strength).toFixed(3)

  return {
    backgroundImage: vertical
      ? `linear-gradient(180deg, rgba(${channel},${strong}) 0%, rgba(${channel},${mid}) 58%, rgba(${channel},${soft}) 100%)`
      : `linear-gradient(90deg, rgba(${channel},${strong}) 0%, rgba(${channel},${mid}) 46%, rgba(${channel},0) 76%)`,
  }
}

function ctaClass(cta: BannerCta) {
  return cta.variant === 'ghost'
    ? 'btn bg-white px-3.5 sm:px-5 h-9 sm:h-11 font-head font-bold text-xs sm:text-base text-ink'
    : 'btn bg-sun px-3.5 sm:px-5 h-9 sm:h-11 font-head font-bold text-xs sm:text-base text-ink'
}

function isExternal(link: string) {
  return /^(https?:)?\/\//i.test(link)
}

function goTo(index: number) {
  if (total.value === 0) return
  currentIdx.value = (index + total.value) % total.value
}

function next() {
  goTo(currentIdx.value + 1)
}

function prev() {
  goTo(currentIdx.value - 1)
}

function togglePause() {
  userPaused.value = !userPaused.value
}

function schedule() {
  clearTimeout(timer)
  timer = undefined
  if (!autoplayActive.value) return
  timer = setTimeout(() => goTo(currentIdx.value + 1), props.autoplayMs)
}

function onKeydown(e: KeyboardEvent) {
  if (total.value < 2) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
  }
}

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function onTouchEnd(e: TouchEvent) {
  if (touchStartX === null || touchStartY === null) return
  const touch = e.changedTouches[0]
  if (!touch) return

  const diffX = touch.clientX - touchStartX
  const diffY = touch.clientY - touchStartY
  touchStartX = null
  touchStartY = null

  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 36) {
    if (diffX < 0) next()
    else prev()
  }
}

function onFocusOut(e: FocusEvent) {
  const root = rootEl.value
  const nextTarget = e.relatedTarget
  if (!root || !nextTarget || !(nextTarget instanceof Node) || !root.contains(nextTarget)) {
    focusWithin.value = false
  }
}

function onVisibilityChange() {
  pageHidden.value = document.hidden
}

function onMotionChange(e: MediaQueryListEvent) {
  reducedMotion.value = e.matches
}

watch([autoplayActive, currentIdx], () => {
  if (autoplayActive.value) progressKey.value += 1
  schedule()
})

onMounted(() => {
  if (typeof window === 'undefined') return
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
  schedule()
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  motionQuery?.removeEventListener('change', onMotionChange)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
})
</script>

<template>
  <section
    v-if="total"
    ref="rootEl"
    class="max-w-6xl mx-auto px-2.5 xs:px-3 sm:px-5 mt-2.5 sm:mt-5 md:mt-6"
    aria-roledescription="carousel"
    aria-label="Banner dan produk pilihan Mochibako"
    tabindex="0"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
    @focusin="focusWithin = true"
    @focusout="onFocusOut"
    @keydown="onKeydown"
  >
    <div class="relative">
      <!-- Viewport -->
      <div
        class="overflow-hidden rounded-2xl sm:rounded-3xl border-[2.5px] border-ink shadow-[4px_4px_0_#1B2430] sm:shadow-[5px_5px_0_#1B2430]"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div
          class="flex"
          :style="{
            width: `${total * 100}%`,
            transform: trackTransform,
            transitionProperty: 'transform',
            transitionDuration: reducedMotion ? '0ms' : '600ms',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }"
        >
          <article
            v-for="(banner, index) in banners"
            :key="banner.id"
            class="relative shrink-0 overflow-hidden
                   px-5 xs:px-6 sm:px-12 md:px-16 lg:px-20
                   py-5 xs:py-6 sm:py-9 md:py-10
                   min-h-[220px] xs:min-h-[240px] sm:min-h-[300px] md:min-h-[340px] lg:min-h-[368px]
                   flex items-center"
            :class="[
              banner.type === 'image' ? 'bg-[#D6EEFA]' : (banner.bg || 'bg-banner-sun'),
              banner.type === 'image' && banner.tone === 'light' ? 'text-white' : 'text-ink',
            ]"
            :style="{ width: `${100 / total}%` }"
            role="group"
            aria-roledescription="slide"
            :aria-label="`${index + 1} dari ${total}`"
            :aria-hidden="index !== currentIdx"
            :inert="index !== currentIdx"
          >
            <!-- Latar pola untuk style/product -->
            <span
              v-if="banner.type !== 'image' && banner.pattern && banner.pattern !== 'none'"
              class="absolute inset-0 pointer-events-none"
              :style="patternStyle(banner.pattern)"
              aria-hidden="true"
            ></span>

            <!-- Banner gambar -->
            <template v-if="isImageBanner(banner)">
              <img
                :src="banner.src"
                :alt="banner.alt"
                :loading="index === 0 ? 'eager' : 'lazy'"
                :fetchpriority="index === 0 ? 'high' : 'low'"
                decoding="async"
                class="absolute inset-0 h-full w-full object-cover"
                :style="{ objectPosition: banner.focal || 'center' }"
              />
              <!-- Overlay vertikal lebih kuat di mobile/fold -->
              <span
                class="absolute inset-0 sm:hidden"
                :style="imageOverlay(banner, true)"
                aria-hidden="true"
              ></span>
              <span
                class="absolute inset-0 hidden sm:block"
                :style="imageOverlay(banner)"
                aria-hidden="true"
              ></span>
            </template>

            <!-- Banner style: stiker dekoratif -->
            <template v-else>
              <span
                class="absolute -right-12 -bottom-20 sm:-right-16 sm:-bottom-24
                       w-48 xs:w-56 sm:w-72 md:w-80
                       h-48 xs:h-56 sm:h-72 md:h-80
                       rounded-full bg-white/45 pointer-events-none"
                aria-hidden="true"
              ></span>
              <div
                v-if="banner.layout !== 'center'"
                class="pointer-events-none absolute right-6 md:right-12 lg:right-16 top-1/2 -translate-y-1/2 hidden md:block"
                aria-hidden="true"
              >
                <div class="relative w-32 lg:w-40 xl:w-44 aspect-square">
                  <div class="absolute inset-0 rotate-6 rounded-[30%] bg-white border-[2.5px] border-ink shadow-[6px_6px_0_#1B2430] grid place-items-center">
                    <DynamicIcon :name="banner.icons?.[0] || 'sparkles'" :size="52" :stroke-width="2" />
                  </div>
                  <div class="absolute -bottom-4 -left-6 w-16 h-16 lg:w-20 lg:h-20 -rotate-6 rounded-2xl bg-sun border-[2.5px] border-ink shadow-[4px_4px_0_#1B2430] grid place-items-center">
                    <DynamicIcon :name="banner.icons?.[1] || 'star'" :size="26" :stroke-width="2.2" />
                  </div>
                  <DynamicIcon
                    name="sparkles"
                    :size="22"
                    class="float absolute -top-4 -left-5 fill-white stroke-ink text-ink"
                  />
                </div>
              </div>
            </template>

            <!-- Konten slide style/image -->
            <div
              v-if="banner.type !== 'product'"
              class="relative z-10 w-full"
              :class="banner.type === 'style' && banner.layout === 'center'
                ? 'max-w-xl mx-auto text-center'
                : 'max-w-[20rem] xs:max-w-[22rem] sm:max-w-[28rem] md:max-w-[32rem] lg:max-w-[34rem]'"
            >
              <span
                v-if="banner.eyebrow"
                class="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white
                       px-2.5 sm:px-3 py-0.5 sm:py-1
                       text-[9px] xs:text-[10px] sm:text-[11px]
                       font-extrabold uppercase tracking-[0.12em] sm:tracking-[0.14em] text-ink"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-sun border border-ink" aria-hidden="true"></span>
                {{ banner.eyebrow }}
              </span>

              <h2 class="mt-2 sm:mt-3 font-head font-bold
                         text-[22px] xs:text-[24px] sm:text-[32px] md:text-[40px] lg:text-[44px]
                         leading-[1.1] sm:leading-[1.06] text-balance">
                {{ banner.title }}
              </h2>

              <p
                v-if="banner.subtitle"
                class="mt-1.5 sm:mt-2.5 md:mt-3
                       text-[12px] xs:text-[12.5px] sm:text-sm md:text-base
                       font-semibold leading-relaxed
                       line-clamp-2 sm:line-clamp-none"
                :class="banner.type === 'image' && banner.tone === 'light' ? 'text-white/85' : 'text-ink/70'"
              >
                {{ banner.subtitle }}
              </p>

              <div v-if="banner.ctas?.length" class="mt-3.5 sm:mt-5 md:mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
                <template v-for="cta in banner.ctas" :key="cta.label">
                  <a
                    v-if="isExternal(cta.to)"
                    :href="cta.to"
                    target="_blank"
                    rel="noopener noreferrer"
                    :class="ctaClass(cta)"
                  >
                    {{ cta.label }}
                    <ArrowRight :size="14" :stroke-width="2.4" class="ml-1 sm:ml-1.5" />
                  </a>
                  <RouterLink v-else :to="cta.to" :class="ctaClass(cta)">
                    {{ cta.label }}
                    <ArrowRight :size="14" :stroke-width="2.4" class="ml-1 sm:ml-1.5" />
                  </RouterLink>
                </template>
              </div>
            </div>

            <!-- Konten slide produk -->
            <div
              v-else
              class="relative z-10 w-full
                     grid grid-cols-[1fr_auto]
                     gap-2.5 xs:gap-3 sm:gap-6 md:gap-8
                     items-center"
            >
              <div class="min-w-0">
                <span
                  v-if="banner.eyebrow"
                  class="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white
                         px-2.5 sm:px-3 py-0.5 sm:py-1
                         text-[9px] xs:text-[10px] sm:text-[11px]
                         font-extrabold uppercase tracking-[0.12em] sm:tracking-[0.14em] text-ink"
                >
                  <ShoppingBag :size="11" :stroke-width="2.6" class="sm:hidden" />
                  <ShoppingBag :size="12" :stroke-width="2.6" class="hidden sm:block" />
                  {{ banner.eyebrow }}
                </span>

                <div class="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span
                    v-if="slideProduct(banner, index)?.badge"
                    class="inline-block -rotate-2 rounded-md border-2 border-ink bg-white
                           px-1.5 sm:px-2 py-0.5
                           text-[9px] xs:text-[10px] sm:text-xs font-extrabold shadow-sm"
                  >
                    {{ slideProduct(banner, index)?.badge }}
                  </span>
                  <span class="text-[10px] xs:text-[11px] sm:text-sm font-bold text-ink/65">
                    {{ slideProduct(banner, index)?.series || 'Mochibako Collection' }}
                  </span>
                </div>

                <h2 class="mt-1 font-head font-bold
                           text-[17px] xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl
                           leading-[1.15] line-clamp-2">
                  <RouterLink
                    v-if="slideSlug(banner, index)"
                    :to="`/produk/${slideSlug(banner, index)}`"
                    class="hover:underline decoration-[3px] underline-offset-4"
                  >
                    {{ slideProduct(banner, index)?.name || banner.title }}
                  </RouterLink>
                  <template v-else>{{ slideProduct(banner, index)?.name || banner.title }}</template>
                </h2>

                <p class="mt-0.5 sm:mt-1
                          text-[11px] xs:text-[11.5px] sm:text-sm
                          font-semibold text-ink/70
                          line-clamp-1 sm:line-clamp-2">
                  {{ slideProduct(banner, index)?.spec || banner.subtitle || 'Koleksi edisi spesial' }}
                </p>

                <div class="mt-2.5 sm:mt-4 md:mt-5 flex flex-wrap items-center gap-1.5 sm:gap-2.5 md:gap-3">
                  <span class="font-head font-bold
                               text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl
                               whitespace-nowrap">
                    {{ rupiah(slideProduct(banner, index)?.price || 0) }}
                  </span>

                  <RouterLink
                    v-if="slideSlug(banner, index)"
                    :to="`/produk/${slideSlug(banner, index)}`"
                    class="btn bg-white px-3 sm:px-4 h-8 sm:h-9 md:h-10 font-head font-bold text-[11px] xs:text-xs sm:text-sm"
                  >
                    Detail
                  </RouterLink>

                  <button
                    v-if="slideProduct(banner, index)"
                    type="button"
                    class="btn bg-sun px-3 sm:px-4 md:px-5 h-8 sm:h-9 md:h-10 font-head font-bold text-[11px] xs:text-xs sm:text-sm"
                    @click="emit('add', slideProduct(banner, index)!)"
                  >
                    Ambil
                  </button>
                </div>
              </div>

              <!-- Art produk -->
              <div
                class="relative justify-self-center
                       w-[88px] xs:w-24 sm:w-36 md:w-44 lg:w-48
                       aspect-square shrink-0"
                aria-hidden="true"
              >
                <div class="absolute inset-0 rotate-3
                            rounded-xl sm:rounded-2xl md:rounded-3xl
                            bg-white border-2 sm:border-[2.5px] border-ink
                            shadow-[3px_3px_0_#1B2430] sm:shadow-[5px_5px_0_#1B2430]
                            overflow-hidden grid place-items-center">
                  <ProductArt
                    v-if="slideProduct(banner, index)"
                    :product="slideProduct(banner, index)!"
                    :icon-size="48"
                    eager
                    :image-width="480"
                    image-sizes="(max-width: 400px) 88px, (max-width: 640px) 112px, 192px"
                    class="absolute inset-0 h-full w-full -rotate-3 scale-105"
                  />
                </div>

                <DynamicIcon
                  :name="banner.icons?.[0] || 'star'"
                  :size="20"
                  class="float absolute -top-2.5 -right-2.5 sm:-top-3.5 sm:-right-3.5
                         fill-sun stroke-ink text-ink hidden xs:block"
                />
                <DynamicIcon
                  :name="banner.icons?.[1] || 'sparkles'"
                  :size="18"
                  class="float absolute -bottom-2.5 -left-2.5 sm:-bottom-3 sm:-left-3
                         fill-white stroke-ink text-ink hidden xs:block"
                  style="animation-delay: 1.1s"
                />
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- Navigasi -->
      <template v-if="total > 1">
        <button
          type="button"
          class="btn absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20
                 w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10
                 grid place-items-center bg-white/95"
          aria-label="Banner sebelumnya"
          @click="prev"
        >
          <ChevronLeft :size="15" :stroke-width="2.6" class="sm:hidden" />
          <ChevronLeft :size="18" :stroke-width="2.4" class="hidden sm:block" />
        </button>
        <button
          type="button"
          class="btn absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20
                 w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10
                 grid place-items-center bg-white/95"
          aria-label="Banner berikutnya"
          @click="next"
        >
          <ChevronRight :size="15" :stroke-width="2.6" class="sm:hidden" />
          <ChevronRight :size="18" :stroke-width="2.4" class="hidden sm:block" />
        </button>

        <!-- Indikator + jeda -->
        <div class="absolute bottom-1.5 sm:bottom-2.5 md:bottom-3 left-1/2 -translate-x-1/2 z-20
                    flex items-center gap-1.5 sm:gap-2">
          <button
            v-for="(banner, i) in banners"
            :key="banner.id"
            type="button"
            :class="[
              'h-1.5 sm:h-2 md:h-2.5 rounded-full border-2 border-ink transition-all duration-300',
              i === currentIdx ? 'w-4 sm:w-5 md:w-7 bg-ink' : 'w-1.5 sm:w-2 md:w-2.5 bg-white/90',
            ]"
            :aria-label="`Tampilkan banner ${i + 1}`"
            :aria-current="i === currentIdx ? 'true' : undefined"
            @click="goTo(i)"
          ></button>

          <button
            v-if="!reducedMotion"
            type="button"
            class="ml-0.5 sm:ml-1 grid
                   w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7
                   place-items-center rounded-full border-2 border-ink bg-white/95 text-ink"
            :aria-label="userPaused ? 'Lanjutkan banner otomatis' : 'Jeda banner otomatis'"
            :aria-pressed="userPaused"
            @click="togglePause"
          >
            <Play v-if="userPaused" :size="10" :stroke-width="2.6" fill="currentColor" class="sm:hidden" />
            <Pause v-else :size="10" :stroke-width="2.6" fill="currentColor" class="sm:hidden" />
            <Play v-if="userPaused" :size="12" :stroke-width="2.6" fill="currentColor" class="hidden sm:block" />
            <Pause v-else :size="12" :stroke-width="2.6" fill="currentColor" class="hidden sm:block" />
          </button>
        </div>

        <!-- Progress autoplay -->
        <div
          v-if="autoplayActive"
          class="absolute bottom-0 left-0 right-0 z-10 h-[2.5px] sm:h-[3px] bg-ink/10 overflow-hidden rounded-b-2xl sm:rounded-b-3xl"
          aria-hidden="true"
        >
          <div
            :key="progressKey"
            class="banner-progress h-full w-full bg-ink"
            :style="{ animationDuration: `${autoplayMs}ms` }"
          ></div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
@keyframes banner-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.banner-progress {
  transform-origin: left center;
  animation-name: banner-progress;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

/* Extra small breakpoint untuk HP kecil & fold portrait */
@media (min-width: 380px) {
  .xs\:px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .xs\:px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
  .xs\:py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
  .xs\:min-h-\[240px\] { min-height: 240px; }
  .xs\:w-24 { width: 6rem; }
  .xs\:w-56 { width: 14rem; }
  .xs\:h-56 { height: 14rem; }
  .xs\:max-w-\[22rem\] { max-width: 22rem; }
  .xs\:text-\[10px\] { font-size: 10px; }
  .xs\:text-\[11px\] { font-size: 11px; }
  .xs\:text-\[11\.5px\] { font-size: 11.5px; }
  .xs\:text-\[12\.5px\] { font-size: 12.5px; }
  .xs\:text-\[24px\] { font-size: 24px; }
  .xs\:text-xl { font-size: 1.25rem; line-height: 1.75rem; }
  .xs\:text-lg { font-size: 1.125rem; line-height: 1.75rem; }
  .xs\:gap-3 { gap: 0.75rem; }
  .xs\:block { display: block; }
}
</style>
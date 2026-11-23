import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export type FloatingPlacement = 'bottom' | 'top'

interface FloatingOptions {
  /** Jarak antara trigger dan panel (px). */
  gap?: number
  /** Lebar minimum panel (px). */
  minWidth?: number
  /** Perkiraan tinggi panel sebelum benar-benar ter-render (px). */
  estimatedHeight?: number
}

/**
 * Panel mengambang (dropdown/calendar) yang selalu terlihat di dalam viewport.
 * Panel diposisikan fixed dan otomatis membalik ke atas bila ruang di bawah
 * tidak cukup, serta mengikuti trigger saat halaman di-scroll.
 */
export function useFloatingPanel(
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  open: Ref<boolean>,
  options: FloatingOptions = {},
) {
  const gap = options.gap ?? 6
  const minWidth = options.minWidth ?? 180
  const estimatedHeight = options.estimatedHeight ?? 300

  const placement = ref<FloatingPlacement>('bottom')
  const left = ref(0)
  const top = ref(0)
  const bottom = ref(0)
  const width = ref(minWidth)
  const maxHeight = ref(estimatedHeight)

  function update() {
    if (typeof window === 'undefined') return
    const anchor = trigger.value
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth
    const viewportHeight = window.innerHeight
    const naturalHeight = panel.value?.scrollHeight || estimatedHeight

    const spaceBelow = viewportHeight - rect.bottom - gap - 8
    const spaceAbove = rect.top - gap - 8
    const nextPlacement: FloatingPlacement =
      spaceBelow < Math.min(naturalHeight, 240) && spaceAbove > spaceBelow ? 'top' : 'bottom'

    const nextWidth = Math.min(Math.max(rect.width, minWidth), viewportWidth - 16)

    placement.value = nextPlacement
    width.value = nextWidth
    left.value = Math.max(8, Math.min(rect.left, viewportWidth - nextWidth - 8))
    maxHeight.value = Math.max(160, Math.min(naturalHeight || estimatedHeight, nextPlacement === 'bottom' ? spaceBelow : spaceAbove))

    if (nextPlacement === 'bottom') {
      top.value = rect.bottom + gap
    } else {
      bottom.value = viewportHeight - rect.top + gap
    }
  }

  function detach() {
    if (typeof window === 'undefined') return
    window.removeEventListener('scroll', update, true)
    window.removeEventListener('resize', update)
  }

  watch(open, async (isOpen) => {
    if (typeof window === 'undefined') return
    if (!isOpen) {
      detach()
      return
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    await nextTick()
    update()
  })

  onBeforeUnmount(detach)

  const style = computed<Record<string, string>>(() => {
    const base: Record<string, string> = {
      left: `${left.value}px`,
      width: `${width.value}px`,
      maxHeight: `${maxHeight.value}px`,
    }
    if (placement.value === 'bottom') base.top = `${top.value}px`
    else base.bottom = `${bottom.value}px`
    return base
  })

  return { placement, style, update }
}

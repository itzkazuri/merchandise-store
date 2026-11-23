<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useFloatingPanel } from '@/composables/useFloatingPanel'

const props = withDefaults(
  defineProps<{
    /** Tanggal dalam format YYYY-MM-DD. String kosong berarti belum dipilih. */
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    block?: boolean
    variant?: 'store' | 'admin'
    size?: 'sm' | 'md'
    min?: string
    max?: string
    ariaLabel?: string
    /** Izinkan mengosongkan tanggal. */
    clearable?: boolean
  }>(),
  {
    modelValue: '',
    placeholder: 'Pilih tanggal',
    disabled: false,
    block: false,
    variant: 'store',
    size: 'md',
    clearable: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const uid = useId()
const trigger = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const open = ref(false)

const { style: panelStyle } = useFloatingPanel(trigger, panel, open, {
  minWidth: 288,
  estimatedHeight: 350,
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function parseISO(value: string | undefined) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  return { year, month, day, date }
}

const selected = computed(() => parseISO(props.modelValue))
const today = new Date()
const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate())

const viewYear = ref(selected.value?.year ?? today.getFullYear())
const viewMonth = ref(selected.value?.month ?? today.getMonth())
const focusISO = ref(selected.value ? props.modelValue : todayISO)

const displayLabel = computed(() => {
  if (!selected.value) return props.placeholder
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(selected.value.date)
})

const monthLabel = computed(() => `${MONTHS[viewMonth.value]} ${viewYear.value}`)
const hasValue = computed(() => Boolean(props.modelValue))

const triggerClass = computed(() => {
  if (props.variant === 'admin') {
    return [
      props.size === 'sm' ? 'h-[38px]' : 'h-10',
      'rounded-lg border border-[#ddd9ce] bg-white px-2.5 text-xs font-semibold text-[#3f4852] hover:border-[#cfc9bb]',
    ]
  }
  return [
    props.size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm sm:h-11',
    'rounded-full border-2 border-ink bg-white font-semibold text-ink hover:bg-soft/60',
  ]
})

const panelClass = computed(() =>
  props.variant === 'admin'
    ? 'rounded-xl border border-[#ddd9ce] shadow-[0_16px_40px_rgba(27,36,48,0.18)]'
    : 'rounded-xl border-2 border-ink shadow-[4px_4px_0_#1B2430]',
)

interface DayCell {
  iso: string
  day: number
  label: string
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  disabled: boolean
}

const dayLabelFormat = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' })

const days = computed<DayCell[]>(() => {
  const firstWeekday = new Date(viewYear.value, viewMonth.value, 1).getDay()
  const cells: DayCell[] = []

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(viewYear.value, viewMonth.value, 1 - firstWeekday + index)
    const iso = toISO(date.getFullYear(), date.getMonth(), date.getDate())
    const beforeMin = Boolean(props.min && iso < props.min)
    const afterMax = Boolean(props.max && iso > props.max)
    cells.push({
      iso,
      day: date.getDate(),
      label: dayLabelFormat.format(date),
      inMonth: date.getMonth() === viewMonth.value,
      isToday: iso === todayISO,
      isSelected: iso === props.modelValue,
      disabled: beforeMin || afterMax,
    })
  }

  return cells
})

function shiftMonth(delta: number) {
  const next = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = next.getFullYear()
  viewMonth.value = next.getMonth()
}

function openPanel() {
  if (props.disabled || open.value) return
  const base = selected.value ?? parseISO(todayISO)
  if (base) {
    viewYear.value = base.year
    viewMonth.value = base.month
    focusISO.value = props.modelValue || todayISO
  }
  open.value = true
  void nextTick(() => focusDay(focusISO.value))
}

function closePanel(refocus = true) {
  if (!open.value) return
  open.value = false
  if (refocus && panel.value?.contains(document.activeElement)) trigger.value?.focus()
}

function togglePanel() {
  if (open.value) closePanel()
  else openPanel()
}

function focusDay(iso: string) {
  const next = panel.value?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)
  next?.focus()
}

function pick(cell: DayCell) {
  if (cell.disabled) return
  emit('update:modelValue', cell.iso)
  emit('change', cell.iso)
  closePanel()
  trigger.value?.focus()
}

function clear() {
  emit('update:modelValue', '')
  emit('change', '')
  closePanel()
  trigger.value?.focus()
}

function pickToday() {
  const date = new Date()
  const iso = toISO(date.getFullYear(), date.getMonth(), date.getDate())
  const beforeMin = Boolean(props.min && iso < props.min)
  const afterMax = Boolean(props.max && iso > props.max)
  if (beforeMin || afterMax) return
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
  emit('update:modelValue', iso)
  emit('change', iso)
  closePanel()
  trigger.value?.focus()
}

function moveFocus(deltaDays: number) {
  const base = parseISO(focusISO.value)
  if (!base) return
  const next = new Date(base.year, base.month, base.day + deltaDays)
  const iso = toISO(next.getFullYear(), next.getMonth(), next.getDate())
  viewYear.value = next.getFullYear()
  viewMonth.value = next.getMonth()
  focusISO.value = iso
  void nextTick(() => focusDay(iso))
}

function onDayKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closePanel()
      return
    case 'ArrowLeft':
      event.preventDefault()
      moveFocus(-1)
      return
    case 'ArrowRight':
      event.preventDefault()
      moveFocus(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      moveFocus(-7)
      return
    case 'ArrowDown':
      event.preventDefault()
      moveFocus(7)
      return
    case 'Home': {
      event.preventDefault()
      const base = parseISO(focusISO.value)
      if (base) moveFocus(-base.date.getDay())
      return
    }
    case 'End': {
      event.preventDefault()
      const base = parseISO(focusISO.value)
      if (base) moveFocus(6 - base.date.getDay())
      return
    }
    case 'PageUp':
      event.preventDefault()
      shiftMonth(-1)
      return
    case 'PageDown':
      event.preventDefault()
      shiftMonth(1)
      return
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (!open.value && ['ArrowDown', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    openPanel()
  } else if (open.value && event.key === 'Escape') {
    event.preventDefault()
    closePanel()
  }
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (!target) return
  if (trigger.value?.contains(target) || panel.value?.contains(target)) return
  closePanel()
}

watch(open, (isOpen) => {
  if (typeof document === 'undefined') return
  if (isOpen) document.addEventListener('pointerdown', onPointerDown, true)
  else document.removeEventListener('pointerdown', onPointerDown, true)
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('pointerdown', onPointerDown, true)
})
</script>

<template>
  <div class="relative" :class="{ 'w-full': block }">
    <button
      :id="`date-trigger-${uid}`"
      ref="trigger"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-controls="open ? `date-panel-${uid}` : undefined"
      :disabled="disabled"
      class="inline-flex items-center justify-between gap-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      :class="[triggerClass, block ? 'w-full' : 'max-w-full', open ? 'border-sun' : '']"
      @click="togglePanel"
      @keydown="onTriggerKeydown"
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <CalendarDays :size="14" :stroke-width="2.4" class="shrink-0 text-ink/55" />
        <span class="truncate" :class="hasValue ? '' : 'text-ink/45'">{{ displayLabel }}</span>
      </span>
      <ChevronDown
        :size="15"
        :stroke-width="2.4"
        class="shrink-0 text-ink/55 transition-transform duration-150"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :id="`date-panel-${uid}`"
        ref="panel"
        role="dialog"
        :aria-label="ariaLabel || 'Pilih tanggal'"
        class="fixed z-[120] overflow-y-auto bg-white p-2.5"
        :class="panelClass"
        :style="panelStyle"
        @keydown="onDayKeydown"
      >
        <div class="flex items-center justify-between gap-2 pb-2">
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg border-2 border-ink/10 text-ink transition-colors hover:border-ink/25 hover:bg-soft"
            aria-label="Bulan sebelumnya"
            @click="shiftMonth(-1)"
          >
            <ChevronLeft :size="15" :stroke-width="2.6" />
          </button>
          <p class="font-head text-sm font-bold text-ink" aria-live="polite">{{ monthLabel }}</p>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg border-2 border-ink/10 text-ink transition-colors hover:border-ink/25 hover:bg-soft"
            aria-label="Bulan berikutnya"
            @click="shiftMonth(1)"
          >
            <ChevronRight :size="15" :stroke-width="2.6" />
          </button>
        </div>

        <div class="grid grid-cols-7 gap-0.5 pb-1">
          <span
            v-for="day in WEEKDAYS"
            :key="day"
            class="grid h-7 place-items-center text-[10px] font-extrabold uppercase tracking-wide text-ink/40"
          >{{ day }}</span>
        </div>

        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="cell in days"
            :key="cell.iso"
            type="button"
            :data-iso="cell.iso"
            :disabled="cell.disabled"
            :aria-label="cell.label"
            :aria-current="cell.isToday ? 'date' : undefined"
            :aria-pressed="cell.isSelected"
            class="grid h-8 place-items-center rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
            :class="[
              cell.isSelected
                ? 'border-2 border-ink bg-sun text-ink'
                : cell.inMonth
                  ? 'text-ink hover:bg-soft'
                  : 'text-ink/30 hover:bg-soft/60',
              cell.isToday && !cell.isSelected ? 'ring-2 ring-ink/20' : '',
              cell.disabled ? 'cursor-not-allowed opacity-30 hover:bg-transparent' : 'cursor-pointer',
            ]"
            @click="pick(cell)"
          >
            {{ cell.day }}
          </button>
        </div>

        <div class="mt-2 flex items-center justify-between gap-2 border-t-2 border-dashed border-ink/10 pt-2">
          <button
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-bold text-ink/70 transition-colors hover:bg-soft hover:text-ink"
            @click="pickToday"
          >
            Hari ini
          </button>
          <button
            v-if="clearable"
            type="button"
            class="rounded-full px-2.5 py-1 text-[11px] font-bold text-ink/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            @click="clear"
          >
            Kosongkan
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

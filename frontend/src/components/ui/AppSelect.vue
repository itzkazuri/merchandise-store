<script setup lang="ts" generic="T extends string | number | null">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { Check, ChevronDown, Search } from 'lucide-vue-next'
import { useFloatingPanel } from '@/composables/useFloatingPanel'

interface SelectOption {
  value: T
  label: string
  description?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: T
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
    /** Tampilkan kolom pencarian di dalam panel. */
    searchable?: boolean
    /** Lebar penuh mengikuti container (dipakai di form admin). */
    block?: boolean
    variant?: 'store' | 'admin'
    size?: 'sm' | 'md'
    ariaLabel?: string
    id?: string
    searchPlaceholder?: string
  }>(),
  {
    placeholder: 'Pilih opsi',
    disabled: false,
    searchable: false,
    block: false,
    variant: 'store',
    size: 'md',
    searchPlaceholder: 'Cari…',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
  change: [value: T]
}>()

const uid = useId()
const listboxId = `select-${uid}`
const buttonId = computed(() => props.id || `select-trigger-${uid}`)

const trigger = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')
const activeIndex = ref(-1)

const { style: panelStyle } = useFloatingPanel(trigger, panel, open, {
  minWidth: 200,
  estimatedHeight: 280,
})

const selectedOption = computed(
  () => props.options.find((option) => option.value === props.modelValue) ?? null,
)

const filteredOptions = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!props.searchable || !keyword) return props.options
  return props.options.filter((option) => {
    const haystack = `${option.label} ${option.description ?? ''}`.toLowerCase()
    return haystack.includes(keyword)
  })
})

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

function isSelected(option: SelectOption) {
  return option.value === props.modelValue
}

function setActive(index: number) {
  activeIndex.value = index
  void nextTick(() => {
    panel.value
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function moveActive(delta: number) {
  const list = filteredOptions.value
  if (!list.length) return
  let index = activeIndex.value
  for (let step = 0; step < list.length; step += 1) {
    index = (index + delta + list.length) % list.length
    if (!list[index]?.disabled) {
      setActive(index)
      return
    }
  }
}

function openPanel() {
  if (props.disabled || open.value) return
  query.value = ''
  open.value = true
  const selectedIndex = filteredOptions.value.findIndex(isSelected)
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : filteredOptions.value.findIndex((option) => !option.disabled)
  if (activeIndex.value < 0) activeIndex.value = 0

  void nextTick(() => {
    if (props.searchable) {
      searchInput.value?.focus()
      return
    }
    setActive(activeIndex.value)
  })
}

function closePanel(refocus = true) {
  if (!open.value) return
  open.value = false
  query.value = ''
  if (refocus && panel.value?.contains(document.activeElement)) trigger.value?.focus()
}

function togglePanel() {
  if (open.value) closePanel()
  else openPanel()
}

function selectOption(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  closePanel()
  trigger.value?.focus()
}

let typed = ''
let typeTimer: ReturnType<typeof setTimeout> | undefined

function typeahead(character: string) {
  typed += character.toLowerCase()
  clearTimeout(typeTimer)
  typeTimer = setTimeout(() => { typed = '' }, 600)
  const index = filteredOptions.value.findIndex(
    (option) => !option.disabled && option.label.toLowerCase().startsWith(typed),
  )
  if (index >= 0) setActive(index)
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openPanel()
    }
    return
  }

  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closePanel()
      return
    case 'Tab':
      closePanel(false)
      return
    case 'ArrowDown':
      event.preventDefault()
      moveActive(1)
      return
    case 'ArrowUp':
      event.preventDefault()
      moveActive(-1)
      return
    case 'Home':
      event.preventDefault()
      setActive(0)
      return
    case 'End':
      event.preventDefault()
      setActive(filteredOptions.value.length - 1)
      return
    case 'Enter': {
      event.preventDefault()
      const option = filteredOptions.value[activeIndex.value]
      if (option) selectOption(option)
      return
    }
  }

  if (!props.searchable && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    typeahead(event.key)
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

watch(filteredOptions, (list) => {
  if (!open.value || !list.length) return
  if (activeIndex.value > list.length - 1) activeIndex.value = list.length - 1
})

onBeforeUnmount(() => {
  clearTimeout(typeTimer)
  if (typeof document !== 'undefined') document.removeEventListener('pointerdown', onPointerDown, true)
})
</script>

<template>
  <div class="relative" :class="{ 'w-full': block }">
    <button
      :id="buttonId"
      ref="trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      :aria-controls="open ? listboxId : undefined"
      :aria-activedescendant="open ? `${listboxId}-option-${activeIndex}` : undefined"
      :disabled="disabled"
      class="inline-flex items-center justify-between gap-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      :class="[triggerClass, block ? 'w-full' : 'max-w-full', open ? 'border-sun' : '']"
      @click="togglePanel"
      @keydown="onKeydown"
    >
      <span
        class="min-w-0 flex-1 truncate"
        :class="selectedOption ? '' : 'text-ink/45'"
      >
        {{ selectedOption?.label ?? placeholder }}
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
        :id="listboxId"
        ref="panel"
        role="listbox"
        :aria-label="ariaLabel"
        class="fixed z-[120] flex flex-col overflow-hidden bg-white"
        :class="panelClass"
        :style="panelStyle"
        @keydown="onKeydown"
      >
        <div v-if="searchable" class="shrink-0 border-b border-ink/10 p-2">
          <label class="relative block">
            <Search :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="searchPlaceholder"
              class="h-9 w-full rounded-lg border-2 border-ink/15 bg-white pl-8 pr-2 text-sm font-semibold text-ink placeholder:font-medium placeholder:text-ink/35 focus:border-sun focus:outline-none"
            />
          </label>
        </div>

        <ul class="min-h-0 flex-1 overflow-y-auto p-1.5">
          <li v-for="(option, index) in filteredOptions" :key="`${String(option.value)}-${index}`">
            <div
              :id="`${listboxId}-option-${index}`"
              :data-index="index"
              role="option"
              :aria-selected="isSelected(option)"
              :aria-disabled="option.disabled || undefined"
              class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors"
              :class="[
                option.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                activeIndex === index && !option.disabled ? 'bg-soft' : '',
                isSelected(option) ? 'text-ink' : 'text-ink/75',
              ]"
              @mouseenter="option.disabled ? undefined : setActive(index)"
              @click="selectOption(option)"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ option.label }}</span>
                <small v-if="option.description" class="block truncate text-[11px] font-medium leading-snug text-ink/45">
                  {{ option.description }}
                </small>
              </span>
              <Check v-if="isSelected(option)" :size="14" :stroke-width="2.8" class="shrink-0 text-ink" />
            </div>
          </li>
        </ul>

        <p v-if="!filteredOptions.length" class="px-3.5 pb-3 text-xs font-semibold text-ink/45">
          Tidak ada pilihan.
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Delete } from 'lucide-vue-next'

type Operator = 'add' | 'subtract' | 'multiply' | 'divide'

const emit = defineEmits<{ use: [value: number] }>()

const display = ref('0')
const accumulator = ref<number | null>(null)
const pending = ref<Operator | null>(null)
const fresh = ref(true)
const history = ref('')
const isError = ref(false)

const OP_SYMBOL: Record<Operator, string> = { add: '+', subtract: '−', multiply: '×', divide: '÷' }

/* ---------- Kelas Tailwind (dipisah supaya template tetap rapi) ---------- */
const keyBase =
  'h-12 rounded-xl border-2 border-ink font-body text-base font-extrabold cursor-pointer select-none ' +
  'shadow-[2px_2px_0_#1B2430] transition-[transform,box-shadow,background-color] duration-100 ' +
  'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'

const keyNum = `${keyBase} bg-white text-ink hover:bg-muted`
const keySoft = `${keyBase} bg-soft text-ink hover:bg-pinky`
const keyOp = `${keyBase} bg-sky text-ink hover:bg-[#bfe3f5]`
const keyEq = `${keyBase} row-span-2 h-auto bg-ink text-bg text-xl hover:bg-[#34404d]`

/* ---------- Tampilan ---------- */
const pretty = computed(() => {
  if (isError.value) return 'Error'
  const [rawInt = '0', decPart] = display.value.split('.')
  const sign = rawInt.startsWith('-') ? '-' : ''
  const digits = sign ? rawInt.slice(1) : rawInt || '0'
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${grouped}${decPart !== undefined ? `,${decPart}` : ''}`
})

// Angka besar otomatis mengecil supaya tidak terpotong
const valueSize = computed(() => {
  const len = pretty.value.length
  if (len > 14) return 'text-2xl'
  if (len > 10) return 'text-3xl'
  return 'text-4xl'
})

function grouped(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)
}

/* ---------- Logika ---------- */
function currentValue() {
  const parsed = Number(display.value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function clearAll() {
  display.value = '0'
  accumulator.value = null
  pending.value = null
  fresh.value = true
  history.value = ''
  isError.value = false
}

function digit(value: string) {
  if (isError.value) clearAll()
  if (fresh.value) {
    // "00" di awal angka tidak berarti apa-apa
    display.value = value === '.' ? '0.' : value === '00' ? '0' : value
    fresh.value = value === '00' || value === '0'
    return
  }
  if (value === '.' && display.value.includes('.')) return
  if (display.value.replace(/[-.]/g, '').length >= 12) return
  display.value = display.value === '0' && value !== '.' ? (value === '00' ? '0' : value) : `${display.value}${value}`
}

function backspace() {
  if (isError.value) { clearAll(); return }
  if (fresh.value) return
  display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0'
  if (display.value === '0' || display.value === '-') {
    display.value = '0'
    fresh.value = true
  }
}

function compute(left: number, right: number, operator: Operator) {
  switch (operator) {
    case 'add': return round(left + right)
    case 'subtract': return round(left - right)
    case 'multiply': return round(left * right)
    case 'divide': return right === 0 ? Number.NaN : round(left / right)
  }
}

function fail() {
  isError.value = true
  display.value = '0'
  pending.value = null
  accumulator.value = null
  fresh.value = true
}

function chooseOperator(operator: Operator) {
  if (isError.value) return
  const value = currentValue()
  if (pending.value !== null && accumulator.value !== null && !fresh.value) {
    const result = compute(accumulator.value, value, pending.value)
    if (!Number.isFinite(result)) { fail(); return }
    accumulator.value = result
    display.value = String(result)
  } else if (accumulator.value === null) {
    accumulator.value = value
  }
  pending.value = operator
  fresh.value = true
  history.value = `${grouped(accumulator.value ?? value)} ${OP_SYMBOL[operator]}`
}

function equals() {
  if (isError.value || pending.value === null || accumulator.value === null) return
  const right = currentValue()
  const result = compute(accumulator.value, right, pending.value)
  history.value = `${grouped(accumulator.value)} ${OP_SYMBOL[pending.value]} ${grouped(right)} =`
  if (!Number.isFinite(result)) { fail(); return }
  display.value = String(result)
  accumulator.value = null
  pending.value = null
  fresh.value = true
}

function useValue() {
  if (isError.value) return
  emit('use', Math.max(0, Math.round(currentValue())))
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.isContentEditable)) return
  const key = event.key
  if (/^[0-9]$/.test(key)) { digit(key); event.preventDefault() }
  else if (key === '.' || key === ',') { digit('.'); event.preventDefault() }
  else if (key === '+') { chooseOperator('add'); event.preventDefault() }
  else if (key === '-') { chooseOperator('subtract'); event.preventDefault() }
  else if (key === '*') { chooseOperator('multiply'); event.preventDefault() }
  else if (key === '/') { chooseOperator('divide'); event.preventDefault() }
  else if (key === 'Enter' || key === '=') { equals(); event.preventDefault() }
  else if (key === 'Backspace') { backspace(); event.preventDefault() }
  else if (key === 'Escape') { clearAll(); event.preventDefault() }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="nb overflow-hidden" aria-label="Kalkulator kasir">
    <!-- Layar -->
    <div class="border-b-[2.5px] border-ink bg-ink px-4 pt-3 pb-3.5 text-bg" aria-live="polite">
      <p class="min-h-4 truncate text-right text-xs font-bold tabular-nums text-sky">
        {{ history || 'Kalkulator' }}
      </p>
      <p
        class="mt-0.5 break-all text-right font-head font-semibold leading-tight tabular-nums transition-[font-size] duration-100"
        :class="[valueSize, isError ? 'text-pinky' : 'text-white']"
      >
        {{ pretty }}
      </p>
    </div>

    <!-- Tombol -->
    <div class="grid grid-cols-4 gap-2 bg-bg p-3">
      <button type="button" :class="keySoft" aria-label="Hapus semua" @click="clearAll">C</button>
      <button type="button" :class="keySoft" aria-label="Hapus satu digit" @click="backspace">
        <Delete :size="18" class="mx-auto" />
      </button>
      <button type="button" :class="keyOp" aria-label="Bagi" @click="chooseOperator('divide')">÷</button>
      <button type="button" :class="keyOp" aria-label="Kali" @click="chooseOperator('multiply')">×</button>

      <button type="button" :class="keyNum" @click="digit('7')">7</button>
      <button type="button" :class="keyNum" @click="digit('8')">8</button>
      <button type="button" :class="keyNum" @click="digit('9')">9</button>
      <button type="button" :class="keyOp" aria-label="Kurang" @click="chooseOperator('subtract')">−</button>

      <button type="button" :class="keyNum" @click="digit('4')">4</button>
      <button type="button" :class="keyNum" @click="digit('5')">5</button>
      <button type="button" :class="keyNum" @click="digit('6')">6</button>
      <button type="button" :class="keyOp" aria-label="Tambah" @click="chooseOperator('add')">+</button>

      <button type="button" :class="keyNum" @click="digit('1')">1</button>
      <button type="button" :class="keyNum" @click="digit('2')">2</button>
      <button type="button" :class="keyNum" @click="digit('3')">3</button>
      <button type="button" :class="keyEq" aria-label="Sama dengan" @click="equals">=</button>

      <button type="button" :class="keyNum" @click="digit('00')">00</button>
      <button type="button" :class="keyNum" @click="digit('0')">0</button>
      <button type="button" :class="keyNum" aria-label="Koma desimal" @click="digit('.')">,</button>
    </div>

    <!-- Pakai nilai -->
    <div class="border-t-[2.5px] border-ink bg-white p-3">
      <button
        type="button"
        class="btn h-11 w-full gap-2 bg-sun font-head text-sm font-semibold text-ink hover:bg-[#f7c966] disabled:hover:bg-sun"
        :disabled="isError"
        @click="useValue"
      >
        <Check :size="16" />
        Pakai {{ pretty }}
      </button>
    </div>
  </section>
</template>
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

const pretty = computed(() => {
  if (isError.value) return 'Error'
  const [rawInt = '0', decPart] = display.value.split('.')
  const sign = rawInt.startsWith('-') ? '-' : ''
  const digits = sign ? rawInt.slice(1) : (rawInt || '0')
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${grouped}${decPart !== undefined ? `,${decPart}` : ''}`
})

function grouped(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)
}

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
    display.value = value === '.' ? '0.' : value
    fresh.value = false
    return
  }
  if (value === '.' && display.value.includes('.')) return
  if (display.value.replace(/[-.]/g, '').length >= 12) return
  display.value = display.value === '0' && value !== '.' ? value : `${display.value}${value}`
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

function chooseOperator(operator: Operator) {
  if (isError.value) return
  const value = currentValue()
  if (pending.value !== null && accumulator.value !== null && !fresh.value) {
    const result = compute(accumulator.value, value, pending.value)
    if (!Number.isFinite(result)) { isError.value = true; pending.value = null; accumulator.value = null; fresh.value = true; return }
    accumulator.value = result
    display.value = String(result)
  } else {
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
  if (!Number.isFinite(result)) {
    isError.value = true
    display.value = '0'
    pending.value = null
    accumulator.value = null
    fresh.value = true
    return
  }
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
  <section class="pos-calculator" aria-label="Kalkulator kasir">
    <div class="pos-calculator__display" aria-live="polite">
      <p class="pos-calculator__history">{{ history || 'Kalkulator' }}</p>
      <p class="pos-calculator__value">{{ pretty }}</p>
    </div>

    <div class="pos-calculator__keys">
      <button type="button" class="calc-key calc-key--soft" @click="clearAll">C</button>
      <button type="button" class="calc-key calc-key--soft" aria-label="Hapus satu digit" @click="backspace"><Delete :size="17" :stroke-width="2" /></button>
      <button type="button" class="calc-key calc-key--op" aria-label="Bagi" @click="chooseOperator('divide')">÷</button>
      <button type="button" class="calc-key calc-key--op" aria-label="Kali" @click="chooseOperator('multiply')">×</button>

      <button type="button" class="calc-key" @click="digit('7')">7</button>
      <button type="button" class="calc-key" @click="digit('8')">8</button>
      <button type="button" class="calc-key" @click="digit('9')">9</button>
      <button type="button" class="calc-key calc-key--op" aria-label="Kurang" @click="chooseOperator('subtract')">−</button>

      <button type="button" class="calc-key" @click="digit('4')">4</button>
      <button type="button" class="calc-key" @click="digit('5')">5</button>
      <button type="button" class="calc-key" @click="digit('6')">6</button>
      <button type="button" class="calc-key calc-key--op" aria-label="Tambah" @click="chooseOperator('add')">+</button>

      <button type="button" class="calc-key" @click="digit('1')">1</button>
      <button type="button" class="calc-key" @click="digit('2')">2</button>
      <button type="button" class="calc-key" @click="digit('3')">3</button>
      <button type="button" class="calc-key calc-key--eq" aria-label="Sama dengan" @click="equals">=</button>

      <button type="button" class="calc-key" @click="digit('00')">00</button>
      <button type="button" class="calc-key" @click="digit('0')">0</button>
      <button type="button" class="calc-key" @click="digit('.')">,</button>
    </div>

    <button type="button" class="pos-calculator__use" @click="useValue">
      <Check :size="15" /> Pakai {{ pretty }}
    </button>
  </section>
</template>

<style scoped>
.pos-calculator {
  overflow: hidden;
  border: 1px solid #e3ddcf;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px #1b24300a;
}

.pos-calculator__display {
  padding: 11px 14px;
  background: #1b2430;
  color: #fff;
}

.pos-calculator__history {
  min-height: 14px;
  margin: 0;
  overflow: hidden;
  color: #b9c2cb;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pos-calculator__value {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  font: 600 26px var(--font-head);
  line-height: 1.15;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pos-calculator__keys {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
}

.calc-key {
  height: 42px;
  border: 1px solid #e0dbcf;
  border-radius: 8px;
  background: #fbfaf6;
  color: #1b2430;
  font: 700 15px var(--font-body);
  cursor: pointer;
  transition: background 0.12s, transform 0.05s;
}

.calc-key:hover {
  background: #f2eee4;
}

.calc-key:active {
  transform: scale(0.97);
}

.calc-key--soft {
  background: #f1ede4;
  color: #5f6770;
}

.calc-key--op {
  background: #fff2cf;
  border-color: #e6cf95;
  color: #6a4a06;
}

.calc-key--eq {
  grid-row: span 2;
  background: #1b2430;
  border-color: #1b2430;
  color: #fff;
}

.calc-key--eq:hover {
  background: #34404d;
}

.pos-calculator__use {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: calc(100% - 16px);
  height: 38px;
  margin: 0 8px 8px;
  border: 1px solid #d9a92c;
  border-radius: 8px;
  background: #f4c45a;
  color: #3f2c00;
  font: 700 12.5px var(--font-body);
  cursor: pointer;
}

.pos-calculator__use:hover {
  background: #f7d075;
}
</style>

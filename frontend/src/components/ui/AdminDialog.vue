<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import '@/assets/admin-dialog.css'

const props = defineProps<{ modelValue: boolean; title: string; description?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let previousOverflow = ''

function lockScroll() {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}
function unlockScroll() {
  document.body.style.overflow = previousOverflow
}

watch(() => props.modelValue, async (open) => {
  await nextTick()
  if (!dialog.value) return
  if (open && !dialog.value.open) {
    lockScroll()
    dialog.value.showModal()
  } else if (!open && dialog.value.open) dialog.value.close()
}, { immediate: true })

function close() { emit('update:modelValue', false) }
function onClose() { unlockScroll(); if (props.modelValue) close() }
function onBackdrop(event: MouseEvent) { if (event.target === dialog.value) close() }
onBeforeUnmount(() => { unlockScroll(); if (dialog.value?.open) dialog.value.close() })
</script>

<template>
  <dialog ref="dialog" class="admin-dialog" :aria-label="title" @close="onClose" @cancel.prevent="close" @click="onBackdrop">
    <header class="admin-dialog__header">
      <div><h2>{{ title }}</h2><p v-if="description">{{ description }}</p></div>
      <button type="button" class="admin-icon-button" aria-label="Tutup dialog" @click="close"><X :size="19" /></button>
    </header>
    <div class="admin-dialog__body"><slot /></div>
    <footer v-if="$slots.footer" class="admin-dialog__footer"><slot name="footer" /></footer>
  </dialog>
</template>

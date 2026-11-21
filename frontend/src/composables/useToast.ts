import { ref } from 'vue'

const message = ref('')
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

export function useToast() {
  function showToast(msg: string, duration = 1800) {
    message.value = msg
    visible.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
    }, duration)
  }

  function hideToast() {
    visible.value = false
    if (timer) clearTimeout(timer)
  }

  return {
    message,
    visible,
    showToast,
    hideToast,
  }
}

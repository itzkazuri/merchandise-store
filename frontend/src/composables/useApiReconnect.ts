import { onBeforeUnmount, onMounted } from 'vue'
import { API_ONLINE_EVENT } from '@/lib/connectivity'

/**
 * Jalankan handler ketika backend kembali bisa dihubungi (setelah mode offline).
 * Aman dipanggil saat SSR karena listener hanya dipasang di client.
 */
export function useApiReconnect(handler: () => void) {
  onMounted(() => {
    window.addEventListener(API_ONLINE_EVENT, handler)
  })
  onBeforeUnmount(() => {
    window.removeEventListener(API_ONLINE_EVENT, handler)
  })
}

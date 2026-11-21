import { createApp, createSSRApp, type App as VueApp } from 'vue'
import type { Router, RouterHistory } from 'vue-router'
import App from './App.vue'
import { createAppRouter } from './router'

export interface CreateAppOptions {
  /** Pakai `createSSRApp` agar Vue bisa hydrate markup hasil SSR. */
  ssr?: boolean
  /** Default: createWebHistory. Untuk SSR pakai createMemoryHistory(). */
  history?: RouterHistory
}

export interface MochibakoApp {
  app: VueApp
  router: Router
}

/**
 * Factory aplikasi bersama untuk entry client (SPA/hydration) dan entry server.
 * Head (unhead) dipasang oleh masing-masing entry karena implementasi client
 * dan server berbeda.
 */
export function createMochibakoApp(options: CreateAppOptions = {}): MochibakoApp {
  const app = options.ssr ? createSSRApp(App) : createApp(App)
  const router = createAppRouter(options.history)

  app.use(router)

  // Global error handler: redirect ke /500 untuk unhandled runtime errors.
  app.config.errorHandler = (err) => {
    console.error('[App Error]', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (router.currentRoute.value.name === 'server-error') return
    void router.replace({ name: 'server-error', query: { error: msg } }).catch(() => {})
  }

  return { app, router }
}

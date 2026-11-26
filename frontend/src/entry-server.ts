import { createHead, renderSSRHead } from '@unhead/vue/server'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory } from 'vue-router'
import { createMochibakoApp } from './app'
import { setAppState, type AppInitialState } from './lib/appState'

export interface RenderResult {
  appHtml: string
  head: ReturnType<typeof renderSSRHead>
  /** Konten Teleport (mis. modal login) per target, untuk ditempel di <body>. */
  teleports: Record<string, string>
}

/**
 * Render satu URL menjadi HTML + tag <head>.
 * Dipakai oleh server SSR/prerender: `const { appHtml, head } = await render(url)`.
 * `initialState` diisi data yang sudah diambil lebih dulu supaya render pertama
 * di client bisa hidrasi tanpa mismatch.
 */
export async function render(url: string, initialState: AppInitialState = {}): Promise<RenderResult> {
  setAppState(initialState)

  const { app, router } = createMochibakoApp({
    ssr: true,
    history: createMemoryHistory(),
  })
  const head = createHead()

  app.use(head)

  await router.push(url)
  await router.isReady()

  // Teleport (mis. <Teleport to="body"> pada modal login) dirender terpisah
  // dan HARUS ikut ditempel ke HTML. Tanpa anchor ini, hidrasi di browser
  // menganggap isi <body> sebagai konten teleport dan menghapus #app.
  const context: { teleports?: Record<string, string> } = {}
  const appHtml = await renderToString(app, context)
  const headPayload = renderSSRHead(head)

  return { appHtml, head: headPayload, teleports: context.teleports ?? {} }
}

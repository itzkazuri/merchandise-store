import { createHead, renderSSRHead } from '@unhead/vue/server'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory } from 'vue-router'
import { createMochibakoApp } from './app'

export interface RenderResult {
  appHtml: string
  head: ReturnType<typeof renderSSRHead>
}

/**
 * Render satu URL menjadi HTML + tag <head>.
 * Dipakai oleh server SSR/prerender: `const { appHtml, head } = await render(url)`.
 */
export async function render(url: string): Promise<RenderResult> {
  const { app, router } = createMochibakoApp({
    ssr: true,
    history: createMemoryHistory(),
  })
  const head = createHead()

  app.use(head)

  await router.push(url)
  await router.isReady()

  const appHtml = await renderToString(app)
  const headPayload = renderSSRHead(head)

  return { appHtml, head: headPayload }
}

import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { imageOptimizerPlugin } from './scripts/vite-plugin-image-optimizer.ts'
import { prerenderPreviewPlugin } from './scripts/vite-plugin-prerender-preview.ts'

const midtransCspSources = [
  'https://*.midtrans.com',
  'https://*.veritrans.co.id',
  'https://*.cloudfront.net',
  'https://*.mixpanel.com',
  'https://*.google-analytics.com',
].join(' ')
// https://vite.dev/config/
export default defineConfig(({ isSsrBuild, mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, envDir, 'VITE_')
  const defaultApiOrigin = 'http://localhost:8000'
  const apiOrigin = new URL(
    env.VITE_API_BASE_URL || env.VITE_API_ORIGIN || `${defaultApiOrigin}/api/v1`,
    env.VITE_API_ORIGIN || defaultApiOrigin,
  ).origin
  const allowedHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  const apiProxy = {
    target: apiOrigin,
    changeOrigin: true,
    secure: apiOrigin.startsWith('https://'),
  }
  const tunnelWebSocketSources = allowedHosts.map((host) => `wss://${host}`)
  const mediaOrigin = new URL(
    env.VITE_STORAGE_ORIGIN || env.VITE_MEDIA_BASE_URL || 'http://127.0.0.1:9000',
  ).origin
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' https://accounts.google.com ${midtransCspSources}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${midtransCspSources}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: https: ${mediaOrigin} http://localhost:9000`,
    `connect-src 'self' ${apiOrigin} https://accounts.google.com https://oauth2.googleapis.com ${midtransCspSources} ${tunnelWebSocketSources.join(' ')} ws://localhost:5173 ws://127.0.0.1:5173`,
    `frame-src https://accounts.google.com ${midtransCspSources}`,
  ].join('; ')

  return {
    envDir,
    server: {
      allowedHosts,
      proxy: {
        '/api': { ...apiProxy },
        '/health': { ...apiProxy },
      },
      ws: allowedHosts.length ? { protocol: 'wss', clientPort: 443 } : undefined,
      headers: { 'Content-Security-Policy': contentSecurityPolicy },
    },
    preview: {
      allowedHosts,
      headers: { 'Content-Security-Policy': contentSecurityPolicy },
    },
    plugins: [
      vue(),
      vueDevTools(),
      tailwindcss(),
      imageOptimizerPlugin(),
      prerenderPreviewPlugin(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'esnext',
      cssCodeSplit: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-vue',
                test: (id) => id.includes('node_modules') && (id.includes('vue') || id.includes('vue-router')),
                priority: 30,
              },
              {
                name: 'vendor-lucide',
                test: /node_modules[\\/]lucide-vue-next/,
                priority: 20,
              },
              {
                name: 'vendor-libs',
                test: /node_modules[\\/]/,
                priority: 10,
              },
            ],
          },
          // Entry server dibuat stabil agar mudah di-import server SSR.
          entryFileNames: isSsrBuild ? 'entry-server.js' : 'assets/js/[hash].js',
          chunkFileNames: isSsrBuild ? 'assets/[hash].js' : 'assets/js/[hash].js',
          // Avoid exposing source entry/chunk names in production asset URLs.
          assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css')
            ? 'assets/css/[hash][extname]'
            : 'assets/media/[hash][extname]',
        },
      },
    },
  }
})

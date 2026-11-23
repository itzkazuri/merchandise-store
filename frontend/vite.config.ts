import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { imageOptimizerPlugin } from './scripts/vite-plugin-image-optimizer.ts'

const apiOrigin = new URL(process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').origin
const mediaOrigin = new URL(
  process.env.VITE_STORAGE_ORIGIN || process.env.VITE_MEDIA_BASE_URL || 'http://127.0.0.1:9000',
).origin
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: https: ${mediaOrigin} http://localhost:9000`,
  `connect-src 'self' ${apiOrigin} https://accounts.google.com https://oauth2.googleapis.com ws://localhost:5173 ws://127.0.0.1:5173`,
  "frame-src https://accounts.google.com",
].join('; ')

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  server: { headers: { 'Content-Security-Policy': contentSecurityPolicy } },
  preview: { headers: { 'Content-Security-Policy': contentSecurityPolicy } },
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    imageOptimizerPlugin(),
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
}))

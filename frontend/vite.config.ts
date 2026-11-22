import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { imageOptimizerPlugin } from './scripts/vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
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

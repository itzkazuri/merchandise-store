import { useHead, useSeoMeta } from '@unhead/vue'

export interface SeoOptions {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'product'
  price?: number | string
  currency?: string
  keywords?: string[]
}

const DEFAULT_TITLE = 'Mochibako – Merch & Mainan Anime'
const DEFAULT_DESC =
  'Koleksi figure, blind box, plushie, dan merchandise anime pilihan untuk ruang kecil dan hati yang penuh.'
const DEFAULT_IMAGE = '/favicon.ico'

/**
 * Universal SEO & Product Metadata Composable berbasis @unhead/vue
 * Otomatis mengelola title, meta description, Open Graph, Twitter Card,
 * dan JSON-LD Schema untuk rich snippet Google Search.
 */
export function useSeo(options: SeoOptions) {
  const fullTitle = options.title ? `${options.title} · Mochibako` : DEFAULT_TITLE
  const description = options.description || DEFAULT_DESC
  const image = options.image || DEFAULT_IMAGE

  useSeoMeta({
    title: fullTitle,
    description: description,
    ogTitle: fullTitle,
    ogDescription: description,
    ogImage: image,
    ogType: options.type === 'product' ? 'website' : (options.type || 'website'),
    ogSiteName: 'Mochibako',
    twitterCard: 'summary_large_image',
    twitterTitle: fullTitle,
    twitterDescription: description,
    twitterImage: image,
  })

  // JSON-LD Structured Data (Schema.org) untuk SEO Google
  if (options.type === 'product' && options.price) {
    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org/',
            '@type': 'Product',
            name: options.title,
            description: description,
            image: [image],
            offers: {
              '@type': 'Offer',
              priceCurrency: options.currency || 'IDR',
              price: options.price,
              availability: 'https://schema.org/InStock',
            },
          }),
        },
      ],
    })
  } else {
    useHead({
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: 'Mochibako',
            description: DEFAULT_DESC,
          }),
        },
      ],
    })
  }
}

import type { CatalogProduct } from '@/types/catalog'

/**
 * ============================================================
 *  KONFIGURASI BANNER STOREFRONT
 * ============================================================
 *
 * Semua banner diatur manual di file ini.
 * Tidak mengambil data banner dari backend.
 *
 * Tipe yang didukung:
 *  - 'style'   → banner desain dari warna, pola, dan ikon
 *  - 'image'   → banner dengan gambar (file di public/banners/)
 *  - 'product' → banner produk (ambil data API bila slug/id cocok)
 *
 * Urutan di array = urutan tampil di carousel.
 * ============================================================
 */

/** Pola latar belakang dekoratif */
export type BannerPattern = 'grid' | 'dots' | 'rays' | 'none'

/** Tone warna teks di atas gambar */
export type BannerTone = 'dark' | 'light'

/** Tombol aksi di banner */
export interface BannerCta {
  label: string
  to: string
  /** primary = kuning (sun), ghost = putih. Default: primary */
  variant?: 'primary' | 'ghost'
}

/** Field dasar yang dimiliki semua tipe banner */
interface BannerBase {
  id: string
  eyebrow?: string
  /** Untuk tipe product, title bisa dikosongkan → pakai nama produk */
  title?: string
  subtitle?: string
  /** Class Tailwind background (untuk style & product) */
  bg?: string
  pattern?: BannerPattern
  /** split = teks kiri + dekor kanan | center = teks di tengah */
  layout?: 'split' | 'center'
  /** Dua ikon dekoratif (nama Lucide, lihat DynamicIcon) */
  icons?: [string, string]
  ctas?: BannerCta[]
}

/** Banner desain murni (warna + pola + ikon) */
export interface StyleBanner extends BannerBase {
  type: 'style'
}

/** Banner berbasis gambar */
export interface ImageBanner extends BannerBase {
  type: 'image'
  src: string
  alt: string
  /** object-position, contoh: 'center', 'right center' */
  focal?: string
  /** Kekuatan overlay teks (0–1). Default 0.9 */
  overlay?: number
  tone?: BannerTone
}

/** Banner produk (prioritas data API) */
export interface ProductBanner extends BannerBase {
  type: 'product'
  /** Prioritas pencarian produk dari API */
  productSlug?: string
  productId?: number
  /**
   * Tampilan cadangan bila produk belum ada di API / offline.
   * Field yang dipakai: name, series, price, badge, spec, slug, image
   */
  fallback?: {
    name: string
    series?: string
    price: number | string
    badge?: string
    spec?: string
    slug?: string
    image?: string
  }
}

export type BannerConfig = StyleBanner | ImageBanner | ProductBanner

/** Jeda autoplay carousel (milidetik) */
export const BANNER_AUTOPLAY_MS = 7000

/**
 * ============================================================
 *  DAFTAR BANNER
 * ============================================================
 * Urutan di bawah ini menentukan urutan slide.
 * Hapus / komentari item untuk menyembunyikan banner.
 * ============================================================
 */
export const storefrontBanners: BannerConfig[] = [
  // ----------------------------------------------------------
  // 1. Style — Hero utama
  // ----------------------------------------------------------
  {
    id: 'khilaf-baru',
    type: 'style',
    eyebrow: 'Mochibako Collection',
    title: 'Khilaf? Tenang, kami sudah siapkan alasan barunya.',
    subtitle:
      'Figure, plushie, sampai blind box pilihan — dikurasi dari rilisan import dan karya UMKM lokal.',
    bg: 'bg-[#FFE9B8]',
    pattern: 'grid',
    icons: ['sparkles', 'shopping-bag'],
    ctas: [
      { label: 'Belanja sekarang', to: '/#rak', variant: 'primary' },
      { label: 'Lihat kategori', to: '/#cats', variant: 'ghost' },
    ],
  },

  // ----------------------------------------------------------
  // 2. Product — Highlight produk pilihan
  // ----------------------------------------------------------
  {
    id: 'produk-pilihan',
    type: 'product',
    eyebrow: 'Pilihan minggu ini',
    productSlug: 'hoshina-magical-girl-1-7',
    bg: 'bg-[#FFD9E6]',
    pattern: 'dots',
    icons: ['star', 'heart'],
    fallback: {
      name: 'Hoshina Magical Girl 1/7',
      series: 'Starlit Academy',
      price: 689000,
      badge: 'Pre-order',
      spec: 'PVC, tinggi 24 cm',
      slug: 'hoshina-magical-girl-1-7',
      // image: '/products/hoshina.jpg', // opsional
    },
  },

  // ----------------------------------------------------------
  // 3. Image — Banner visual
  // ----------------------------------------------------------
  {
    id: 'rak-baru',
    type: 'image',
    eyebrow: 'Cerita dari rak',
    title: 'Rak baru, cerita baru.',
    subtitle:
      'Setiap koleksi punya cerita. Temukan karakter yang paling kamu tunggu-tunggu di rak Mochibako.',
    src: '/banners/starlit-shelf.svg',
    alt: 'Ilustrasi rak koleksi dengan matahari, bintang, dan maskot kotak',
    focal: 'right center',
    overlay: 0.92,
    tone: 'dark',
    ctas: [
      { label: 'Jelajahi katalog', to: '/#rak', variant: 'primary' },
    ],
  },

  // ----------------------------------------------------------
  // 4. Style — UMKM / handmade
  // ----------------------------------------------------------
  {
    id: 'handmade-lokal',
    type: 'style',
    eyebrow: 'Karya UMKM lokal',
    title: 'Dibuat tangan, dikirim dengan hati.',
    subtitle:
      'Dukung pembuat lokal lewat plushie, aksesori, dan cetak art edisi terbatas — hanya di Mochibako.',
    bg: 'bg-[#D6EEFA]',
    pattern: 'rays',
    icons: ['heart', 'scissors'],
    ctas: [
      { label: 'Lihat yang handmade', to: '/cari?q=handmade', variant: 'primary' },
      { label: 'Semua produk', to: '/#rak', variant: 'ghost' },
    ],
  },
]
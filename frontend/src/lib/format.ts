const LOCALE = import.meta.env.VITE_LOCALE || 'id-ID'
const CURRENCY = import.meta.env.VITE_CURRENCY || 'IDR'
const TIMEZONE = import.meta.env.VITE_TIMEZONE || 'Asia/Jakarta'

export function rupiah(value: number | string | null | undefined) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount).replace(/\u00a0/g, ' ')
}

export function shortDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'medium',
    timeZone: TIMEZONE,
  }).format(new Date(value))
}

export function longDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIMEZONE,
  }).format(new Date(value))
}

export function slugLabel(value?: string | null) {
  if (!value) return ''
  return value.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

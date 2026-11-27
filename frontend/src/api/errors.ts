/** Error API yang bisa dipakai bersama tanpa saling impor dengan client. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Server API tidak bisa dihubungi (koneksi putus, DNS gagal, timeout, CORS).
 * Dibedakan dari ApiError biasa supaya UI bisa menampilkan mode offline.
 */
export class ApiNetworkError extends ApiError {
  readonly offline = true

  constructor(message = 'Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.') {
    super(0, message)
    this.name = 'ApiNetworkError'
  }
}

export function isNetworkError(cause: unknown): cause is ApiNetworkError {
  return (
    cause instanceof ApiNetworkError ||
    (cause instanceof Error && cause.name === 'ApiNetworkError')
  )
}

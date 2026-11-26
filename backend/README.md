# Merchandise Backend (FastAPI)

Backend API untuk Anime Merchandise Store.

## Stack

- **Python 3.13** (dikelola `uv`)
- **FastAPI** + Uvicorn
- **SQLAlchemy 2.0** + PyMySQL
- **Alembic** (migrasi database)
- **Redis**
- **Boto3** (RustFS / S3 object storage)
- **python-jose** (JWT) + **argon2-cffi** (hash password)
- **Midtrans** (payment gateway, via HTTP/REST)

## Menjalankan

```bash
cd backend
uv sync                      # install dependency
uv run main.py                # preflight dependency + start API
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Database

Konfigurasi koneksi diambil dari `DATABASE_URL` pada `.env`. `alembic/env.py`
membaca nilai tersebut otomatis, jadi tidak perlu mengubah `alembic.ini`.

```bash
uv run alembic upgrade head                     # jalankan semua migrasi
uv run alembic revision --autogenerate -m "..." # buat migrasi baru dari model
uv run alembic check                            # pastikan model == database
uv run alembic downgrade -1                     # rollback 1 migrasi
uv run alembic current                          # revisi aktif
```

### Skema saat ini

| Tabel | Keterangan |
|---|---|
| `users` | Akun user, termasuk login Google (`google_id`) |
| `roles` | Role: `admin`, `customer`, `staff` (sudah di-seed) |
| `user_roles` | Relasi many-to-many user ↔ role |
| `products` | Produk merchandise |
| `product_images` | Metadata gambar produk (file di RustFS) |
| `product_likes` | Produk yang disukai user (PK gabungan user+produk) |
| `carts` | Satu keranjang aktif per user |
| `cart_items` | Item keranjang (unik per cart+produk) |
| `orders` | Pesanan + metode kirim, metode bayar, ongkir, resi, total |
| `order_items` | Snapshot item pesanan (harga & nama saat checkout) |

## Struktur

```
backend/
├── alembic/
│   ├── env.py                 # baca DATABASE_URL + metadata model
│   └── versions/              # file migrasi
├── app/
│   ├── api/
│   │   ├── deps.py            # JWT auth + require_roles()
│   │   └── v1/endpoints/      # auth, catalog, products, cart, orders,
│   │                          # admin_orders, revenue, payments, pos,
│   │                          # users, roles
│   ├── core/
│   │   ├── config.py          # loader .env (pydantic-settings)
│   │   ├── security.py        # Argon2 + JWT
│   │   ├── redis.py           # denylist token
│   │   └── utils.py           # slugify
│   ├── db/
│   │   ├── base.py            # Base, TimestampMixin, naming convention
│   │   └── session.py         # engine, SessionLocal, get_db()
│   ├── models/
│   │   ├── user.py            # User, Role, UserRole
│   │   ├── product.py         # Product
│   │   ├── product_image.py   # ProductImage
│   │   ├── product_like.py    # ProductLike
│   │   ├── cart.py            # Cart, CartItem
│   │   └── order.py           # Order, OrderItem
│   ├── schemas/               # skema request/response Pydantic
│   ├── scripts/create_admin.py
│   ├── services/
│   │   ├── google_oauth.py
│   │   ├── midtrans.py        # Snap payload + verifikasi signature
│   │   └── products.py        # serialize produk + statistik like
│   └── main.py                # entrypoint FastAPI + CORS
├── .env                       # konfigurasi lokal (jangan di-commit)
├── .env.example               # template konfigurasi
├── alembic.ini
├── main.py                    # `uv run main.py` (dev server)
├── pyproject.toml
└── uv.lock
```

## API

Base URL: `/api/v1` (dokumentasi interaktif di `/docs`, semua endpoint ber-lock
memakai header `Authorization: Bearer <access_token>`).

### Auth

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/register` | publik | Daftar customer baru |
| POST | `/auth/login` | publik | Email + password → access & refresh token |
| POST | `/auth/refresh` | publik | Tukar refresh token (rotasi, token lama dicabut) |
| POST | `/auth/logout` | login | Cabut access + refresh token (denylist Redis) |
| GET | `/auth/me` | login | Profil user + role |
| GET | `/auth/google/login` | publik | Redirect ke Google |
| GET | `/auth/google/callback` | publik | Callback, redirect ke frontend + token |
| GET | `/auth/session-check` | login | Cek token masih valid |

### Produk & katalog

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/catalog/home` | publik | Data home: new arrivals, best sellers, handmade, imported |
| GET | `/products` | publik | Katalog + filter (`q`, `product_type`, `status`, `min_price`, `max_price`, `in_stock`, `sort`) |
| GET | `/products/search` | publik | Pencarian + filter yang sama dengan `/products` |
| GET | `/products/filters` | publik | Opsi filter: `product_types`, `sort_options`, rentang harga |
| GET | `/products/{slug}` | publik | Detail produk + `like_count` / `is_liked` |
| GET | `/products/liked` | login | Produk yang disukai user |
| POST | `/products/{id}/like` | login | Sukai produk |
| DELETE | `/products/{id}/like` | login | Batalkan suka |
| POST | `/products` | staff, admin | Tambah produk + gambar |
| PATCH | `/products/{id}` | staff, admin | Update sebagian |
| DELETE | `/products/{id}` | admin | Hapus produk (gambar ikut terhapus) |
| POST | `/products/{id}/images` | staff, admin | Tambah gambar (hanya 1 primary) |
| PATCH | `/products/{id}/images/{image_id}` | staff, admin | Update gambar |
| DELETE | `/products/{id}/images/{image_id}` | staff, admin | Hapus gambar |

### Keranjang & checkout

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/cart` | login | Isi keranjang + subtotal |
| POST | `/cart/items` | login | Tambah produk (`product_id`, `quantity`) |
| PATCH | `/cart/items/{id}` | login | Ubah jumlah |
| DELETE | `/cart/items/{id}` | login | Hapus item |
| DELETE | `/cart` | login | Kosongkan keranjang |
| POST | `/orders/checkout` | login | Checkout keranjang → pesanan |

Metode pengiriman (`delivery_method`):

| Nilai | Arti | Aturan |
|---|---|---|
| `store` | Ambil di toko | Ongkir otomatis 0 |
| `courier` | Dikirim pengirim | Wajib `shipping_address`, ongkir dibebankan customer |
| `custom` | Event / kebutuhan khusus | Wajib `delivery_note` |

Metode pembayaran (`payment_method`):

| Nilai | Arti | Aturan |
|---|---|---|
| `midtrans` | Bayar online (QRIS/VA/e-wallet) | Default; lanjut ke `POST /payments/midtrans/{order_id}` |
| `cash` | Bayar di tempat / kasir event | Hanya untuk `store` atau `custom` (bukan `courier`) |

### Pembayaran

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/payments/methods` | publik | Daftar metode: `midtrans`, `cash` |
| POST | `/payments/midtrans/{order_id}` | login | Buat transaksi Midtrans Snap (butuh `MIDTRANS_SERVER_KEY` valid) |
| POST | `/payments/midtrans/notification` | Midtrans | Webhook pembayaran; signature SHA512 diverifikasi |
| PATCH | `/admin/orders/{id}/mark-paid` | staff, admin | Tandai pesanan cash sudah lunas |

Status pesanan cash dimulai dari `pending_payment`, lalu staff menandai lunas
lewat `mark-paid` (atau langsung lunas saat dibuat lewat mode kasir).

### Mode kasir / POS (event)

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/admin/pos/orders` | staff, admin | Buat pesanan tunai langsung lunas (`status=paid`, `cashier_id`) |

Contoh body:

```json
{
  "items": [{"product_id": 1, "quantity": 2}],
  "customer_name": "Pembeli Event",
  "customer_phone": "08123456789",
  "delivery_method": "custom",
  "delivery_note": "Booth Anime Expo hall B"
}
```

Stok langsung berkurang dan `sold_count` bertambah; pesanan POS tidak butuh
akun customer (`user_id` null).

### Pesanan

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/orders` | login | Riwayat belanja sendiri (filter `status`) |
| GET | `/orders/{order_number}` | login | Detail pesanan sendiri (pakai nomor acak `INV-YYYYMMDD-XXXXXXXX`, bukan id) |
| POST | `/orders/{order_number}/cancel` | login | Batalkan pesanan yang belum dibayar |
| GET | `/admin/orders` | staff, admin | Semua pesanan (filter status, metode, tanggal, `q`) |
| GET | `/admin/orders/{id}` | staff, admin | Detail pesanan |
| PATCH | `/admin/orders/{id}/status` | staff, admin | Ubah status pesanan |
| PATCH | `/admin/orders/{id}/tracking` | staff, admin | Isi kode resi |
| GET | `/admin/revenue` | staff, admin | Rekap pendapatan (`date_from`, `date_to`, `group_by=day|month`) + breakdown per metode kirim |

Alur status: `pending_payment → paid → processing → shipped → completed`
(dapat dibatalkan ke `cancelled` selama belum dikirim; stok otomatis kembali).

Nomor pesanan publik dibuat acak (`INV-YYYYMMDD-` + 8 karakter hex) dan dipakai
untuk URL pelanggan, misalnya `/pesanan/INV-20261123-784DA9`. Endpoint pelanggan
hanya mencari berdasarkan `order_number` milik akun yang login; pesanan akun lain
dijawab `404` agar keberadaannya tidak bocor. Endpoint admin tetap memakai `id`.

Pendapatan dihitung dari `subtotal` pesanan berstatus `paid`, `processing`,
`shipped`, atau `completed` — ongkir tidak dihitung sebagai pendapatan toko.

### User & role (admin)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/users` | Daftar akun admin/staff (akun customer tidak di-index) |
| GET | `/users/{id}` | Detail akun admin/staff |
| PATCH | `/users/{id}/roles` | Ganti role (hanya `admin` / `staff`) |
| PATCH | `/users/{id}/status` | Aktif / nonaktifkan akun |
| GET | `/roles` | Daftar role |
| POST | `/roles` | Tambah role |

### Matriks akses

| Role | Akses |
|---|---|
| `customer` | Katalog + search, keranjang, checkout, bayar Midtrans/cash, riwayat belanja, like produk |
| `staff` | Semua akses customer + kelola produk, pesanan, resi, pendapatan, mode kasir/POS |
| `admin` | Semua akses staff + kelola akun admin/staff, role, hapus produk |

Role dibaca dari database pada setiap request, jadi perubahan role langsung
berlaku tanpa perlu login ulang.

### Membuat akun admin / staff

```bash
uv run python -m app.scripts.create_admin \
  --email admin@toko.com --password 'rahasia123' --name "Admin Toko"

uv run python -m app.scripts.create_admin \
  --email staff@toko.com --password 'rahasia123' --role staff
```

## Catatan

- `SECRET_KEY` dan `JWT_SECRET_KEY` sudah di-generate acak (`openssl rand -hex 32`).
  Karena berubah, semua token lama otomatis tidak berlaku — login ulang.
- Nilai `CHANGE_THIS_*` di `.env` wajib diganti sebelum production.
- Konfigurasi pesanan ada di `.env`: `ORDER_PREFIX`, `ORDER_CURRENCY`,
  `DEFAULT_SHIPPING_COST`.
- Midtrans butuh `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` **asli** dari
  dashboard Midtrans. Selama masih berisi `xxxxxxxx`, endpoint
  `POST /payments/midtrans/{order_id}` mengembalikan **503**.
- Untuk development lokal, frontend memakai `http://localhost:5173` dan API
  `http://localhost:8000/api/v1`. Endpoint notifikasinya adalah
  `http://localhost:8000/api/v1/payments/midtrans/notification`, tetapi jangan
  masukkan alamat localhost ke dashboard Midtrans karena tidak dapat dijangkau
  dari internet.
- Saat backend sudah di-host, set `MIDTRANS_NOTIFICATION_URL` dan Midtrans
  Dashboard → Settings → Configuration → Payment Notification URL ke alamat
  HTTPS publik yang stabil:
  `https://api.domain-kamu.com/api/v1/payments/midtrans/notification`.
  Webhook masuk langsung ke FastAPI (bukan Vue/Vite), tidak memakai JWT, dan
  diverifikasi lewat `signature_key`
  (`sha512(order_id + status_code + gross_amount + server_key)`). Pembayaran
  berstatus `settlement` atau `capture` akan menandai pesanan sebagai `paid`.
- Token hasil login Google dikirim ke frontend lewat query string; di production
  sebaiknya frontend langsung menyimpannya ke memori/httpOnly cookie lalu
  membersihkan URL (`history.replaceState`).
- Logout & rotasi refresh token memakai denylist Redis. Kalau Redis mati, token
  yang dicabut tetap valid sampai masa berlakunya habis.
- `DB_HOST=127.0.0.1` / `REDIS_HOST=127.0.0.1` dipakai karena backend berjalan di
  host dan service Podman di-expose ke localhost. Kalau backend dijalankan sebagai
  container di network `devnet`, ganti ke `mysql` / `redis` / `rustfs`.
- Waktu `created_at` mengikuti timezone MySQL container (UTC).
- Endpoint `/users` sengaja hanya menampilkan akun `admin`/`staff`; akun customer
  dikelola lewat alur registrasi/Google dan tidak di-index di area admin.

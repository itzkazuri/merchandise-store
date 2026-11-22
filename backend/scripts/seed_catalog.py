"""Seed katalog produk awal ke database.

Jalankan dari folder backend:
    uv run python scripts/seed_catalog.py

Script ini idempotent: produk yang SKU-nya sudah ada akan dilewati, jadi aman
dijalankan berkali-kali. Data ini adalah data backend asli (bukan demo frontend),
dipakai untuk menguji homepage, section, dan halaman detail produk.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models import Category, Product  # noqa: E402

NOW = datetime.now(UTC).replace(tzinfo=None)


def days_ago(days: int) -> datetime:
    return NOW - timedelta(days=days)


# Urutan id 1..12 mengikuti katalog demo, tetapi semua nilai di bawah adalah
# data yang benar-benar disimpan ke database backend.
PRODUCTS = [
    {
        "name": "Hoshina Magical Girl 1/7",
        "slug": "hoshina-magical-girl-1-7",
        "sku": "MOCHI-001",
        "anime": "frieren",
        "category": "figure",
        "product_type": "imported",
        "price": Decimal("689000.00"),
        "stock": 8,
        "sold_count": 42,
        "description": (
            "Pre-order batch Starlit Academy. Figure skala 1/7 dari PVC, tinggi 24 cm, "
            "dengan base akrilik dan detail kostum bergradasi. Estimasi kirim 4-6 minggu "
            "setelah batch ditutup."
        ),
    },
    {
        "name": "Plushie Nekomaru",
        "slug": "plushie-nekomaru",
        "sku": "MOCHI-002",
        "anime": "spy-x-family",
        "category": "plush",
        "product_type": "handmade",
        "price": Decimal("189000.00"),
        "stock": 15,
        "sold_count": 128,
        "description": (
            "Plushie velboa 25 cm dengan jahitan tangan rapi. Bahan lembut, isi dakron padat, "
            "dan bisa dicuci dengan tangan. Dibuat oleh pengrajin lokal Mochibako."
        ),
    },
    {
        "name": "Tiny Mage Seri 2",
        "slug": "tiny-mage-seri-2",
        "sku": "MOCHI-003",
        "anime": "frieren",
        "category": "figure",
        "product_type": "imported",
        "price": Decimal("95000.00"),
        "stock": 12,
        "sold_count": 210,
        "description": (
            "Blind box Tiny Mage seri kedua, 1 dari 7 karakter. Tinggi 7-9 cm, material PVC, "
            "dilengkapi kartu karakter dan kotak koleksi."
        ),
    },
    {
        "name": "Gantungan Akrilik Kumo",
        "slug": "gantungan-akrilik-kumo",
        "sku": "MOCHI-004",
        "anime": "solo-leveling",
        "category": "gantungan-kunci",
        "product_type": "handmade",
        "price": Decimal("39000.00"),
        "stock": 25,
        "sold_count": 86,
        "description": (
            "Gantungan akrilik dua sisi ukuran 6 cm dengan ring logam. Cetak bening, "
            "warna tajam, dan ringan untuk tas atau kunci."
        ),
    },
    {
        "name": "Art Print Senja Atap",
        "slug": "art-print-senja-atap",
        "sku": "MOCHI-005",
        "anime": "frieren",
        "category": "poster",
        "product_type": "handmade",
        "price": Decimal("59000.00"),
        "stock": 10,
        "sold_count": 64,
        "description": (
            "Cetak art A4 di art paper 260 gsm. Ilustrasi senja di atas atap kota, "
            "dikirim tanpa frame dan dilindungi tube karton."
        ),
    },
    {
        "name": "Hoodie Neko Sentai",
        "slug": "hoodie-neko-sentai",
        "sku": "MOCHI-006",
        "anime": "spy-x-family",
        "category": "kaos",
        "product_type": "imported",
        "price": Decimal("299000.00"),
        "stock": 6,
        "sold_count": 51,
        "description": (
            "Hoodie fleece katun ukuran S sampai XL. Sablon plastisol tahan lama, "
            "kantong kanguru, dan tali hoodie dengan stopper logam."
        ),
    },
    {
        "name": "Chibi Figure Mochi",
        "slug": "chibi-figure-mochi",
        "sku": "MOCHI-007",
        "anime": "frieren",
        "category": "figure",
        "product_type": "imported",
        "price": Decimal("259000.00"),
        "stock": 14,
        "sold_count": 97,
        "description": (
            "Figure chibi PVC tinggi 10 cm dengan ekspresi lucu dan base bulat. "
            "Cocok untuk meja kerja atau rak koleksi."
        ),
    },
    {
        "name": "Bantal Domba Mimpi",
        "slug": "bantal-domba-mimpi",
        "sku": "MOCHI-008",
        "anime": "frieren",
        "category": "plush",
        "product_type": "handmade",
        "price": Decimal("149000.00"),
        "stock": 9,
        "sold_count": 18,
        "description": (
            "Pre-order batch handmade. Bantal plushie domba 40 cm dari velboa, "
            "isi dakron premium, dan sarung bantal bisa dilepas. Slot terbatas per batch."
        ),
    },
    {
        "name": "Stiker Vinyl Isi 20",
        "slug": "stiker-vinyl-isi-20",
        "sku": "MOCHI-009",
        "anime": "bocchi-the-rock",
        "category": "sticker",
        "product_type": "handmade",
        "price": Decimal("45000.00"),
        "stock": 30,
        "sold_count": 154,
        "description": (
            "Satu paket berisi 20 stiker vinyl tahan air. Ukuran campuran 4-7 cm, "
            "cocok untuk laptop, tumbler, dan case ponsel."
        ),
    },
    {
        "name": "Mug Keramik Moonlit",
        "slug": "mug-keramik-moonlit",
        "sku": "MOCHI-010",
        "anime": "frieren",
        "category": "aksesori",
        "product_type": "handmade",
        "price": Decimal("85000.00"),
        "stock": 18,
        "sold_count": 74,
        "description": (
            "Mug keramik 350 ml dengan cetakan ilustrasi bulan. Aman untuk microwave, "
            "tidak disarankan untuk dishwasher agar sablon lebih awet."
        ),
    },
    {
        "name": "Tote Kanvas Starlit",
        "slug": "tote-kanvas-starlit",
        "sku": "MOCHI-011",
        "anime": "frieren",
        "category": "merchandise",
        "product_type": "imported",
        "price": Decimal("79000.00"),
        "stock": 11,
        "sold_count": 12,
        "description": (
            "Pre-order tote kanvas tebal 38 x 40 cm dengan sablon satu sisi. "
            "Ada kantong dalam dan tali kuat untuk buku atau belanja harian."
        ),
    },
    {
        "name": "Neko Sentai Seri 1",
        "slug": "neko-sentai-seri-1",
        "sku": "MOCHI-012",
        "anime": "spy-x-family",
        "category": "figure",
        "product_type": "imported",
        "price": Decimal("95000.00"),
        "stock": 16,
        "sold_count": 188,
        "description": (
            "Blind box Neko Sentai seri pertama, 1 dari 6 karakter. Tinggi 8 cm, "
            "material PVC, dan kemasan kotak koleksi."
        ),
    },
]


def main() -> None:
    db = SessionLocal()
    created = 0
    skipped = 0
    try:
        anime_map = {
            category.slug: category
            for category in db.scalars(select(Category).where(Category.kind == "anime")).all()
        }
        product_category_map = {
            category.slug: category
            for category in db.scalars(select(Category).where(Category.kind == "product")).all()
        }

        for index, item in enumerate(PRODUCTS, start=1):
            if db.scalar(select(Product.id).where(Product.sku == item["sku"])) is not None:
                skipped += 1
                continue

            anime = anime_map.get(item["anime"])
            category = product_category_map.get(item["category"])
            if anime is None or category is None:
                raise SystemExit(
                    f"Kategori tidak ditemukan untuk {item['sku']}: "
                    f"anime={item['anime']}, category={item['category']}"
                )

            product = Product(
                name=item["name"],
                slug=item["slug"],
                sku=item["sku"],
                description=item["description"],
                product_type=item["product_type"],
                price=item["price"],
                stock=item["stock"],
                sold_count=item["sold_count"],
                status="active",
                anime_id=anime.id,
                category_id=category.id,
                created_at=days_ago(13 - index),
            )
            db.add(product)
            created += 1

        db.commit()
        print(f"Seed selesai: {created} produk dibuat, {skipped} dilewati (SKU sudah ada).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

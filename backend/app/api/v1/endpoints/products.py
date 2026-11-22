from __future__ import annotations

from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile
from fastapi import status as http_status
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import AdminUser, CurrentUser, DbSession, OptionalUser, StaffUser
from app.core.config import settings
from app.core.utils import slugify
from app.models import Category, Product, ProductImage, ProductLike, User
from app.schemas.category import CategoryOut
from app.schemas.common import Page
from app.services.products import serialize_products
from app.services.storage import StorageError, upload_product_image
from app.schemas.product import (
    LikeStatus,
    ProductCreate,
    ProductImageCreate,
    ProductImageOut,
    ProductImageUpdate,
    ProductImageUploadOut,
    ProductFilters,
    ProductOut,
    ProductUpdate,
)

router = APIRouter(prefix="/products", tags=["products"])

MANAGER_ROLES = {"admin", "staff"}
SortOption = Literal["newest", "oldest", "price_asc", "price_desc", "best_seller", "name"]

SORT_EXPRESSIONS = {
    "newest": (Product.created_at.desc(), Product.id.desc()),
    "oldest": (Product.created_at.asc(), Product.id.asc()),
    "price_asc": (Product.price.asc(), Product.id.desc()),
    "price_desc": (Product.price.desc(), Product.id.desc()),
    "best_seller": (Product.sold_count.desc(), Product.id.desc()),
    "name": (Product.name.asc(), Product.id.asc()),
}


def _can_manage(user: User | None) -> bool:
    return bool(user and {role.name for role in user.roles} & MANAGER_ROLES)


def _get_product_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Produk tidak ditemukan")
    return product


def _ensure_unique(db: Session, *, slug: str | None, sku: str | None, exclude_id: int | None = None) -> None:
    if slug:
        stmt = select(Product.id).where(Product.slug == slug)
        if exclude_id is not None:
            stmt = stmt.where(Product.id != exclude_id)
        if db.scalar(stmt):
            raise HTTPException(http_status.HTTP_409_CONFLICT, f"Slug sudah dipakai: {slug}")

    if sku:
        stmt = select(Product.id).where(Product.sku == sku)
        if exclude_id is not None:
            stmt = stmt.where(Product.id != exclude_id)
        if db.scalar(stmt):
            raise HTTPException(http_status.HTTP_409_CONFLICT, f"SKU sudah dipakai: {sku}")


def _validate_category(db: Session, *, kind: str, category_id: int | None, label: str) -> int | None:
    """Pastikan ID kategori ada dan jenisnya cocok (anime vs jenis produk)."""
    if category_id is None:
        return None
    category = db.get(Category, category_id)
    if category is None or category.kind != kind:
        raise HTTPException(
            http_status.HTTP_400_BAD_REQUEST,
            f"{label} tidak valid. Pilih kategori dengan jenis '{kind}'.",
        )
    return category.id


def _apply_single_primary(images: list[ProductImage]) -> None:
    found = False
    for image in images:
        if image.is_primary:
            if found:
                image.is_primary = False
            else:
                found = True


def _build_product_query(
    *,
    q: str | None,
    product_type: Literal["imported", "handmade"] | None,
    status: Literal["draft", "active", "archived"] | None,
    min_price: Decimal | None,
    max_price: Decimal | None,
    in_stock: bool | None,
    anime: str | None,
    category: str | None,
    manager: bool,
):
    stmt = select(Product)

    if q:
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(keyword),
                Product.sku.ilike(keyword),
                Product.slug.ilike(keyword),
                Product.description.ilike(keyword),
                # Cari berdasarkan seri anime / jenis produk juga, supaya
                # ketik "Naruto" atau "Figure" tetap menemukan produknya.
                Product.anime.has(
                    or_(Category.name.ilike(keyword), Category.slug.ilike(keyword))
                ),
                Product.category.has(
                    or_(Category.name.ilike(keyword), Category.slug.ilike(keyword))
                ),
            )
        )

    if not manager:
        # Customer / tamu hanya boleh melihat produk aktif.
        stmt = stmt.where(Product.status == "active")
    elif status:
        stmt = stmt.where(Product.status == status)

    if product_type:
        stmt = stmt.where(Product.product_type == product_type)

    if anime:
        anime_ids = select(Category.id).where(
            Category.kind == "anime",
            Category.slug == anime,
        )
        if not manager:
            anime_ids = anime_ids.where(Category.is_active.is_(True))
        stmt = stmt.where(Product.anime_id.in_(anime_ids))

    if category:
        category_ids = select(Category.id).where(
            Category.kind == "product",
            Category.slug == category,
        )
        if not manager:
            category_ids = category_ids.where(Category.is_active.is_(True))
        stmt = stmt.where(Product.category_id.in_(category_ids))

    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)

    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)

    if in_stock:
        stmt = stmt.where(Product.stock > 0)

    return stmt


def _product_page(
    db: Session,
    stmt,
    *,
    sort: SortOption,
    page: int,
    size: int,
    user: User | None,
) -> Page[ProductOut]:
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.order_by(*SORT_EXPRESSIONS[sort]).offset((page - 1) * size).limit(size)
    ).all()

    return Page[ProductOut].build(
        items=serialize_products(db, items, user),
        total=total,
        page=page,
        size=size,
    )


@router.get("", response_model=Page[ProductOut], summary="Katalog produk")
def list_products(
    user: OptionalUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=100, description="Cari nama, SKU, slug, atau deskripsi"),
    product_type: Literal["imported", "handmade"] | None = None,
    status: Literal["draft", "active", "archived"] | None = None,
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    in_stock: bool | None = Query(None, description="Filter hanya produk yang stoknya tersedia"),
    anime: str | None = Query(None, max_length=140, description="Slug anime, contoh: jujutsu-kaisen"),
    category: str | None = Query(None, max_length=140, description="Slug jenis produk, contoh: figure"),
    sort: SortOption = "newest",
) -> Page[ProductOut]:
    stmt = _build_product_query(
        q=q,
        product_type=product_type,
        status=status,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        anime=anime,
        category=category,
        manager=_can_manage(user),
    )
    return _product_page(db, stmt, sort=sort, page=page, size=size, user=user)


@router.get("/search", response_model=Page[ProductOut], summary="Pencarian produk + filter")
def search_products(
    user: OptionalUser,
    db: DbSession,
    q: str | None = Query(None, max_length=100, description="Kata kunci: nama, SKU, slug, deskripsi"),
    product_type: Literal["imported", "handmade"] | None = None,
    status: Literal["draft", "active", "archived"] | None = None,
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    in_stock: bool | None = Query(None),
    anime: str | None = Query(None, max_length=140, description="Slug anime"),
    category: str | None = Query(None, max_length=140, description="Slug jenis produk"),
    sort: SortOption = "newest",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> Page[ProductOut]:
    stmt = _build_product_query(
        q=q,
        product_type=product_type,
        status=status,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        anime=anime,
        category=category,
        manager=_can_manage(user),
    )
    return _product_page(db, stmt, sort=sort, page=page, size=size, user=user)


@router.get("/filters", response_model=ProductFilters, summary="Opsi filter pencarian produk")
def product_filters(db: DbSession) -> ProductFilters:
    price_min, price_max = db.execute(
        select(func.min(Product.price), func.max(Product.price)).where(Product.status == "active")
    ).one()

    categories = list(
        db.scalars(
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.kind, Category.sort_order, Category.name)
        ).all()
    )

    return ProductFilters(
        product_types=["imported", "handmade"],
        sort_options=list(SORT_EXPRESSIONS),
        animes=[CategoryOut.model_validate(item) for item in categories if item.kind == "anime"],
        product_categories=[
            CategoryOut.model_validate(item) for item in categories if item.kind == "product"
        ],
        price_min=price_min,
        price_max=price_max,
    )


@router.get(
    "/liked",
    response_model=Page[ProductOut],
    summary="Produk yang disukai user login",
)
def liked_products(
    user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> Page[ProductOut]:
    stmt = (
        select(Product)
        .join(ProductLike, ProductLike.product_id == Product.id)
        .where(ProductLike.user_id == user.id)
    )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.order_by(ProductLike.created_at.desc()).offset((page - 1) * size).limit(size)
    ).all()

    return Page[ProductOut].build(
        items=serialize_products(db, items, user),
        total=total,
        page=page,
        size=size,
    )


@router.get("/{slug}", response_model=ProductOut, summary="Detail produk berdasarkan slug")
def get_product(slug: str, user: OptionalUser, db: DbSession) -> ProductOut:
    product = db.scalar(select(Product).where(Product.slug == slug))
    if product is None or (product.status != "active" and not _can_manage(user)):
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Produk tidak ditemukan")
    return serialize_products(db, [product], user)[0]


def _like_count(db: Session, product_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(ProductLike).where(ProductLike.product_id == product_id)
    ) or 0


@router.post(
    "/{product_id}/like",
    response_model=LikeStatus,
    status_code=http_status.HTTP_201_CREATED,
    summary="Sukai produk",
)
def like_product(product_id: int, user: CurrentUser, db: DbSession) -> LikeStatus:
    product = _get_product_or_404(db, product_id)
    if product.status != "active":
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Produk tidak ditemukan")

    if db.get(ProductLike, (user.id, product_id)) is None:
        db.add(ProductLike(user_id=user.id, product_id=product_id))
        db.commit()

    return LikeStatus(liked=True, like_count=_like_count(db, product_id))


@router.delete(
    "/{product_id}/like",
    response_model=LikeStatus,
    summary="Batalkan suka produk",
)
def unlike_product(product_id: int, user: CurrentUser, db: DbSession) -> LikeStatus:
    like = db.get(ProductLike, (user.id, product_id))
    if like is not None:
        db.delete(like)
        db.commit()

    return LikeStatus(liked=False, like_count=_like_count(db, product_id))


@router.post(
    "",
    response_model=ProductOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Tambah produk (staff/admin)",
)
def create_product(payload: ProductCreate, staff: StaffUser, db: DbSession) -> Product:
    slug = payload.slug or slugify(payload.name)
    if not slug:
        raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Slug tidak valid")

    sku = payload.sku.strip()
    _ensure_unique(db, slug=slug, sku=sku)
    anime_id = _validate_category(db, kind="anime", category_id=payload.anime_id, label="Anime")
    category_id = _validate_category(
        db, kind="product", category_id=payload.category_id, label="Jenis produk"
    )

    product = Product(
        name=payload.name.strip(),
        slug=slug,
        sku=sku,
        description=payload.description,
        product_type=payload.product_type,
        price=payload.price,
        stock=payload.stock,
        status=payload.status,
        anime_id=anime_id,
        category_id=category_id,
    )

    for item in payload.images:
        product.images.append(ProductImage(**item.model_dump()))
    _apply_single_primary(product.images)

    db.add(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(http_status.HTTP_409_CONFLICT, "Slug atau SKU sudah dipakai") from exc

    db.refresh(product)
    return product


@router.patch(
    "/{product_id}",
    response_model=ProductOut,
    summary="Update produk (staff/admin)",
)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    staff: StaffUser,
    db: DbSession,
) -> Product:
    product = _get_product_or_404(db, product_id)
    data = payload.model_dump(exclude_unset=True)

    if "slug" in data:
        if data["slug"] is None:
            data.pop("slug")
        else:
            data["slug"] = slugify(str(data["slug"]))
    if "sku" in data and data["sku"] is not None:
        data["sku"] = str(data["sku"]).strip()
    if "name" in data and data["name"] is not None:
        data["name"] = str(data["name"]).strip()

    _ensure_unique(
        db,
        slug=data.get("slug"),
        sku=data.get("sku"),
        exclude_id=product.id,
    )

    if "anime_id" in data:
        data["anime_id"] = _validate_category(
            db, kind="anime", category_id=data["anime_id"], label="Anime"
        )
    if "category_id" in data:
        data["category_id"] = _validate_category(
            db, kind="product", category_id=data["category_id"], label="Jenis produk"
        )

    for field, value in data.items():
        setattr(product, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(http_status.HTTP_409_CONFLICT, "Slug atau SKU sudah dipakai") from exc

    db.refresh(product)
    return product


@router.delete(
    "/{product_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Hapus produk (admin)",
)
def delete_product(product_id: int, admin: AdminUser, db: DbSession) -> Response:
    product = _get_product_or_404(db, product_id)
    db.delete(product)
    db.commit()
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)


@router.post(
    "/images/upload",
    response_model=ProductImageUploadOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Upload file gambar produk (staff/admin)",
)
def upload_product_image_file(
    staff: StaffUser,
    file: UploadFile = File(..., description="File gambar JPG/PNG/WebP/GIF/AVIF"),
) -> ProductImageUploadOut:
    """Terima file gambar dari admin, simpan ke RustFS/S3, kembalikan object key.

    Endpoint ini tidak butuh product_id karena form admin mengunggah gambar
    lebih dulu, baru menyambungkannya ke produk yang dibuat/diubah.
    """
    limit = max(1, settings.MAX_UPLOAD_MB) * 1024 * 1024
    data = file.file.read(limit + 1)

    if not data:
        raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "File gambar kosong.")
    if len(data) > limit:
        raise HTTPException(
            http_status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Ukuran gambar maksimal {settings.MAX_UPLOAD_MB} MB.",
        )

    try:
        stored = upload_product_image(data)
    except StorageError as exc:
        raise HTTPException(http_status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    return ProductImageUploadOut(
        object_key=stored.object_key,
        url=stored.url,
        content_type=stored.content_type,
        size=stored.size,
    )


@router.post(
    "/{product_id}/images",
    response_model=ProductImageOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Tambah gambar produk (staff/admin)",
)
def add_product_image(
    product_id: int,
    payload: ProductImageCreate,
    staff: StaffUser,
    db: DbSession,
) -> ProductImage:
    _get_product_or_404(db, product_id)

    if payload.is_primary:
        db.execute(
            update(ProductImage)
            .where(ProductImage.product_id == product_id)
            .values(is_primary=False)
        )

    image = ProductImage(product_id=product_id, **payload.model_dump())
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.patch(
    "/{product_id}/images/{image_id}",
    response_model=ProductImageOut,
    summary="Update gambar produk (staff/admin)",
)
def update_product_image(
    product_id: int,
    image_id: int,
    payload: ProductImageUpdate,
    staff: StaffUser,
    db: DbSession,
) -> ProductImage:
    image = db.get(ProductImage, image_id)
    if image is None or image.product_id != product_id:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Gambar tidak ditemukan")

    data = payload.model_dump(exclude_unset=True)

    if data.get("is_primary"):
        db.execute(
            update(ProductImage)
            .where(ProductImage.product_id == product_id, ProductImage.id != image_id)
            .values(is_primary=False)
        )

    for field, value in data.items():
        if value is not None:
            setattr(image, field, value)

    db.commit()
    db.refresh(image)
    return image


@router.delete(
    "/{product_id}/images/{image_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Hapus gambar produk (staff/admin)",
)
def delete_product_image(
    product_id: int,
    image_id: int,
    staff: StaffUser,
    db: DbSession,
) -> Response:
    image = db.get(ProductImage, image_id)
    if image is None or image.product_id != product_id:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Gambar tidak ditemukan")

    db.delete(image)
    db.commit()
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)

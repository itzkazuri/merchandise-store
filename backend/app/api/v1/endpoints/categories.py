from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi import status as http_status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import AdminUser, DbSession, OptionalUser, StaffUser
from app.core.utils import slugify
from app.models import Category, Product, User
from app.schemas.category import CategoryCreate, CategoryKind, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])

MANAGER_ROLES = {"admin", "staff"}


def _can_manage(user: User | None) -> bool:
    return bool(user and {role.name for role in user.roles} & MANAGER_ROLES)


def _product_counts(db: Session, categories: list[Category]) -> dict[int, int]:
    """Jumlah produk per kategori dalam satu query (tanpa N+1)."""
    if not categories:
        return {}
    anime_ids = [item.id for item in categories if item.kind == "anime"]
    product_ids = [item.id for item in categories if item.kind == "product"]
    filters = []
    if anime_ids:
        filters.append(Product.anime_id.in_(anime_ids))
    if product_ids:
        filters.append(Product.category_id.in_(product_ids))
    if not filters:
        return {}

    rows = db.execute(
        select(Product.anime_id, Product.category_id).where(or_(*filters))
    ).all()
    counts: dict[int, int] = {}
    for anime_id, category_id in rows:
        for category_id_value in (anime_id, category_id):
            if category_id_value:
                counts[category_id_value] = counts.get(category_id_value, 0) + 1
    return counts


def _serialize(db: Session, categories: list[Category]) -> list[CategoryOut]:
    counts = _product_counts(db, categories)
    return [
        CategoryOut.model_validate(item).model_copy(
            update={"product_count": counts.get(item.id, 0)}
        )
        for item in categories
    ]


def _get_category_or_404(db: Session, category_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Kategori tidak ditemukan")
    return category


def _ensure_unique_slug(
    db: Session,
    *,
    kind: str,
    slug: str,
    exclude_id: int | None = None,
) -> None:
    stmt = select(Category.id).where(Category.kind == kind, Category.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(Category.id != exclude_id)
    if db.scalar(stmt):
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"Kategori dengan slug '{slug}' sudah ada untuk jenis ini",
        )


@router.get("", response_model=list[CategoryOut], summary="Daftar kategori (anime / jenis produk)")
def list_categories(
    user: OptionalUser,
    db: DbSession,
    kind: CategoryKind | None = Query(None, description="anime atau product"),
    include_inactive: bool = Query(False, description="Hanya staff/admin"),
) -> list[CategoryOut]:
    stmt = select(Category)
    if kind:
        stmt = stmt.where(Category.kind == kind)
    if include_inactive:
        if not _can_manage(user):
            raise HTTPException(http_status.HTTP_403_FORBIDDEN, "Akses ditolak")
    else:
        stmt = stmt.where(Category.is_active.is_(True))

    categories = list(
        db.scalars(stmt.order_by(Category.kind, Category.sort_order, Category.name)).all()
    )
    return _serialize(db, categories)


@router.post(
    "",
    response_model=CategoryOut,
    status_code=http_status.HTTP_201_CREATED,
    summary="Tambah kategori (staff/admin)",
)
def create_category(payload: CategoryCreate, staff: StaffUser, db: DbSession) -> CategoryOut:
    slug = slugify(payload.slug or payload.name, max_length=140)
    if not slug:
        raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Slug tidak valid")
    _ensure_unique_slug(db, kind=payload.kind, slug=slug)

    category = Category(
        kind=payload.kind,
        name=payload.name,
        slug=slug,
        description=payload.description,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(http_status.HTTP_409_CONFLICT, "Slug kategori sudah dipakai") from exc

    db.refresh(category)
    return _serialize(db, [category])[0]


@router.patch(
    "/{category_id}",
    response_model=CategoryOut,
    summary="Update kategori (staff/admin)",
)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    staff: StaffUser,
    db: DbSession,
) -> CategoryOut:
    category = _get_category_or_404(db, category_id)
    data = payload.model_dump(exclude_unset=True)

    if data.get("name") is not None:
        data["name"] = str(data["name"]).strip()
    if "slug" in data:
        slug = slugify(str(data["slug"]), max_length=140) if data["slug"] else slugify(
            data.get("name") or category.name,
            max_length=140,
        )
        if not slug:
            raise HTTPException(http_status.HTTP_400_BAD_REQUEST, "Slug tidak valid")
        data["slug"] = slug
        _ensure_unique_slug(db, kind=category.kind, slug=slug, exclude_id=category.id)

    for field, value in data.items():
        setattr(category, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(http_status.HTTP_409_CONFLICT, "Slug kategori sudah dipakai") from exc

    db.refresh(category)
    return _serialize(db, [category])[0]


@router.delete(
    "/{category_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
    summary="Hapus kategori (admin)",
)
def delete_category(category_id: int, admin: AdminUser, db: DbSession) -> Response:
    category = _get_category_or_404(db, category_id)

    used = db.scalar(
        select(func.count(Product.id)).where(
            or_(
                Product.anime_id == category.id,
                Product.category_id == category.id,
            )
        )
    ) or 0
    if used:
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            f"Kategori masih dipakai oleh {used} produk. Pindahkan produknya terlebih dahulu.",
        )

    db.delete(category)
    db.commit()
    return Response(status_code=http_status.HTTP_204_NO_CONTENT)

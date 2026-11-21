from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import DbSession, OptionalUser
from app.models import Product
from app.schemas.catalog import HomeCatalogOut
from app.services.products import serialize_products

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/home", response_model=HomeCatalogOut, summary="Data katalog untuk halaman home publik")
def home_catalog(
    user: OptionalUser,
    db: DbSession,
    limit: int = Query(8, ge=1, le=24),
) -> HomeCatalogOut:
    active = Product.status == "active"

    def fetch(order_by: tuple, product_type: str | None = None) -> list[Product]:
        stmt = select(Product).where(active)
        if product_type:
            stmt = stmt.where(Product.product_type == product_type)
        return list(db.scalars(stmt.order_by(*order_by).limit(limit)).all())

    newest = (Product.created_at.desc(), Product.id.desc())
    best = (Product.sold_count.desc(), Product.id.desc())

    total = db.scalar(select(func.count(Product.id)).where(active)) or 0

    return HomeCatalogOut(
        total_products=total,
        new_arrivals=serialize_products(db, fetch(newest), user),
        best_sellers=serialize_products(db, fetch(best), user),
        handmade=serialize_products(db, fetch(newest, "handmade"), user),
        imported=serialize_products(db, fetch(newest, "imported"), user),
    )

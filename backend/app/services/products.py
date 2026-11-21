from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Product, ProductLike, User
from app.schemas.product import ProductOut


def like_stats(
    db: Session,
    product_ids: Sequence[int],
    user: User | None,
) -> dict[int, int]:
    if not product_ids:
        return {}
    rows = db.execute(
        select(ProductLike.product_id, func.count())
        .where(ProductLike.product_id.in_(product_ids))
        .group_by(ProductLike.product_id)
    ).all()
    return {product_id: count for product_id, count in rows}


def liked_product_ids(db: Session, user: User | None, product_ids: Sequence[int]) -> set[int]:
    if user is None or not product_ids:
        return set()
    return set(
        db.scalars(
            select(ProductLike.product_id).where(
                ProductLike.user_id == user.id,
                ProductLike.product_id.in_(product_ids),
            )
        ).all()
    )


def serialize_products(
    db: Session,
    products: Sequence[Product],
    user: User | None = None,
) -> list[ProductOut]:
    """ProductOut + like_count + is_liked tanpa N+1 query."""
    ids = [product.id for product in products]
    counts = like_stats(db, ids, user)
    liked = liked_product_ids(db, user, ids)

    return [
        ProductOut.model_validate(product).model_copy(
            update={
                "like_count": counts.get(product.id, 0),
                "is_liked": product.id in liked,
            }
        )
        for product in products
    ]

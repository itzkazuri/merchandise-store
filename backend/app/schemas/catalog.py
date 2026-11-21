from pydantic import BaseModel

from app.schemas.product import ProductOut


class HomeCatalogOut(BaseModel):
    total_products: int
    new_arrivals: list[ProductOut]
    best_sellers: list[ProductOut]
    handmade: list[ProductOut]
    imported: list[ProductOut]

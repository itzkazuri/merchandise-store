from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_orders,
    auth,
    cart,
    catalog,
    categories,
    orders,
    payments,
    pos,
    products,
    revenue,
    roles,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(orders.router)
api_router.include_router(payments.router)
api_router.include_router(pos.router)
api_router.include_router(admin_orders.router)
api_router.include_router(revenue.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from dependencies import CurrentUserPayload, get_current_user_payload, require_admin, require_internal_api_key
from schemas import InternalStockDeductRequest, ProductCreate, ProductResponse, ProductUpdate, StockUpdate
from seed import seed_products
from service import (
    create_product,
    deduct_product_stock,
    delete_product,
    get_product,
    list_products,
    update_product,
    update_product_stock,
)
from shared.audit_client import send_audit_event
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.responses import success_response


SERVICE_NAME = "inventory-service"

app = FastAPI(title="SecureOps Inventory Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


def client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Invalid request data.",
            "data": None,
        },
    )


def health_response() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "healthy"}


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_products(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/products/health")
def gateway_health() -> dict[str, str]:
    return health_response()


@app.post("/products", status_code=status.HTTP_201_CREATED)
def create_product_endpoint(
    payload: ProductCreate,
    request: Request,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    product = create_product(db=db, payload=payload, created_by=current_user.user_id)
    send_audit_event(
        "inventory.product.created",
        SERVICE_NAME,
        "success",
        user_id=current_user.user_id,
        ip_address=client_ip(request),
        details={"product_id": product.id, "sku": product.sku, "name": product.name},
    )
    return success_response("Product created successfully.", ProductResponse.model_validate(product))


@app.get("/products")
@app.get("/products/")
def list_products_endpoint(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    low_stock_only: bool = Query(default=False),
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    products = list_products(
        db=db,
        search=search,
        category=category,
        low_stock_only=low_stock_only,
    )
    return success_response(
        "Products retrieved successfully.",
        [ProductResponse.model_validate(product) for product in products],
    )


@app.post("/products/internal/deduct-stock")
def deduct_stock_endpoint(
    payload: InternalStockDeductRequest,
    internal_auth: None = Depends(require_internal_api_key),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        products = deduct_product_stock(db=db, payload=payload)
    except Exception:
        send_audit_event(
            "inventory.stock.deduct.failed",
            SERVICE_NAME,
            "failure",
            details={"items": [item.model_dump() for item in payload.items]},
        )
        raise
    send_audit_event(
        "inventory.stock.deducted",
        SERVICE_NAME,
        "success",
        details={"product_ids": [product.id for product in products]},
    )
    return success_response(
        "Product stock deducted successfully.",
        [ProductResponse.model_validate(product) for product in products],
    )


@app.get("/products/{product_id}")
def get_product_endpoint(
    product_id: int,
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    product = get_product(db=db, product_id=product_id)
    return success_response("Product retrieved successfully.", ProductResponse.model_validate(product))


@app.patch("/products/{product_id}")
def update_product_endpoint(
    product_id: int,
    payload: ProductUpdate,
    request: Request,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    product = update_product(db=db, product_id=product_id, payload=payload)
    send_audit_event(
        "inventory.product.updated",
        SERVICE_NAME,
        "success",
        user_id=current_user.user_id,
        ip_address=client_ip(request),
        details={"product_id": product.id, "sku": product.sku},
    )
    return success_response("Product updated successfully.", ProductResponse.model_validate(product))


@app.patch("/products/{product_id}/stock")
def update_stock_endpoint(
    product_id: int,
    payload: StockUpdate,
    request: Request,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    product = update_product_stock(db=db, product_id=product_id, payload=payload)
    send_audit_event(
        "inventory.stock.updated",
        SERVICE_NAME,
        "success",
        user_id=current_user.user_id,
        ip_address=client_ip(request),
        details={"product_id": product.id, "sku": product.sku, "quantity": product.quantity},
    )
    return success_response("Product stock updated successfully.", ProductResponse.model_validate(product))


@app.delete("/products/{product_id}")
def delete_product_endpoint(
    product_id: int,
    request: Request,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    delete_product(db=db, product_id=product_id)
    send_audit_event(
        "inventory.product.deleted",
        SERVICE_NAME,
        "success",
        user_id=current_user.user_id,
        ip_address=client_ip(request),
        details={"product_id": product_id},
    )
    return success_response("Product deleted successfully.")

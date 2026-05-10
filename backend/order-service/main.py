from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from dependencies import CurrentUserPayload, get_current_user_payload, require_admin
from schemas import OrderCreate, OrderRejectRequest, OrderResponse
from seed import seed_orders
from service import approve_order, create_order, get_order_for_user, list_all_orders, list_my_orders, reject_order
from shared.audit_client import send_audit_event
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.responses import success_response


SERVICE_NAME = "order-service"

app = FastAPI(title="SecureOps Order Service")
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


def ensure_order_user_snapshot_columns() -> None:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_name VARCHAR(120)"))
        connection.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_email VARCHAR(255)"))


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_order_user_snapshot_columns()
    db = SessionLocal()
    try:
        seed_orders(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/orders/health/", include_in_schema=False)
@app.get("/orders/health")
def gateway_health() -> dict[str, str]:
    return health_response()


@app.post("/orders/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
@app.post("/orders", status_code=status.HTTP_201_CREATED)
def create_order_endpoint(
    payload: OrderCreate,
    request: Request,
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = create_order(db=db, payload=payload, current_user=current_user)
    send_audit_event(
        "orders.order.created",
        SERVICE_NAME,
        "success",
        user_id=current_user.user_id,
        ip_address=client_ip(request),
        details={"order_id": order.id, "items": len(order.items)},
    )
    return success_response("Order created successfully.", OrderResponse.model_validate(order))


@app.get("/orders/my/", include_in_schema=False)
@app.get("/orders/my")
def my_orders_endpoint(
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    orders = list_my_orders(db=db, user_id=current_user.user_id)
    return success_response(
        "Orders retrieved successfully.",
        [OrderResponse.model_validate(order) for order in orders],
    )


@app.get("/orders/", include_in_schema=False)
@app.get("/orders")
def list_orders_endpoint(
    order_status: str | None = Query(default=None, alias="status"),
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    orders = list_all_orders(db=db, status_filter=order_status)
    return success_response(
        "Orders retrieved successfully.",
        [OrderResponse.model_validate(order) for order in orders],
    )


@app.get("/orders/{order_id}/", include_in_schema=False)
@app.get("/orders/{order_id}")
def get_order_endpoint(
    order_id: int,
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order_for_user(db=db, order_id=order_id, current_user=current_user)
    return success_response("Order retrieved successfully.", OrderResponse.model_validate(order))


@app.patch("/orders/{order_id}/approve/", include_in_schema=False)
@app.patch("/orders/{order_id}/approve")
def approve_order_endpoint(
    order_id: int,
    request: Request,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = approve_order(db=db, order_id=order_id)
    send_audit_event(
        "orders.order.approved",
        SERVICE_NAME,
        "success",
        user_id=current_user.user_id,
        ip_address=client_ip(request),
        details={"order_id": order.id, "requester_id": order.user_id},
    )
    return success_response("Order approved successfully.", OrderResponse.model_validate(order))


@app.patch("/orders/{order_id}/reject/", include_in_schema=False)
@app.patch("/orders/{order_id}/reject")
def reject_order_endpoint(
    order_id: int,
    payload: OrderRejectRequest,
    request: Request,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = reject_order(db=db, order_id=order_id, payload=payload)
    send_audit_event(
        "orders.order.rejected",
        SERVICE_NAME,
        "success",
        user_id=current_user.user_id,
        ip_address=client_ip(request),
        details={"order_id": order.id, "requester_id": order.user_id},
    )
    return success_response("Order rejected successfully.", OrderResponse.model_validate(order))

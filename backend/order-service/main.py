from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from dependencies import CurrentUserPayload, get_current_user_payload, require_admin
from schemas import OrderCreate, OrderRejectRequest, OrderResponse
from seed import seed_orders
from service import approve_order, create_order, get_order_for_user, list_all_orders, list_my_orders, reject_order
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.responses import success_response


SERVICE_NAME = "order-service"

app = FastAPI(title="SecureOps Order Service")
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


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
        seed_orders(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/orders/health")
def gateway_health() -> dict[str, str]:
    return health_response()


@app.post("/orders", status_code=status.HTTP_201_CREATED)
def create_order_endpoint(
    payload: OrderCreate,
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = create_order(db=db, payload=payload, user_id=current_user.user_id)
    return success_response("Order created successfully.", OrderResponse.model_validate(order))


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


@app.get("/orders/{order_id}")
def get_order_endpoint(
    order_id: int,
    current_user: CurrentUserPayload = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order_for_user(db=db, order_id=order_id, current_user=current_user)
    return success_response("Order retrieved successfully.", OrderResponse.model_validate(order))


@app.patch("/orders/{order_id}/approve")
def approve_order_endpoint(
    order_id: int,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = approve_order(db=db, order_id=order_id)
    return success_response("Order approved successfully.", OrderResponse.model_validate(order))


@app.patch("/orders/{order_id}/reject")
def reject_order_endpoint(
    order_id: int,
    payload: OrderRejectRequest,
    current_user: CurrentUserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    order = reject_order(db=db, order_id=order_id, payload=payload)
    return success_response("Order rejected successfully.", OrderResponse.model_validate(order))

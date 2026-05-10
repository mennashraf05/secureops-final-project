import os

from fastapi import HTTPException, status
import requests
from sqlalchemy.orm import Session

from dependencies import CurrentUserPayload
from models import ORDER_STATUSES, Order, OrderItem
from schemas import OrderCreate, OrderRejectRequest
from shared.audit_client import send_audit_event
from shared.config import settings


INVENTORY_SERVICE_URL = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8000")
INVENTORY_DEDUCT_STOCK_URL = f"{INVENTORY_SERVICE_URL}/products/internal/deduct-stock"


def create_order(db: Session, payload: OrderCreate, current_user: CurrentUserPayload) -> Order:
    order = Order(
        user_id=current_user.user_id,
        user_name=current_user.name or current_user.email or "User",
        user_email=current_user.email,
        status="pending",
    )
    for item in payload.items:
        order.items.append(
            OrderItem(
                product_id=item.product_id,
                product_name=item.product_name.strip(),
                product_sku=item.product_sku.strip().upper(),
                quantity=item.quantity,
            )
        )

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def list_my_orders(db: Session, user_id: int) -> list[Order]:
    return db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).all()


def list_all_orders(db: Session, status_filter: str | None = None) -> list[Order]:
    query = db.query(Order)

    if status_filter:
        normalized_status = status_filter.strip().lower()
        if normalized_status not in ORDER_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid order status.",
            )
        query = query.filter(Order.status == normalized_status)

    return query.order_by(Order.created_at.desc()).all()


def get_order(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return order


def get_order_for_update(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return order


def get_order_for_user(db: Session, order_id: int, current_user: CurrentUserPayload) -> Order:
    order = get_order(db, order_id)
    if current_user.role != "admin" and order.user_id != current_user.user_id:
        send_audit_event(
            "orders.ownership.denied",
            "order-service",
            "blocked",
            user_id=current_user.user_id,
            details={"order_id": order_id, "owner_user_id": order.user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own orders.",
        )

    return order


def deduct_inventory_stock(order: Order) -> None:
    payload = {
        "items": [
            {
                "product_id": item.product_id,
                "quantity": item.quantity,
            }
            for item in order.items
        ]
    }
    headers = {"X-Internal-API-Key": settings.internal_api_key}

    try:
        response = requests.post(
            INVENTORY_DEDUCT_STOCK_URL,
            json=payload,
            headers=headers,
            timeout=5,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Order approval failed because inventory service is unavailable.",
        ) from exc

    if response.ok:
        return

    if response.status_code == status.HTTP_400_BAD_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order approval failed because inventory stock is insufficient.",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Order approval failed because inventory could not fulfill the request.",
    )


def approve_order(db: Session, order_id: int) -> Order:
    order = get_order_for_update(db, order_id)
    if order.status == "approved":
        return order
    if order.status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejected orders cannot be approved.",
        )

    deduct_inventory_stock(order)
    order.status = "approved"
    order.admin_response = "Approved by admin"
    db.commit()
    db.refresh(order)
    return order


def reject_order(db: Session, order_id: int, payload: OrderRejectRequest) -> Order:
    order = get_order(db, order_id)
    order.status = "rejected"
    order.admin_response = payload.admin_response.strip()
    db.commit()
    db.refresh(order)
    return order

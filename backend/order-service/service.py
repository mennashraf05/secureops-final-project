from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from dependencies import CurrentUserPayload
from models import ORDER_STATUSES, Order, OrderItem
from schemas import OrderCreate, OrderRejectRequest


def create_order(db: Session, payload: OrderCreate, user_id: int) -> Order:
    order = Order(user_id=user_id, status="pending")
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


def get_order_for_user(db: Session, order_id: int, current_user: CurrentUserPayload) -> Order:
    order = get_order(db, order_id)
    if current_user.role != "admin" and order.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own orders.",
        )

    return order


def approve_order(db: Session, order_id: int) -> Order:
    order = get_order(db, order_id)
    order.status = "approved"
    order.admin_response = "Approved by admin"
    # Future improvement: on approval, call Inventory Service or publish message to update stock.
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

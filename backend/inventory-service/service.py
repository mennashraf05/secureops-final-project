from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models import Product
from schemas import ProductCreate, ProductUpdate, StockUpdate


def normalize_sku(sku: str) -> str:
    return sku.strip().upper()


def get_product_by_sku(db: Session, sku: str) -> Product | None:
    return db.query(Product).filter(Product.sku == normalize_sku(sku)).first()


def create_product(db: Session, payload: ProductCreate, created_by: int | None) -> Product:
    sku = normalize_sku(payload.sku)
    if get_product_by_sku(db, sku):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product SKU already exists.",
        )

    product = Product(
        name=payload.name.strip(),
        sku=sku,
        category=payload.category.strip(),
        description=payload.description.strip() if payload.description else None,
        price=payload.price,
        quantity=payload.quantity,
        created_by=created_by,
    )
    db.add(product)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product SKU already exists.",
        ) from exc

    db.refresh(product)
    return product


def list_products(
    db: Session,
    *,
    search: str | None,
    category: str | None,
    low_stock_only: bool,
) -> list[Product]:
    query = db.query(Product)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(term), Product.sku.ilike(term)))

    if category:
        query = query.filter(Product.category.ilike(category.strip()))

    if low_stock_only:
        query = query.filter(Product.quantity <= 5)

    return query.order_by(Product.id.asc()).all()


def get_product(db: Session, product_id: int) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return product


def update_product(db: Session, product_id: int, payload: ProductUpdate) -> Product:
    product = get_product(db, product_id)
    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates and updates["name"] is not None:
        product.name = updates["name"].strip()
    if "category" in updates and updates["category"] is not None:
        product.category = updates["category"].strip()
    if "description" in updates:
        product.description = updates["description"].strip() if updates["description"] else None
    if "price" in updates and updates["price"] is not None:
        product.price = updates["price"]

    db.commit()
    db.refresh(product)
    return product


def update_product_stock(db: Session, product_id: int, payload: StockUpdate) -> Product:
    product = get_product(db, product_id)
    product.quantity = payload.quantity
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int) -> None:
    product = get_product(db, product_id)
    db.delete(product)
    db.commit()

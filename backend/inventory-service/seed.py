from decimal import Decimal

from sqlalchemy.orm import Session

from models import Product


SEED_PRODUCTS = [
    {
        "name": "Secure Laptop",
        "sku": "LAP-SEC-001",
        "category": "Devices",
        "price": Decimal("1200.00"),
        "quantity": 10,
    },
    {
        "name": "Network Firewall",
        "sku": "NET-FW-001",
        "category": "Network",
        "price": Decimal("850.00"),
        "quantity": 3,
    },
    {
        "name": "Encrypted USB Drive",
        "sku": "USB-ENC-001",
        "category": "Storage",
        "price": Decimal("60.00"),
        "quantity": 20,
    },
    {
        "name": "Security Camera",
        "sku": "CAM-SEC-001",
        "category": "Surveillance",
        "price": Decimal("150.00"),
        "quantity": 4,
    },
]


def seed_products(db: Session) -> None:
    if db.query(Product).first():
        return

    for item in SEED_PRODUCTS:
        db.add(Product(**item))

    db.commit()

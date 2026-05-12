import os

from sqlalchemy.orm import Session

from service import create_user_if_missing, seed_rbac


def seed_default_users(db: Session) -> None:
    seed_rbac(db)
    create_user_if_missing(
        db,
        name=os.getenv("AUTH_SEED_ADMIN_NAME", "SecureOps Admin"),
        email=os.getenv("AUTH_SEED_ADMIN_EMAIL", "admin@secureops.com"),
        password=os.getenv("AUTH_SEED_ADMIN_PASSWORD", "Admin@12345"),
        role="admin",
    )
    create_user_if_missing(
        db,
        name="SecureOps User",
        email="user@secureops.com",
        password="User@12345",
        role="user",
    )

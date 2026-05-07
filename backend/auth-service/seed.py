from sqlalchemy.orm import Session

from service import create_user_if_missing


def seed_default_users(db: Session) -> None:
    create_user_if_missing(
        db,
        name="SecureOps Admin",
        email="admin@secureops.com",
        password="Admin@12345",
        role="admin",
    )
    create_user_if_missing(
        db,
        name="SecureOps User",
        email="user@secureops.com",
        password="User@12345",
        role="user",
    )

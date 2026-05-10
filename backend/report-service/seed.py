from sqlalchemy.orm import Session


def seed_report_service(db: Session) -> None:
    # Part 6 report jobs are created by admin requests, so no seed data is required.
    return None

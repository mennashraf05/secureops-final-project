from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from jose import jwt
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from shared.config import settings
from shared.database import Base, get_db


@pytest.fixture()
def client(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    monkeypatch.setattr(main, "STORAGE_DIR", tmp_path / "vault-storage")
    monkeypatch.setattr(main, "EXPORT_DIR", tmp_path / "export")
    monkeypatch.setattr(settings, "fernet_key", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "master_key", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "file_max_upload_mb", 1)
    monkeypatch.setattr(main, "MAX_FILE_SIZE_BYTES", 1024 * 1024)
    audit_events = []
    monkeypatch.setattr(main, "send_audit_event", lambda *args, **kwargs: audit_events.append((args, kwargs)))
    main.master_fernet = None
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    db.add_all([
        main.User(id=1, email="owner@example.com", role="user", is_active=True),
        main.User(id=2, email="other@example.com", role="user", is_active=True),
        main.User(id=3, email="admin@example.com", role="admin", is_active=True),
    ])
    db.commit()
    db.close()

    def override_get_db():
        database = TestingSessionLocal()
        try:
            yield database
        finally:
            database.close()

    main.app.dependency_overrides[get_db] = override_get_db
    with TestClient(main.app) as test_client:
        test_client.audit_events = audit_events
        yield test_client
    main.app.dependency_overrides.clear()


def token_for(user_id: int, role: str = "user") -> str:
    payload = {
        "sub": str(user_id),
        "email": f"user{user_id}@example.com",
        "role": role,
        "jti": uuid4().hex,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def auth_headers(user_id: int = 1, role: str = "user") -> dict[str, str]:
    return {"Authorization": f"Bearer {token_for(user_id, role)}"}


def upload(client: TestClient, filename: str, content: bytes, mime_type: str, user_id: int = 1):
    return client.post(
        "/files/upload",
        headers=auth_headers(user_id),
        files={"file": (filename, content, mime_type)},
    )


def test_valid_file_is_accepted_and_stored_encrypted(client):
    plaintext = b"secure inventory"

    response = upload(client, "inventory.txt", plaintext, "text/plain")

    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    file_id = body["data"]["id"]
    stored_files = list(Path(main.STORAGE_DIR).glob("*.enc"))
    assert len(stored_files) == 1
    encrypted_bytes = stored_files[0].read_bytes()
    assert encrypted_bytes != plaintext
    assert body["data"]["plaintext_sha256"] == main.sha256_hex(plaintext)
    assert body["data"]["encrypted_sha256"] == main.sha256_hex(encrypted_bytes)

    db = next(client.app.dependency_overrides[get_db]())
    record = db.query(main.SecureFile).filter(main.SecureFile.id == file_id).first()
    assert record.encrypted_file_key
    assert record.encrypted_file_key.encode() != record.plaintext_sha256.encode()
    db.close()

    download = client.get(f"/files/{file_id}/download", headers=auth_headers())
    assert download.status_code == 200
    assert download.content == plaintext


def test_invalid_extension_is_rejected(client):
    response = upload(client, "notes.md", b"content", "text/plain")

    assert response.status_code == 400
    assert response.json()["success"] is False
    assert list(Path(main.STORAGE_DIR).glob("*")) == []


def test_invalid_mime_type_is_rejected(client):
    response = upload(client, "notes.txt", b"content", "application/pdf")

    assert response.status_code == 400
    assert response.json()["success"] is False


def test_invalid_magic_bytes_are_rejected(client):
    response = upload(client, "fake.pdf", b"not a real pdf", "application/pdf")

    assert response.status_code == 400
    assert response.json()["success"] is False


def test_oversized_file_is_rejected(client):
    response = upload(client, "large.txt", b"a" * (main.MAX_FILE_SIZE_BYTES + 1), "text/plain")

    assert response.status_code == 413
    assert response.json()["success"] is False
    assert list(Path(main.STORAGE_DIR).glob("*")) == []


def test_dangerous_and_double_extensions_are_rejected(client):
    dangerous = upload(client, "payload.exe", b"MZ", "application/octet-stream")
    double_extension = upload(client, "invoice.pdf.exe", b"MZ", "application/octet-stream")

    assert dangerous.status_code == 400
    assert double_extension.status_code == 400


def test_blocked_upload_is_audited(client):
    response = upload(client, "payload.exe", b"MZ", "application/octet-stream")

    assert response.status_code == 400
    assert client.audit_events
    args, kwargs = client.audit_events[-1]
    assert args[0] == "file.upload.blocked"
    assert args[2] == "blocked"
    assert kwargs["details"]["reason"] == "This file type is not allowed."


def test_unauthorized_and_cross_user_downloads_are_blocked(client):
    upload_response = upload(client, "owner.txt", b"owner-data", "text/plain", user_id=1)
    file_id = upload_response.json()["data"]["id"]

    no_token = client.get(f"/files/{file_id}/download")
    other_user = client.get(f"/files/{file_id}/download", headers=auth_headers(user_id=2))
    admin_user = client.get(f"/files/{file_id}/download", headers=auth_headers(user_id=3, role="admin"))

    assert no_token.status_code == 401
    assert other_user.status_code == 403
    assert admin_user.status_code == 200
    assert admin_user.content == b"owner-data"


def test_integrity_passes_then_fails_after_tamper(client):
    upload_response = upload(client, "verify.txt", b"verify-me", "text/plain")
    file_id = upload_response.json()["data"]["id"]

    verify_ok = client.post(f"/files/{file_id}/verify-integrity", headers=auth_headers())
    assert verify_ok.status_code == 200
    assert verify_ok.json()["data"]["integrity_status"] == "passed"

    stored_file = next(Path(main.STORAGE_DIR).glob("*.enc"))
    stored_file.write_bytes(b"tampered encrypted bytes")

    verify_failed = client.post(f"/files/{file_id}/verify-integrity", headers=auth_headers())
    download_failed = client.get(f"/files/{file_id}/download", headers=auth_headers())

    assert verify_failed.status_code == 200
    assert verify_failed.json()["data"]["integrity_status"] == "failed"
    assert download_failed.status_code == 409

from contextlib import asynccontextmanager
from contextlib import suppress
import asyncio
import csv
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import re
import shutil
import zipfile
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import Boolean, DateTime, Integer, String, Text, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from shared.config import settings
from shared.audit_client import send_audit_event
from shared.database import Base, SessionLocal, engine, get_db
from shared.errors import safe_exception_handler, safe_http_exception_handler
from shared.request_utils import get_client_ip
from shared.responses import success_response


SERVICE_NAME = "file-service"
ENCRYPTION_ALGORITHM = "Fernet"
READ_CHUNK_SIZE = 1024 * 1024
FILENAME_PATTERN = re.compile(r"^[a-f0-9]{32}\.[a-z0-9]+\.enc$")
ALLOWED_MIME_TYPES = {
    "csv": {"text/csv", "application/csv", "application/vnd.ms-excel"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    "jpeg": {"image/jpeg"},
    "jpg": {"image/jpeg"},
    "pdf": {"application/pdf"},
    "png": {"image/png"},
    "txt": {"text/plain"},
    "xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}
DANGEROUS_EXTENSIONS = {
    "bat",
    "cmd",
    "com",
    "dll",
    "exe",
    "html",
    "htm",
    "jar",
    "js",
    "msi",
    "php",
    "ps1",
    "py",
    "sh",
    "vbs",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def configured_allowed_extensions() -> set[str]:
    configured = {
        extension.strip().lower().lstrip(".")
        for extension in settings.file_allowed_extensions.split(",")
        if extension.strip()
    }
    safe_supported = set(ALLOWED_MIME_TYPES) - DANGEROUS_EXTENSIONS
    return configured & safe_supported


STORAGE_DIR = Path(settings.file_storage_path)
EXPORT_DIR = Path(settings.file_export_path)
MAX_FILE_SIZE_BYTES = settings.file_max_upload_mb * 1024 * 1024
ALLOWED_EXTENSIONS = configured_allowed_extensions()


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    token_jti: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SecureFile(Base):
    __tablename__ = "secure_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    safe_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(160), nullable=False)
    extension: Mapped[str] = mapped_column(String(20), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    plaintext_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    encrypted_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    encryption_algorithm: Mapped[str] = mapped_column(String(50), nullable=False, default=ENCRYPTION_ALGORITHM)
    encrypted_file_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class AuthenticatedUser(BaseModel):
    id: int
    email: str
    role: str


class StoredFileResponse(BaseModel):
    id: int
    owner_user_id: int
    original_filename: str
    safe_filename: str
    content_type: str
    extension: str
    size_bytes: int
    plaintext_sha256: str
    encrypted_sha256: str
    encryption_algorithm: str
    status: str
    created_at: datetime
    integrity_status: str
    download_url: str


class IntegrityResponse(BaseModel):
    file_id: int
    integrity_status: str
    encrypted_sha256_matches: bool


bearer_scheme = HTTPBearer(auto_error=False)
master_fernet: Fernet | None = None


def load_master_fernet() -> Fernet:
    if not settings.master_key:
        raise RuntimeError(
            "Missing MASTER_KEY. Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(settings.master_key.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        raise RuntimeError(
            "Invalid MASTER_KEY. Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        ) from exc


def run_local_migrations() -> None:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE secure_files ADD COLUMN IF NOT EXISTS encrypted_file_key TEXT"))
        if settings.fernet_key:
            try:
                encrypted_legacy_key = require_master_fernet().encrypt(settings.fernet_key.encode("utf-8")).decode("utf-8")
            except (ValueError, TypeError):
                encrypted_legacy_key = None
            if encrypted_legacy_key:
                connection.execute(
                    text("UPDATE secure_files SET encrypted_file_key = :encrypted_file_key WHERE encrypted_file_key IS NULL"),
                    {"encrypted_file_key": encrypted_legacy_key},
                )


@asynccontextmanager
async def lifespan(app: FastAPI):
    global master_fernet
    master_fernet = load_master_fernet()
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    run_local_migrations()
    db = SessionLocal()
    try:
        sync_live_export(db)
    finally:
        db.close()
    sync_task = asyncio.create_task(periodic_live_export_sync())
    try:
        yield
    finally:
        sync_task.cancel()
        with suppress(asyncio.CancelledError):
            await sync_task


app = FastAPI(title="SecureOps File Service", lifespan=lifespan)
app.add_exception_handler(Exception, safe_exception_handler)
app.add_exception_handler(HTTPException, safe_http_exception_handler)


def health_response() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "healthy"}


@app.get("/health")
def health() -> dict[str, str]:
    return health_response()


@app.get("/files/health")
def gateway_health() -> dict[str, str]:
    return health_response()


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise authentication_error()

    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload.get("sub", ""))
        token_jti = str(payload.get("jti", ""))
        token_role = str(payload.get("role") or "").lower()
    except (JWTError, TypeError, ValueError):
        raise authentication_error() from None

    if not token_jti:
        raise authentication_error()

    if db.query(RevokedToken).filter(RevokedToken.token_jti == token_jti).first():
        raise authentication_error()

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise authentication_error()

    role = "admin" if token_role == "admin" or user.role == "admin" else "user"
    return AuthenticatedUser(id=user.id, email=user.email, role=role)


def is_admin(user: AuthenticatedUser) -> bool:
    return user.role == "admin"


def safe_original_name(filename: str | None) -> str:
    raw_name = (filename or "").strip()
    if any(character in raw_name for character in ("\\", "/", "\x00")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name contains invalid characters.")

    name = Path(raw_name).name
    if not name or name in {".", ".."}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid file name is required.")
    return name


def extension_parts(filename: str) -> list[str]:
    return [part.lower() for part in Path(filename).suffixes if part]


def validate_file_metadata(filename: str, content_type: str | None) -> tuple[str, str, str]:
    suffixes = extension_parts(filename)
    if not suffixes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File extension is required.")

    extensions = [suffix.lstrip(".") for suffix in suffixes]
    if any(extension in DANGEROUS_EXTENSIONS for extension in extensions):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This file type is not allowed.")
    if len(extensions) > 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Double extensions are not allowed.")

    extension = extensions[0]
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File extension is not allowed.")

    mime_type = (content_type or "").lower().split(";")[0].strip()
    if mime_type not in ALLOWED_MIME_TYPES.get(extension, set()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File MIME type is not allowed.")

    safe_name = f"{Path(filename).stem[:80]}.{extension}"
    return extension, mime_type, safe_name


def validate_magic_bytes(extension: str, content: bytes) -> None:
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File cannot be empty.")

    if extension == "pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF signature is invalid.")
    if extension == "png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PNG signature is invalid.")
    if extension in {"jpg", "jpeg"} and not content.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="JPEG signature is invalid.")
    if extension in {"docx", "xlsx"} and not content.startswith(b"PK\x03\x04"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Office document signature is invalid.")
    if extension in {"txt", "csv"}:
        if b"\x00" in content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text file contains invalid binary data.")
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text file must be valid UTF-8.") from None


async def read_upload_plaintext(file: UploadFile) -> bytes:
    chunks: list[bytes] = []
    size = 0
    try:
        while chunk := await file.read(READ_CHUNK_SIZE):
            size += len(chunk)
            if size > MAX_FILE_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File size exceeds the allowed limit of {settings.file_max_upload_mb}MB.",
                )
            chunks.append(chunk)
    finally:
        await file.close()
    return b"".join(chunks)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require_master_fernet() -> Fernet:
    if master_fernet is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="File encryption is not configured.")
    return master_fernet


def encrypt_plaintext_with_file_key(plaintext: bytes) -> tuple[bytes, str]:
    file_key = Fernet.generate_key()
    encrypted_content = Fernet(file_key).encrypt(plaintext)
    encrypted_file_key = require_master_fernet().encrypt(file_key).decode("utf-8")
    return encrypted_content, encrypted_file_key


def decrypt_file_key(record: SecureFile) -> bytes:
    if not record.encrypted_file_key:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="File encryption metadata is missing.")
    try:
        return require_master_fernet().decrypt(record.encrypted_file_key.encode("utf-8"))
    except InvalidToken:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="File encryption metadata is invalid.") from None


def stored_path_for(stored_filename: str) -> Path:
    if not FILENAME_PATTERN.match(stored_filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid stored file name.")
    return STORAGE_DIR / stored_filename


def file_response(record: SecureFile) -> StoredFileResponse:
    integrity_ok = stored_path_for(record.stored_filename).is_file() and verify_encrypted_hash(record)
    return StoredFileResponse(
        id=record.id,
        owner_user_id=record.owner_user_id,
        original_filename=record.original_filename,
        safe_filename=record.safe_filename,
        content_type=record.content_type,
        extension=record.extension,
        size_bytes=record.size_bytes,
        plaintext_sha256=record.plaintext_sha256,
        encrypted_sha256=record.encrypted_sha256,
        encryption_algorithm=record.encryption_algorithm,
        status=record.status,
        created_at=record.created_at,
        integrity_status="passed" if integrity_ok else "failed",
        download_url=f"/files/{record.id}/download",
    )


def query_accessible_file(db: Session, file_id: int, user: AuthenticatedUser) -> SecureFile:
    record = db.query(SecureFile).filter(SecureFile.id == file_id, SecureFile.status == "active").first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    if not is_admin(user) and record.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this file.")
    return record


def verify_encrypted_hash(record: SecureFile) -> bool:
    path = stored_path_for(record.stored_filename)
    if not path.is_file():
        return False
    return sha256_hex(path.read_bytes()) == record.encrypted_sha256


def write_live_zip() -> None:
    zip_path = EXPORT_DIR / "encrypted-vault-files-latest.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for filename in ("manifest.csv", "actions.csv"):
            path = EXPORT_DIR / filename
            if path.is_file():
                archive.write(path, filename)
        vault_dir = EXPORT_DIR / "vault"
        if vault_dir.is_dir():
            for path in sorted(vault_dir.glob("*.enc")):
                archive.write(path, f"vault/{path.name}")


async def periodic_live_export_sync() -> None:
    while True:
        await asyncio.sleep(5)
        db = SessionLocal()
        try:
            sync_live_export(db)
        except Exception as exc:
            print(f"Vault export sync warning: {exc.__class__.__name__}", flush=True)
        finally:
            db.close()


def sync_live_export(db: Session) -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    export_vault_dir = EXPORT_DIR / "vault"
    export_vault_dir.mkdir(parents=True, exist_ok=True)

    active_records = db.query(SecureFile).filter(SecureFile.status == "active").order_by(SecureFile.id).all()
    active_stored_names = {record.stored_filename for record in active_records}

    for exported_file in export_vault_dir.glob("*.enc"):
        if exported_file.name not in active_stored_names:
            exported_file.unlink(missing_ok=True)

    for record in active_records:
        source = stored_path_for(record.stored_filename)
        if source.is_file():
            shutil.copy2(source, export_vault_dir / record.stored_filename)

    with (EXPORT_DIR / "manifest.csv").open("w", newline="", encoding="utf-8") as manifest:
        writer = csv.writer(manifest)
        writer.writerow([
            "id",
            "owner_user_id",
            "original_filename",
            "stored_filename",
            "content_type",
            "size_bytes",
            "status",
            "created_at",
        ])
        for record in db.query(SecureFile).order_by(SecureFile.id).all():
            writer.writerow([
                record.id,
                record.owner_user_id,
                record.original_filename,
                record.stored_filename,
                record.content_type,
                record.size_bytes,
                record.status,
                record.created_at.isoformat(),
            ])

    actions_path = EXPORT_DIR / "actions.csv"
    if not actions_path.exists():
        with actions_path.open("w", newline="", encoding="utf-8") as actions:
            writer = csv.writer(actions)
            writer.writerow(["timestamp", "user_id", "file_id", "action", "status", "ip_address", "details"])

    write_live_zip()


def append_live_action(
    action: str,
    *,
    current_user: AuthenticatedUser,
    file_id: int | None,
    request: Request,
    status_value: str,
    details: dict[str, object] | None,
) -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    actions_path = EXPORT_DIR / "actions.csv"
    new_file = not actions_path.exists()
    with actions_path.open("a", newline="", encoding="utf-8") as actions:
        writer = csv.writer(actions)
        if new_file:
            writer.writerow(["timestamp", "user_id", "file_id", "action", "status", "ip_address", "details"])
        writer.writerow([
            utc_now().isoformat(),
            current_user.id,
            file_id or "",
            action,
            status_value,
            get_client_ip(request) or "",
            str(details or {}),
        ])


def audit_file_action(
    action: str,
    *,
    current_user: AuthenticatedUser,
    file_id: int | None,
    request: Request,
    status_value: str = "success",
    details: dict[str, object] | None = None,
) -> None:
    payload = {"file_id": file_id, **(details or {})}
    append_live_action(
        action,
        current_user=current_user,
        file_id=file_id,
        request=request,
        status_value=status_value,
        details=payload,
    )
    send_audit_event(
        action,
        SERVICE_NAME,
        status_value,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        details=payload,
    )


def audit_blocked_upload(
    *,
    current_user: AuthenticatedUser,
    request: Request,
    filename: str | None,
    content_type: str | None,
    reason: str,
) -> None:
    audit_file_action(
        "file.upload.blocked",
        current_user=current_user,
        file_id=None,
        request=request,
        status_value="blocked",
        details={
            "original_filename": filename or "",
            "content_type": content_type or "",
            "reason": reason,
        },
    )
    write_live_zip()


@app.post("/files/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        original_name = safe_original_name(file.filename)
        extension, mime_type, safe_name = validate_file_metadata(original_name, file.content_type)
        plaintext = await read_upload_plaintext(file)
        validate_magic_bytes(extension, plaintext)
    except HTTPException as exc:
        reason = exc.detail if isinstance(exc.detail, str) else "File upload rejected."
        audit_blocked_upload(
            current_user=current_user,
            request=request,
            filename=file.filename,
            content_type=file.content_type,
            reason=reason,
        )
        raise

    plaintext_hash = sha256_hex(plaintext)
    encrypted, encrypted_file_key = encrypt_plaintext_with_file_key(plaintext)
    encrypted_hash = sha256_hex(encrypted)

    stored_filename = f"{uuid4().hex}.{extension}.enc"
    destination = stored_path_for(stored_filename)
    destination.write_bytes(encrypted)

    record = SecureFile(
        owner_user_id=current_user.id,
        original_filename=original_name,
        safe_filename=safe_name,
        stored_filename=stored_filename,
        storage_path=str(destination),
        content_type=mime_type,
        extension=extension,
        size_bytes=len(plaintext),
        plaintext_sha256=plaintext_hash,
        encrypted_sha256=encrypted_hash,
        encryption_algorithm=ENCRYPTION_ALGORITHM,
        encrypted_file_key=encrypted_file_key,
        status="active",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    audit_file_action(
        "file.uploaded",
        current_user=current_user,
        file_id=record.id,
        request=request,
        details={"original_filename": original_name, "size_bytes": len(plaintext), "content_type": mime_type},
    )
    sync_live_export(db)
    return success_response("File uploaded successfully.", file_response(record).model_dump(mode="json"))


@app.get("/files")
def list_files(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    query = db.query(SecureFile).filter(SecureFile.status == "active").order_by(SecureFile.created_at.desc())
    if not is_admin(current_user):
        query = query.filter(SecureFile.owner_user_id == current_user.id)
    sync_live_export(db)
    return success_response("Files retrieved successfully.", [file_response(record).model_dump(mode="json") for record in query.all()])


@app.get("/files/{file_id}")
def get_file(
    file_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    record = query_accessible_file(db, file_id, current_user)
    sync_live_export(db)
    return success_response("File retrieved successfully.", file_response(record).model_dump(mode="json"))


@app.get("/files/{file_id}/download")
def download_file(
    request: Request,
    file_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    record = query_accessible_file(db, file_id, current_user)
    if not verify_encrypted_hash(record):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="File integrity verification failed.")

    encrypted = stored_path_for(record.stored_filename).read_bytes()
    try:
        plaintext = Fernet(decrypt_file_key(record)).decrypt(encrypted)
    except InvalidToken:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="File decryption failed.") from None

    if sha256_hex(plaintext) != record.plaintext_sha256:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="File integrity verification failed.")

    audit_file_action(
        "file.downloaded",
        current_user=current_user,
        file_id=record.id,
        request=request,
        details={"original_filename": record.original_filename, "size_bytes": record.size_bytes},
    )
    sync_live_export(db)
    return Response(
        content=plaintext,
        media_type=record.content_type,
        headers={"Content-Disposition": f'attachment; filename="{record.safe_filename}"'},
    )


@app.post("/files/{file_id}/verify-integrity")
def verify_integrity(
    request: Request,
    file_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    record = query_accessible_file(db, file_id, current_user)
    encrypted_ok = verify_encrypted_hash(record)
    audit_file_action(
        "file.integrity.verified",
        current_user=current_user,
        file_id=record.id,
        request=request,
        status_value="success" if encrypted_ok else "failure",
        details={"original_filename": record.original_filename, "integrity_status": "passed" if encrypted_ok else "failed"},
    )
    sync_live_export(db)
    data = IntegrityResponse(
        file_id=record.id,
        integrity_status="passed" if encrypted_ok else "failed",
        encrypted_sha256_matches=encrypted_ok,
    )
    return success_response("Integrity verification completed.", data.model_dump())


@app.delete("/files/{file_id}")
def delete_file(
    request: Request,
    file_id: int,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    record = query_accessible_file(db, file_id, current_user)
    record.status = "deleted"
    record.updated_at = utc_now()
    stored_path_for(record.stored_filename).unlink(missing_ok=True)
    db.commit()
    audit_file_action(
        "file.deleted",
        current_user=current_user,
        file_id=file_id,
        request=request,
        details={"original_filename": record.original_filename},
    )
    sync_live_export(db)
    return success_response("File deleted successfully.", {"id": file_id})


def manual_valid_file_check() -> str:
    return "Upload a .txt/.pdf/.png/.jpg file with a valid JWT; expect 201 and secure file metadata."


def manual_invalid_file_check() -> str:
    return "Upload .exe, double extension, bad MIME, or bad magic bytes; expect 400."


def manual_oversized_file_check() -> str:
    return f"Upload a file larger than {settings.file_max_upload_mb}MB; expect 413."


def manual_encrypted_storage_check() -> str:
    return "Inspect /app/file-service/storage/vault; stored .enc bytes must differ from original plaintext."


def manual_unauthorized_access_check() -> str:
    return "Call download without JWT for 401 or with another non-admin owner for 403."

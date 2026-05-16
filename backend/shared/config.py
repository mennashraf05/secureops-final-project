from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    postgres_db: str
    postgres_user: str
    postgres_password: str
    database_url: str

    rabbitmq_user: str
    rabbitmq_password: str
    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 180

    internal_api_key: str
    fernet_key: str
    master_key: str | None = None

    file_max_upload_mb: int = 10
    file_allowed_extensions: str = "pdf,txt,csv,png,jpg,jpeg,docx,xlsx"
    file_storage_path: str = "/app/file-service/storage/vault"
    file_export_path: str = "/app/file-service/export"

    frontend_port: int = 5173
    github_client_id: str | None = None
    github_client_secret: str | None = None
    github_oauth_redirect_uri: str | None = None
    frontend_url: str = "http://localhost:8080"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

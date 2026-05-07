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
    access_token_expire_minutes: int = 60

    internal_api_key: str
    fernet_key: str

    frontend_port: int = 5173

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

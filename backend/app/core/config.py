from functools import lru_cache

from decimal import Decimal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ==========================================
    # APPLICATION
    # ==========================================
    APP_NAME: str = "Anime Merchandise Store"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    # ==========================================
    # SECURITY
    # ==========================================
    SECRET_KEY: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
    JWT_SECRET_KEY: str = "CHANGE_THIS_TO_ANOTHER_RANDOM_SECRET"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AUTH_COOKIE_SECURE: bool = False
    AUTH_COOKIE_SAMESITE: str = "lax"

    # ==========================================
    # GOOGLE OAUTH 2.0 LOGIN
    # ==========================================
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"
    GOOGLE_FRONTEND_REDIRECT_URI: str = "http://localhost:5173/auth/google/callback"

    GOOGLE_AUTH_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL: str = "https://www.googleapis.com/oauth2/v3/userinfo"
    GOOGLE_SCOPES: str = "openid email profile"

    # ==========================================
    # MYSQL DATABASE
    # ==========================================
    DB_HOST: str = "mysql"
    DB_PORT: int = 3306
    DB_NAME: str = "merchandise_db"
    DB_USER: str = "merchandise_user"
    DB_PASSWORD: str = "CHANGE_THIS_PASSWORD"

    # SQLAlchemy
    DATABASE_URL: str = ""

    # ==========================================
    # REDIS
    # ==========================================
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0

    REDIS_URL: str = "redis://redis:6379/0"

    # ==========================================
    # RUSTFS OBJECT STORAGE (S3 compatible)
    # ==========================================
    S3_ENDPOINT_URL: str = "http://rustfs:9000"
    S3_PUBLIC_ENDPOINT: str = "https://storage.example.com"

    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "us-east-1"

    S3_BUCKET_PRODUCTS: str = "merchandise-bucket"
    S3_BUCKET_PRIVATE: str = "private"
    S3_USE_SSL: bool = False

    # Batas ukuran file gambar produk yang diunggah lewat admin.
    MAX_UPLOAD_MB: int = 5

    # ==========================================
    # MIDTRANS PAYMENT GATEWAY
    # ==========================================
    MIDTRANS_IS_PRODUCTION: bool = False

    MIDTRANS_MERCHANT_ID: str = ""
    MIDTRANS_CLIENT_KEY: str = ""
    MIDTRANS_SERVER_KEY: str = ""

    MIDTRANS_SNAP_API_URL: str = "https://app.sandbox.midtrans.com/snap/v1/transactions"
    MIDTRANS_SNAP_JS_URL: str = "https://app.sandbox.midtrans.com/snap/snap.js"

    # ==========================================
    # PAYMENT CALLBACK
    # ==========================================
    MIDTRANS_NOTIFICATION_URL: str = ""

    # ==========================================
    # ORDER / CHECKOUT
    # ==========================================
    ORDER_PREFIX: str = "INV"
    ORDER_CURRENCY: str = "IDR"
    DEFAULT_SHIPPING_COST: Decimal = Decimal("0.00")

    # ==========================================
    # CORS
    # ==========================================
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cookie_samesite(self) -> str:
        value = self.AUTH_COOKIE_SAMESITE.lower()
        return value if value in {"lax", "strict", "none"} else "lax"

    @property
    def auth_cookie_secure(self) -> bool:
        return self.AUTH_COOKIE_SECURE or self.cookie_samesite == "none" or self.APP_ENV.lower() in {"production", "prod"}

    @property
    def cors_origins(self) -> list[str]:
        """CORS_ORIGINS as a list, accepting comma separated values."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def google_scopes(self) -> list[str]:
        """GOOGLE_SCOPES as a list, accepting space or comma separated values."""
        return [scope for scope in self.GOOGLE_SCOPES.replace(",", " ").split() if scope]

    @property
    def google_oauth_enabled(self) -> bool:
        """True when Google login credentials have been filled in with real values."""
        if not self.GOOGLE_CLIENT_ID or not self.GOOGLE_CLIENT_SECRET:
            return False
        if self.GOOGLE_CLIENT_ID.startswith("xxxx") or "CHANGE_THIS" in self.GOOGLE_CLIENT_SECRET:
            return False
        return True

    @property
    def sqlalchemy_url(self) -> str:
        """DATABASE_URL, or build it from the individual DB_* values."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

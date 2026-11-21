from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150, examples=["Budi Santoso"])
    email: EmailStr = Field(examples=["budi@example.com"])
    password: str = Field(min_length=8, max_length=128, examples=["rahasia123"])


class LoginRequest(BaseModel):
    email: EmailStr = Field(examples=["budi@example.com"])
    password: str = Field(examples=["rahasia123"])


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Masa berlaku access token dalam detik")

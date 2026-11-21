"""Helper Google OAuth 2.0 (Authorization Code flow)."""

from __future__ import annotations

from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.security import create_google_state

TIMEOUT = httpx.Timeout(10.0)


class GoogleOAuthError(Exception):
    """Gagal berkomunikasi dengan Google."""


def build_authorization_url() -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(settings.google_scopes),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "select_account",
        "state": create_google_state(),
    }
    return f"{settings.GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(settings.GOOGLE_TOKEN_URL, data=data)

    if response.status_code != httpx.codes.OK:
        raise GoogleOAuthError(f"Tukar authorization code gagal: {response.text[:200]}")
    return response.json()


async def fetch_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(
            settings.GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code != httpx.codes.OK:
        raise GoogleOAuthError(f"Ambil profil Google gagal: {response.text[:200]}")
    return response.json()

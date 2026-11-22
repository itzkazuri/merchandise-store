"""Penyimpanan objek S3-compatible (RustFS) untuk gambar produk."""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import quote
from uuid import uuid4

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

ALLOWED_IMAGE_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
    (b"GIF87a", "gif", "image/gif"),
    (b"GIF89a", "gif", "image/gif"),
)


class StorageError(RuntimeError):
    """Kegagalan saat berbicara dengan object storage."""


@dataclass(frozen=True)
class StoredImage:
    object_key: str
    url: str
    content_type: str
    size: int


_bucket_lock = threading.Lock()
_bucket_ready = False


def _public_endpoint() -> str:
    return (settings.S3_PUBLIC_ENDPOINT or settings.S3_ENDPOINT_URL).rstrip("/")


def public_product_url(object_key: str) -> str:
    """URL publik untuk object key di bucket produk."""
    key = object_key.lstrip("/")
    return f"{_public_endpoint()}/{quote(settings.S3_BUCKET_PRODUCTS)}/{quote(key, safe='/')}"


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        use_ssl=settings.S3_USE_SSL,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def _ensure_bucket(client) -> None:
    """Buat bucket produk + izin baca publik sekali saat upload pertama."""
    global _bucket_ready
    if _bucket_ready:
        return

    with _bucket_lock:
        if _bucket_ready:
            return

        bucket = settings.S3_BUCKET_PRODUCTS
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") not in {"404", "NoSuchBucket", "NotFound"}:
                raise
            client.create_bucket(Bucket=bucket)

        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
        try:
            client.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
        except ClientError:
            # Bucket tetap bisa dipakai; izinkan object storage dikelola manual.
            pass

        _bucket_ready = True


def detect_image_type(data: bytes) -> tuple[str, str] | None:
    """Tentukan ekstensi + MIME dari magic bytes, bukan dari nama file."""
    for signature, extension, content_type in ALLOWED_IMAGE_SIGNATURES:
        if data.startswith(signature):
            return extension, content_type

    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"

    if data[4:12] in {b"ftypavif", b"ftypavis"}:
        return "avif", "image/avif"

    return None


def upload_product_image(data: bytes) -> StoredImage:
    """Upload bytes gambar ke bucket produk dan kembalikan key + URL publik."""
    detected = detect_image_type(data)
    if detected is None:
        raise StorageError("File bukan gambar JPG, PNG, WebP, GIF, atau AVIF yang valid.")

    extension, content_type = detected
    now = datetime.now(UTC)
    # Bucket produk sudah bernama "merchandise-bucket", jadi key tidak perlu prefix itu lagi.
    object_key = f"{now:%Y/%m}/{uuid4().hex}.{extension}"

    client = _client()
    try:
        _ensure_bucket(client)
        client.put_object(
            Bucket=settings.S3_BUCKET_PRODUCTS,
            Key=object_key,
            Body=data,
            ContentType=content_type,
            CacheControl="public, max-age=31536000, immutable",
        )
    except (BotoCoreError, ClientError) as exc:
        raise StorageError("Gambar gagal diunggah ke object storage.") from exc

    return StoredImage(
        object_key=object_key,
        url=public_product_url(object_key),
        content_type=content_type,
        size=len(data),
    )

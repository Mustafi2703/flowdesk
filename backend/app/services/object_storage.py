"""S3-compatible object storage (Cloudflare R2 / AWS S3 / MinIO).

When R2_* / S3_* env vars are set, uploads go to the bucket and Postgres only
stores metadata (no BYTEA). Falls back to DB/disk when unset.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def storage_enabled() -> bool:
    return bool(
        settings.s3_bucket
        and settings.s3_access_key_id
        and settings.s3_secret_access_key
        and (settings.s3_endpoint_url or settings.s3_region)
    )


def _client():  # type: ignore[no-untyped-def]
    import boto3
    from botocore.config import Config

    kwargs: dict[str, Any] = {
        "service_name": "s3",
        "aws_access_key_id": settings.s3_access_key_id,
        "aws_secret_access_key": settings.s3_secret_access_key,
        "region_name": settings.s3_region or "auto",
        "config": Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client(**kwargs)


def put_object(*, key: str, body: bytes, content_type: str | None) -> str:
    """Upload bytes; returns the object key."""
    extra: dict[str, Any] = {}
    if content_type:
        extra["ContentType"] = content_type
    _client().put_object(Bucket=settings.s3_bucket, Key=key, Body=body, **extra)
    return key


def get_object_bytes(key: str) -> bytes | None:
    try:
        resp = _client().get_object(Bucket=settings.s3_bucket, Key=key)
        return resp["Body"].read()
    except Exception as exc:  # noqa: BLE001
        logger.warning("object get failed key=%s err=%s", key, exc)
        return None


def delete_object(key: str) -> None:
    try:
        _client().delete_object(Bucket=settings.s3_bucket, Key=key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("object delete failed key=%s err=%s", key, exc)


def object_key(entity_type: str, entity_id: str, stored_name: str) -> str:
    prefix = (settings.s3_prefix or "uploads").strip("/")
    return f"{prefix}/{entity_type}/{entity_id}/{stored_name}"

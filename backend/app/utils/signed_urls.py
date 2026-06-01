import hashlib
import hmac
import time

from app.config import get_settings

DEFAULT_EXPIRY_SECONDS = 3600


def _get_image_signing_key() -> bytes:
    settings = get_settings()
    return hmac.new(settings.secret_key.encode(), b"image-url-signing", hashlib.sha256).digest()


def sign_image_url(path: str, expiry_seconds: int = DEFAULT_EXPIRY_SECONDS) -> str:
    expires = int(time.time()) + expiry_seconds

    message = f"{path}:{expires}"
    signature = hmac.new(_get_image_signing_key(), message.encode(), hashlib.sha256).hexdigest()[
        :32
    ]

    return f"/api/v1/images/{path}?expires={expires}&sig={signature}"


def sign_immich_asset_url(
    item_id: str, variant: str = "thumbnail", expiry_seconds: int = DEFAULT_EXPIRY_SECONDS
) -> str:
    expires = int(time.time()) + expiry_seconds
    path = f"immich/{item_id}/{variant}"
    signature = hmac.new(_get_image_signing_key(), f"{path}:{expires}".encode(), hashlib.sha256)
    sig = signature.hexdigest()[:32]
    return f"/api/v1/immich/assets/{item_id}?variant={variant}&expires={expires}&sig={sig}"


def verify_signature(path: str, expires: str, signature: str) -> bool:
    try:
        expiry_time = int(expires)
        if time.time() > expiry_time:
            return False
    except (ValueError, TypeError):
        return False

    message = f"{path}:{expires}"
    expected_signature = hmac.new(
        _get_image_signing_key(), message.encode(), hashlib.sha256
    ).hexdigest()[:32]

    return hmac.compare_digest(signature, expected_signature)

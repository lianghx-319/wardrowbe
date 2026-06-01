import base64
import hashlib
import logging
import tempfile
from io import BytesIO
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

import httpx
from arq import create_pool
from cryptography.fernet import Fernet, InvalidToken
from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.item import ClothingItem, ImmichConnection, ImmichConnectionStatus
from app.services.image_service import ImageService
from app.services.item_service import ItemService
from app.workers.settings import get_redis_settings

logger = logging.getLogger(__name__)


class ImmichServiceError(Exception):
    pass


def _browser_safe_image(data: bytes, content_type: str) -> tuple[bytes, str]:
    normalized_type = content_type.split(";", 1)[0].strip().lower()
    has_heif_signature = len(data) > 12 and data[4:8] == b"ftyp" and data[8:12] in {
        b"heic",
        b"heix",
        b"hevc",
        b"hevx",
        b"mif1",
        b"msf1",
    }
    if normalized_type not in {"image/heic", "image/heif"} and not has_heif_signature:
        return data, content_type

    try:
        from pillow_heif import register_heif_opener

        register_heif_opener()
        image = Image.open(BytesIO(data))
        image = ImageOps.exif_transpose(image)
        if image.mode in ("RGBA", "P", "LA"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            background.paste(image, mask=image.split()[-1] if image.mode == "RGBA" else None)
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")

        output = BytesIO()
        image.save(output, format="JPEG", quality=90, optimize=True)
        return output.getvalue(), "image/jpeg"
    except Exception:
        logger.exception("Failed to transcode Immich HEIC/HEIF preview")
        return data, content_type


class ImmichAuthError(ImmichServiceError):
    pass


class ImmichNotFoundError(ImmichServiceError):
    pass


def _fernet() -> Fernet:
    settings = get_settings()
    digest = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise ImmichServiceError("Immich API key cannot be decrypted") from exc


class ImmichClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    @property
    def headers(self) -> dict[str, str]:
        return {"x-api-key": self.api_key}

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                response = await client.request(
                    method, f"{self.base_url}/api{path}", headers=self.headers, **kwargs
                )
        except httpx.RequestError as exc:
            raise ImmichServiceError(str(exc)) from exc

        if response.status_code in (401, 403):
            raise ImmichAuthError("Immich authentication failed")
        if response.status_code == 404:
            raise ImmichNotFoundError("Immich resource not found")
        if response.status_code >= 400:
            raise ImmichServiceError(f"Immich returned HTTP {response.status_code}")
        return response

    async def get_albums(self) -> list[dict]:
        response = await self._request("GET", "/albums")
        data = response.json()
        return data if isinstance(data, list) else []

    async def get_album(self, album_id: str) -> dict:
        response = await self._request("GET", f"/albums/{album_id}")
        return response.json()

    async def download_asset(self, asset_id: str) -> tuple[bytes, str]:
        response = await self._request("GET", f"/assets/{asset_id}/original")
        content_type = response.headers.get("content-type", "image/jpeg")
        return response.content, content_type

    async def stream_asset(self, asset_id: str, variant: str) -> tuple[bytes, str]:
        if variant == "original":
            return await self.download_asset(asset_id)

        size = "thumbnail" if variant == "thumbnail" else "preview"
        response = await self._request("GET", f"/assets/{asset_id}/thumbnail", params={"size": size})
        content_type = response.headers.get("content-type", "image/jpeg")
        return _browser_safe_image(response.content, content_type)

    async def search_assets(self, query: str, album_id: str | None = None, size: int = 100) -> list[dict]:
        payload: dict[str, object] = {
            "query": query,
            "type": "IMAGE",
            "size": min(max(size, 1), 1000),
            "page": 1,
        }
        if album_id:
            payload["albumIds"] = [album_id]

        response = await self._request("POST", "/search/smart", json=payload)
        return extract_search_assets(response.json())

    async def search_metadata_assets(
        self, query: str, album_id: str | None = None, size: int = 100
    ) -> list[dict]:
        payload: dict[str, object] = {
            "type": "IMAGE",
            "size": min(max(size, 1), 1000),
            "page": 1,
        }
        if album_id:
            payload["albumIds"] = [album_id]

        results: list[dict] = []
        seen: set[str] = set()
        for key in ("originalFileName", "description", "ocr"):
            try:
                response = await self._request("POST", "/search/metadata", json={**payload, key: query})
            except ImmichServiceError:
                continue
            for asset in extract_search_assets(response.json()):
                asset_id = str(asset.get("id") or "")
                if asset_id and asset_id not in seen:
                    seen.add(asset_id)
                    results.append(asset)
        return results


def get_client(connection: ImmichConnection) -> ImmichClient:
    return ImmichClient(connection.base_url, decrypt_api_key(connection.api_key_encrypted))


async def get_connection(db: AsyncSession, user_id: UUID) -> ImmichConnection | None:
    result = await db.execute(select(ImmichConnection).where(ImmichConnection.user_id == user_id))
    return result.scalar_one_or_none()


async def mark_connection_error(
    db: AsyncSession, connection: ImmichConnection | None, error: str
) -> None:
    if connection:
        connection.status = ImmichConnectionStatus.error
        connection.last_error = error[:1000]
        await db.flush()


def album_to_response(album: dict) -> dict:
    return {
        "id": str(album.get("id") or ""),
        "album_name": album.get("albumName") or album.get("album_name") or "Untitled",
        "asset_count": album.get("assetCount") or album.get("asset_count") or len(album.get("assets") or []),
    }


def extract_album_assets(album: dict) -> list[dict]:
    return [asset for asset in album.get("assets", []) if asset.get("type", "IMAGE") == "IMAGE"]


def extract_search_assets(data: object) -> list[dict]:
    assets: list[dict] = []
    seen: set[str] = set()

    def collect(value: object) -> None:
        if isinstance(value, list):
            for item in value:
                collect(item)
            return

        if not isinstance(value, dict):
            return

        asset_id = value.get("id")
        asset_type = value.get("type") or value.get("assetType")
        if asset_id and (asset_type in (None, "IMAGE") or value.get("originalFileName")):
            asset_id_str = str(asset_id)
            if asset_id_str not in seen:
                seen.add(asset_id_str)
                assets.append(value)

        for child in value.values():
            collect(child)

    collect(data)
    return assets


async def search_imported_asset_ids(db: AsyncSession, user_id: UUID, query: str) -> list[str]:
    connection = await get_connection(db, user_id)
    if connection is None or not connection.album_id:
        return []

    client = get_client(connection)
    try:
        assets = await client.search_assets(query, connection.album_id)
    except ImmichServiceError as exc:
        logger.info("Immich smart search fallback failed: %s", exc)
        assets = []

    if not assets:
        try:
            assets = await client.search_metadata_assets(query, connection.album_id)
        except ImmichServiceError as exc:
            logger.info("Immich metadata search fallback failed: %s", exc)
            return []

    return [str(asset.get("id")) for asset in assets if asset.get("id")]


async def upsert_connection(
    db: AsyncSession,
    user_id: UUID,
    base_url: str,
    album_id: str,
    album_name: str,
    api_key: str | None,
) -> ImmichConnection:
    connection = await get_connection(db, user_id)
    if connection is None:
        if not api_key:
            raise ImmichServiceError("Immich API key is required")
        connection = ImmichConnection(
            user_id=user_id,
            base_url=base_url.rstrip("/"),
            api_key_encrypted=encrypt_api_key(api_key),
            album_id=album_id,
            album_name=album_name,
            status=ImmichConnectionStatus.connected,
            last_error=None,
        )
        db.add(connection)
    else:
        connection.base_url = base_url.rstrip("/")
        if api_key:
            connection.api_key_encrypted = encrypt_api_key(api_key)
        connection.album_id = album_id
        connection.album_name = album_name
        connection.status = ImmichConnectionStatus.connected
        connection.last_error = None

    await db.flush()
    return connection


async def scan_connection(db: AsyncSession, connection: ImmichConnection) -> dict[str, int | str]:
    client = get_client(connection)
    item_service = ItemService(db)
    image_service = ImageService()
    counts = {
        "imported": 0,
        "skipped_existing_asset": 0,
        "skipped_duplicate_hash": 0,
        "failed": 0,
        "queued": 0,
    }

    try:
        album = await client.get_album(connection.album_id)
    except ImmichServiceError as exc:
        await mark_connection_error(db, connection, str(exc))
        raise

    redis = None
    try:
        redis = await create_pool(get_redis_settings())
    except Exception as exc:
        logger.error("Failed to connect to Redis for Immich scan: %s", exc)

    try:
        for asset in extract_album_assets(album):
            asset_id = str(asset.get("id") or "")
            if not asset_id:
                counts["failed"] += 1
                continue

            try:
                existing = await item_service.find_by_immich_asset(
                    connection.user_id, connection.id, asset_id
                )
                if existing:
                    counts["skipped_existing_asset"] += 1
                    continue

                filename = asset.get("originalFileName") or asset.get("originalPath") or "immich.jpg"
                raw_checksum = asset.get("checksum")
                checksum = str(raw_checksum) if raw_checksum is not None else None
                image_bytes, content_type = await client.download_asset(asset_id)
                if not image_service.validate_image(image_bytes, content_type):
                    counts["failed"] += 1
                    continue

                image_hash = image_service.compute_phash(image_bytes, filename)
                duplicate = await item_service.find_duplicate_by_hash(connection.user_id, image_hash)
                if duplicate:
                    counts["skipped_duplicate_hash"] += 1
                    continue

                item = await item_service.create_immich_item(
                    user_id=connection.user_id,
                    connection_id=connection.id,
                    asset_id=asset_id,
                    image_hash=image_hash,
                    original_filename=Path(filename).name,
                    checksum=checksum,
                )
                counts["imported"] += 1
                if redis:
                    await redis.enqueue_job(
                        "tag_item_by_id",
                        str(item.id),
                        _queue_name="arq:tagging",
                    )
                    counts["queued"] += 1
            except Exception as exc:
                logger.warning("Failed to import Immich asset %s: %s", asset_id, exc)
                counts["failed"] += 1
    finally:
        if redis:
            await redis.aclose()

    connection.status = ImmichConnectionStatus.connected
    connection.last_scan_at = datetime.now(UTC)
    connection.last_error = None
    await db.flush()
    return counts


@asynccontextmanager
async def temporary_asset_file(item: ClothingItem, db: AsyncSession) -> AsyncIterator[Path]:
    if not item.immich_connection or not item.immich_asset_id:
        raise ImmichServiceError("Item is missing Immich source metadata")

    client = get_client(item.immich_connection)
    data, content_type = await client.download_asset(item.immich_asset_id)
    image_service = ImageService()
    original_name = item.immich_original_filename or "immich.jpg"

    if "heic" in content_type or "heif" in content_type or original_name.lower().endswith(
        (".heic", ".heif")
    ):
        image = image_service._convert_heic(data)
    else:
        try:
            image = Image.open(BytesIO(data))
        except Exception:
            image = image_service._convert_heic(data)

    image = ImageOps.exif_transpose(image)
    if image.mode != "RGB":
        image = image.convert("RGB")

    temp_file = tempfile.NamedTemporaryFile(prefix="wardrowbe-immich-", suffix=".jpg", delete=False)
    temp_path = Path(temp_file.name)
    try:
        image.save(temp_file, format="JPEG", quality=90)
        temp_file.close()
        yield temp_path
    finally:
        try:
            temp_path.unlink(missing_ok=True)
        except Exception:
            logger.warning("Failed to remove temporary Immich asset file: %s", temp_path)

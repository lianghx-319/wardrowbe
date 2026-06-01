from datetime import datetime

from pydantic import BaseModel, Field


class ImmichConnectionResponse(BaseModel):
    configured: bool
    id: str | None = None
    base_url: str | None = None
    album_id: str | None = None
    album_name: str | None = None
    status: str | None = None
    last_scan_at: datetime | None = None
    last_error: str | None = None


class ImmichConnectionUpdate(BaseModel):
    base_url: str = Field(..., min_length=1, max_length=500)
    api_key: str | None = Field(None, min_length=1)
    album_id: str = Field(..., min_length=1, max_length=128)
    album_name: str = Field(default="wardrowbe", max_length=255)


class ImmichConnectionTest(BaseModel):
    base_url: str = Field(..., min_length=1, max_length=500)
    api_key: str = Field(..., min_length=1)


class ImmichAlbumResponse(BaseModel):
    id: str
    album_name: str
    asset_count: int = 0


class ImmichScanResponse(BaseModel):
    imported: int
    skipped_existing_asset: int
    skipped_duplicate_hash: int
    failed: int
    queued: int
    message: str

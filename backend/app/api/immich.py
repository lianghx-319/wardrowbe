from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.models.item import ImmichConnection, ImmichConnectionStatus
from app.schemas.immich import (
    ImmichAlbumResponse,
    ImmichConnectionResponse,
    ImmichConnectionTest,
    ImmichConnectionUpdate,
    ImmichScanResponse,
)
from app.services.immich_service import (
    ImmichAuthError,
    ImmichClient,
    ImmichNotFoundError,
    ImmichServiceError,
    album_to_response,
    get_client,
    get_connection,
    mark_connection_error,
    scan_connection,
    upsert_connection,
)
from app.services.item_service import ItemService
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.signed_urls import verify_signature

router = APIRouter(prefix="/immich", tags=["Immich"])


def _connection_response(connection: ImmichConnection | None) -> ImmichConnectionResponse:
    if not connection:
        return ImmichConnectionResponse(configured=False)
    return ImmichConnectionResponse(
        configured=True,
        id=str(connection.id),
        base_url=connection.base_url,
        album_id=connection.album_id,
        album_name=connection.album_name,
        status=connection.status.value,
        last_scan_at=connection.last_scan_at,
        last_error=connection.last_error,
    )


def _raise_immich(exc: ImmichServiceError) -> None:
    if isinstance(exc, ImmichAuthError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if isinstance(exc, ImmichNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get("/connection", response_model=ImmichConnectionResponse)
async def get_immich_connection(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ImmichConnectionResponse:
    return _connection_response(await get_connection(db, current_user.id))


@router.post("/connection/test", response_model=dict)
async def test_immich_connection(
    data: ImmichConnectionTest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    _ = current_user
    client = ImmichClient(data.base_url, data.api_key)
    try:
        albums = await client.get_albums()
    except ImmichServiceError as exc:
        _raise_immich(exc)
    return {
        "status": "connected",
        "albums": [album_to_response(album) for album in albums],
    }


@router.put("/connection", response_model=ImmichConnectionResponse)
async def save_immich_connection(
    data: ImmichConnectionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ImmichConnectionResponse:
    existing = await get_connection(db, current_user.id)
    api_key = data.api_key
    if not api_key and not existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Immich API key is required for the first binding",
        )

    try:
        connection = await upsert_connection(
            db=db,
            user_id=current_user.id,
            base_url=data.base_url,
            album_id=data.album_id,
            album_name=data.album_name,
            api_key=api_key,
        )
        await get_client(connection).get_album(connection.album_id)
    except ImmichServiceError as exc:
        if existing:
            await mark_connection_error(db, existing, str(exc))
        _raise_immich(exc)

    return _connection_response(connection)


@router.get("/albums", response_model=list[ImmichAlbumResponse])
async def list_immich_albums(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ImmichAlbumResponse]:
    connection = await get_connection(db, current_user.id)
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Immich is not bound")

    try:
        albums = await get_client(connection).get_albums()
    except ImmichServiceError as exc:
        await mark_connection_error(db, connection, str(exc))
        _raise_immich(exc)
    return [ImmichAlbumResponse(**album_to_response(album)) for album in albums]


@router.post("/scan", response_model=ImmichScanResponse)
async def scan_immich_album(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ImmichScanResponse:
    connection = await get_connection(db, current_user.id)
    if not connection:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Immich is not bound")

    try:
        result = await scan_connection(db, connection)
    except ImmichServiceError as exc:
        _raise_immich(exc)

    return ImmichScanResponse(
        imported=int(result["imported"]),
        skipped_existing_asset=int(result["skipped_existing_asset"]),
        skipped_duplicate_hash=int(result["skipped_duplicate_hash"]),
        failed=int(result["failed"]),
        queued=int(result["queued"]),
        message="Immich scan completed",
    )


@router.get("/assets/{item_id}")
async def get_immich_asset(
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)] = None,
    variant: str = Query("thumbnail", pattern="^(thumbnail|preview|original)$"),
    expires: str | None = Query(None),
    sig: str | None = Query(None),
) -> Response:
    can_access = False
    if expires and sig:
        can_access = verify_signature(f"immich/{item_id}/{variant}", expires, sig)

    item = None
    if current_user:
        item_service = ItemService(db)
        item = await item_service.get_by_id(item_id, current_user.id)
        can_access = can_access or item is not None

    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models.item import ClothingItem

    result = await db.execute(
        select(ClothingItem)
        .where(ClothingItem.id == item_id)
        .options(selectinload(ClothingItem.immich_connection))
    )
    item = result.scalar_one_or_none()

    if not can_access or not item or not item.immich_connection or not item.immich_asset_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access denied")

    try:
        data, media_type = await get_client(item.immich_connection).stream_asset(
            item.immich_asset_id, variant
        )
    except ImmichServiceError as exc:
        item.immich_connection.status = ImmichConnectionStatus.error
        item.immich_connection.last_error = str(exc)[:1000]
        _raise_immich(exc)

    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=300, must-revalidate"},
    )

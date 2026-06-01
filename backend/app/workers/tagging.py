import logging
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.item import ClothingItem, ImageSource, ItemStatus
from app.services.immich_service import temporary_asset_file
from app.services.ai_service import AIService, ClothingTags
from app.utils.zh_labels import build_zh_tags
from app.workers.db import get_db_session

logger = logging.getLogger(__name__)


def tags_to_item_fields(tags: ClothingTags, raw_response: str | None = None) -> dict[str, Any]:
    """Convert ClothingTags to item database fields."""
    # Build the tags JSONB object for frontend display
    tags_jsonb = {
        "colors": tags.colors or [],
        "pattern": tags.pattern,
        "material": tags.material,
        "style": tags.style or [],
        "season": tags.season or [],
        "formality": tags.formality,
        "fit": tags.fit,
        "occasion": tags.occasion or [],
        "brand": tags.brand,
        "condition": tags.condition,
        "features": tags.features or [],
        "weather_suitability": tags.weather_suitability or [],
        "weather_avoid": tags.weather_avoid or [],
        "temperature_min_c": tags.temperature_min_c,
        "temperature_max_c": tags.temperature_max_c,
        "warmth_level": tags.warmth_level,
    }
    if tags.logprobs_confidence is not None:
        tags_jsonb["logprobs_confidence"] = tags.logprobs_confidence
    if tags.ai_provider:
        tags_jsonb["ai_provider"] = tags.ai_provider
    if tags.ai_model:
        tags_jsonb["ai_model"] = tags.ai_model
    if tags.ai_models:
        tags_jsonb["ai_models"] = tags.ai_models

    zh_source = {
        "type": tags.type,
        "subtype": tags.subtype,
        "primary_color": tags.primary_color,
        "colors": tags.colors or [],
        "pattern": tags.pattern,
        "material": tags.material,
        "style": tags.style or [],
        "season": tags.season or [],
        "formality": tags.formality,
        "fit": tags.fit,
    }
    tags_zh = {**build_zh_tags(zh_source), **(tags.tags_zh or {})}

    fields = {
        "type": tags.type,
        "subtype": tags.subtype,
        "primary_color": tags.primary_color,
        "colors": tags.colors,
        "pattern": tags.pattern,
        "material": tags.material,
        "style": tags.style,
        "formality": tags.formality,
        "season": tags.season,
        "tags": tags_jsonb,  # Populate the tags JSONB field for frontend
        "ai_processed": True,
        "ai_confidence": tags.confidence,
        "ai_description": tags.description,  # Human-readable description
        "ai_description_zh": tags.description_zh,
        "tags_zh": tags_zh,
        "status": ItemStatus.ready,
    }
    if tags.brand:
        fields["brand"] = tags.brand
    ai_metadata = {
        "provider": tags.ai_provider,
        "model": tags.ai_model,
        "models": tags.ai_models,
    }
    if raw_response:
        fields["ai_raw_response"] = {"raw_text": raw_response, **ai_metadata}
    elif tags.ai_provider or tags.ai_model or tags.ai_models:
        fields["ai_raw_response"] = ai_metadata
    return fields


async def update_item_status_to_error(ctx: dict, item_id: str, error_msg: str) -> None:
    """Update item status to error in database."""
    try:
        db = get_db_session(ctx)
        try:
            result = await db.execute(select(ClothingItem).where(ClothingItem.id == UUID(item_id)))
            item = result.scalar_one_or_none()
            if item:
                item.status = ItemStatus.error
                item.ai_raw_response = {"error": error_msg}
                await db.commit()
        finally:
            await db.close()
    except Exception as e:
        logger.error(f"Failed to update item {item_id} status to error: {e}")


async def tag_item_image(ctx: dict, item_id: str, image_path: str) -> dict[str, Any]:
    """
    Analyze an item's image and update it with AI-generated tags.

    Args:
        ctx: arq context
        item_id: UUID of the item to tag
        image_path: Path to the image file

    Returns:
        Dict with status and tags
    """
    logger.info(f"Starting AI tagging for item {item_id}")

    try:
        # Verify image exists
        path = Path(image_path)
        if not path.exists():
            error_msg = f"Image not found: {image_path}"
            logger.error(error_msg)
            await update_item_status_to_error(ctx, item_id, error_msg)
            return {"status": "error", "error": "Image not found"}

        # Get user's AI endpoints from preferences
        ai_endpoints = None
        db = get_db_session(ctx)
        try:
            # Get the item to find user_id
            result = await db.execute(select(ClothingItem).where(ClothingItem.id == UUID(item_id)))
            item = result.scalar_one_or_none()
            if item:
                # Get user's preferences for AI endpoints
                from app.models.preference import UserPreference

                pref_result = await db.execute(
                    select(UserPreference).where(UserPreference.user_id == item.user_id)
                )
                prefs = pref_result.scalar_one_or_none()
                if prefs and prefs.ai_endpoints:
                    ai_endpoints = prefs.ai_endpoints
                    logger.info(
                        f"Using {len(ai_endpoints)} custom AI endpoints for user {item.user_id}"
                    )
        finally:
            await db.close()

        # Analyze with AI (uses custom endpoints if available)
        ai_service = AIService(endpoints=ai_endpoints)
        tags = await ai_service.analyze_image(path)

        logger.info(
            f"AI analysis complete for item {item_id}: type={tags.type}, color={tags.primary_color}"
        )

        # Update item in database
        db = get_db_session(ctx)
        try:
            result = await db.execute(select(ClothingItem).where(ClothingItem.id == UUID(item_id)))
            item = result.scalar_one_or_none()

            if item is None:
                logger.error(f"Item not found: {item_id}")
                return {"status": "error", "error": "Item not found"}

            # Update item fields - only update if user hasn't already set a value
            # Always update: ai_processed, ai_confidence, status, ai_raw_response
                # Conditionally update user-editable content fields.
            ai_fields = tags_to_item_fields(tags, tags.raw_response)

            for field, value in ai_fields.items():
                # Always update AI metadata fields (including tags JSONB and description)
                if field in (
                    "ai_processed",
                    "ai_confidence",
                    "status",
                    "ai_raw_response",
                    "tags",
                    "tags_zh",
                    "ai_description",
                    "ai_description_zh",
                ):
                    setattr(item, field, value)
                # Only update content fields if user hasn't set them (or they're default/unknown)
                elif field == "type":
                    if not item.type or item.type == "unknown":
                        setattr(item, field, value)
                elif field == "subtype":
                    if not item.subtype:
                        setattr(item, field, value)
                elif field == "primary_color":
                    if not item.primary_color or item.primary_color == "unknown":
                        setattr(item, field, value)
                elif field == "brand":
                    if not item.brand:
                        setattr(item, field, value)
                else:
                    # For other fields (colors, pattern, material, style, etc.), only set if not already set
                    current_value = getattr(item, field, None)
                    if (
                        current_value is None
                        or current_value == []
                        or current_value == ""
                        or current_value == {}
                    ):
                        setattr(item, field, value)

            await db.commit()
            logger.info(f"Updated item {item_id} with AI tags (status=ready)")

            return {
                "status": "success",
                "item_id": item_id,
                "tags": tags.model_dump(exclude={"raw_response"}),
            }

        finally:
            await db.close()

    except Exception as e:
        error_msg = str(e)
        logger.exception(f"Error tagging item {item_id}: {error_msg}")
        await update_item_status_to_error(ctx, item_id, error_msg)
        return {"status": "error", "error": error_msg}


async def tag_item_by_id(ctx: dict, item_id: str) -> dict[str, Any]:
    db = get_db_session(ctx)
    try:
        result = await db.execute(
            select(ClothingItem)
            .where(ClothingItem.id == UUID(item_id))
            .options(selectinload(ClothingItem.immich_connection))
        )
        item = result.scalar_one_or_none()
        if not item:
            return {"status": "error", "error": "Item not found"}

        if item.image_source == ImageSource.immich:
            async with temporary_asset_file(item, db) as path:
                return await tag_item_image(ctx, item_id, str(path))

        if item.image_path:
            from app.config import get_settings

            settings = get_settings()
            return await tag_item_image(ctx, item_id, f"{settings.storage_path}/{item.image_path}")

        error_msg = "Item has no image source"
        await update_item_status_to_error(ctx, item_id, error_msg)
        return {"status": "error", "error": error_msg}
    except Exception as e:
        error_msg = str(e)
        logger.exception("Error tagging item %s by source: %s", item_id, error_msg)
        await update_item_status_to_error(ctx, item_id, error_msg)
        return {"status": "error", "error": error_msg}
    finally:
        await db.close()

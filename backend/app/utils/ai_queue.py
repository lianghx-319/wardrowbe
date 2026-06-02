from datetime import UTC, datetime

AI_QUEUE_STATUS_KEY = "queue_status"
AI_QUEUE_STATUS_QUEUED = "queued"
AI_QUEUE_STATUS_PROCESSING = "processing"


def analysis_queued_response() -> dict[str, str]:
    return {
        AI_QUEUE_STATUS_KEY: AI_QUEUE_STATUS_QUEUED,
        "queued_at": datetime.now(UTC).isoformat(),
    }


def analysis_processing_response() -> dict[str, str]:
    return {
        AI_QUEUE_STATUS_KEY: AI_QUEUE_STATUS_PROCESSING,
        "started_at": datetime.now(UTC).isoformat(),
    }


def analysis_queue_error_response(error: str) -> dict[str, str]:
    return {"error": error, AI_QUEUE_STATUS_KEY: "queue_failed"}

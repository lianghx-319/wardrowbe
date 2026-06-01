import base64
import io
import json
import logging
import math
import re
from pathlib import Path

import httpx
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from app.config import get_settings
from app.utils.prompts import load_prompt
from app.utils.zh_labels import (
    COLOR_ZH,
    FIT_ZH,
    FORMALITY_ZH,
    MATERIAL_ZH,
    PATTERN_ZH,
    SEASON_ZH,
    STYLE_ZH,
    TYPE_ZH,
    build_zh_tags,
)

logger = logging.getLogger(__name__)


class TextGenerationResult(BaseModel):
    content: str
    model: str
    endpoint: str


class ClothingTags(BaseModel):
    type: str = "unknown"
    subtype: str | None = None
    primary_color: str | None = None
    colors: list[str] = []
    pattern: str | None = None
    material: str | None = None
    style: list[str] = []
    formality: str | None = None
    season: list[str] = []
    fit: str | None = None
    occasion: list[str] = []
    brand: str | None = None
    condition: str | None = None
    features: list[str] = []
    weather_suitability: list[str] = []
    weather_avoid: list[str] = []
    temperature_min_c: int | None = None
    temperature_max_c: int | None = None
    warmth_level: str | None = None
    confidence: float = 0.0
    logprobs_confidence: float | None = None
    description: str | None = None
    description_zh: str | None = None
    tags_zh: dict | None = None
    raw_response: str | None = None
    ai_provider: str | None = None
    ai_model: str | None = None
    ai_models: dict = Field(default_factory=dict)


TAGGING_PROMPT = load_prompt("clothing_analysis")
DESCRIPTION_PROMPT = load_prompt("clothing_description")

# Valid values for validation
VALID_TYPES = {
    "shirt",
    "t-shirt",
    "pants",
    "jeans",
    "shorts",
    "dress",
    "skirt",
    "jacket",
    "coat",
    "sweater",
    "hoodie",
    "blazer",
    "vest",
    "cardigan",
    "polo",
    "blouse",
    "tank-top",
    "shoes",
    "sneakers",
    "boots",
    "sandals",
    "hat",
    "scarf",
    "belt",
    "bag",
    "accessories",
    "top",
    "jumpsuit",
    "socks",
    "tie",
}
VALID_COLORS = {
    "black",
    "white",
    "gray",
    "navy",
    "blue",
    "light-blue",
    "red",
    "burgundy",
    "pink",
    "green",
    "olive",
    "yellow",
    "orange",
    "purple",
    "brown",
    "tan",
    "beige",
    "cream",
    "gold",
    "silver",
}
VALID_PATTERNS = {
    "solid",
    "striped",
    "plaid",
    "checkered",
    "floral",
    "graphic",
    "geometric",
    "polka-dot",
    "camouflage",
    "animal-print",
}
VALID_MATERIALS = {
    "cotton",
    "denim",
    "leather",
    "wool",
    "polyester",
    "silk",
    "linen",
    "knit",
    "fleece",
    "suede",
    "velvet",
    "nylon",
    "canvas",
}
VALID_FORMALITY = {"very-casual", "casual", "smart-casual", "business-casual", "formal"}
VALID_FIT = {"slim", "regular", "relaxed", "oversized", "tailored", "cropped"}
VALID_STYLES = {
    "casual",
    "classic",
    "sporty",
    "minimalist",
    "bohemian",
    "preppy",
    "streetwear",
    "elegant",
    "athletic",
    "vintage",
    "modern",
    "rugged",
}
VALID_SEASONS = {"spring", "summer", "fall", "winter", "all-season"}
VALID_FEATURES = {
    "wind-resistant",
    "water-resistant",
    "waterproof",
    "warm",
    "insulated",
    "breathable",
    "lightweight",
    "quick-dry",
    "stretch",
    "sun-protective",
    "moisture-wicking",
    "thermal",
    "layer-friendly",
    "packable",
    "hooded",
}
VALID_WEATHER = {"sunny", "cloudy", "rainy", "windy", "snowy", "cold", "cool", "mild", "hot", "humid"}
VALID_WARMTH = {"very-light", "light", "medium", "warm", "very-warm"}


def compute_tag_completeness(tags: "ClothingTags") -> float:
    score = 0.0
    if tags.type and tags.type != "unknown":
        score += 0.25
    if tags.primary_color:
        score += 0.20
    if tags.pattern:
        score += 0.15
    if tags.formality:
        score += 0.15
    if tags.material:
        score += 0.10
    if tags.season:
        score += 0.05
    if tags.style:
        score += 0.05
    if tags.colors:
        score += 0.05
    if tags.features:
        score += 0.05
    if tags.temperature_min_c is not None and tags.temperature_max_c is not None:
        score += 0.05
    return round(min(score, 1.0), 2)


_CONFIDENCE_FIELDS = {"type", "primary_color", "pattern", "material", "formality"}


def compute_confidence_from_logprobs(logprobs_content: list[dict] | None) -> float | None:
    if not logprobs_content:
        return None

    field_probs: dict[str, list[float]] = {}
    current_key = None
    expect_value = False

    for entry in logprobs_content:
        token = entry.get("token", "")
        logprob = entry.get("logprob", 0)
        prob = math.exp(logprob)
        stripped = token.strip().strip('"').strip("'")

        if stripped in _CONFIDENCE_FIELDS:
            current_key = stripped
            expect_value = False
            continue

        if current_key and ":" in token:
            expect_value = True
            continue

        if expect_value and current_key and stripped and stripped not in ("{", "[", ",", "}", "]"):
            if stripped == "null":
                current_key = None
                expect_value = False
                continue
            if current_key not in field_probs:
                field_probs[current_key] = []
            field_probs[current_key].append(prob)
            current_key = None
            expect_value = False

    if not field_probs:
        return None

    weights = {
        "type": 0.30,
        "primary_color": 0.25,
        "pattern": 0.15,
        "material": 0.15,
        "formality": 0.15,
    }
    total_weight = 0.0
    weighted_sum = 0.0

    for field, probs in field_probs.items():
        w = weights.get(field, 0.1)
        weighted_sum += w * min(probs)
        total_weight += w

    if total_weight == 0:
        return None

    return round(weighted_sum / total_weight, 2)


class AIEndpointConfig:
    """Configuration for an AI endpoint."""

    def __init__(
        self,
        url: str,
        vision_model: str = "moondream",
        text_model: str = "phi3:mini",
        name: str = "default",
        enabled: bool = True,
        api_key: str | None = None,
    ):
        self.url = url
        self.vision_model = vision_model
        self.text_model = text_model
        self.name = name
        self.enabled = enabled
        self.api_key = api_key


class AIService:
    """Service for AI-powered image analysis and text generation."""

    def __init__(self, endpoints: list[dict] | None = None):
        """
        Initialize AI service with optional custom endpoints.

        Args:
            endpoints: List of endpoint configs from user preferences.
                      If None or empty, uses default from settings.
        """
        self.settings = get_settings()
        self.timeout = self.settings.ai_timeout

        # Build endpoint list
        self._endpoints: list[AIEndpointConfig] = []

        if endpoints:
            for ep in endpoints:
                if ep.get("enabled", True):
                    self._endpoints.append(
                        AIEndpointConfig(
                            url=ep["url"],
                            vision_model=ep.get("vision_model", "moondream"),
                            text_model=ep.get("text_model", "phi3:mini"),
                            name=ep.get("name", "custom"),
                            enabled=True,
                            api_key=ep.get("api_key") or self.settings.ai_api_key,
                        )
                    )

        if self.settings.ai_base_url:
            self._endpoints.append(
                AIEndpointConfig(
                    url=self.settings.ai_base_url,
                    vision_model=self.settings.ai_vision_model,
                    text_model=self.settings.ai_text_model,
                    name="default",
                    api_key=self.settings.ai_api_key,
                )
            )

        if self.settings.ai_fallback_base_url:
            self._endpoints.append(
                AIEndpointConfig(
                    url=self.settings.ai_fallback_base_url,
                    vision_model=self.settings.ai_fallback_vision_model
                    or self.settings.ai_vision_model,
                    text_model=self.settings.ai_fallback_text_model or self.settings.ai_text_model,
                    name="fallback",
                    api_key=self.settings.ai_fallback_api_key,
                )
            )

        # Legacy properties for backwards compatibility
        self.base_url = self._endpoints[0].url if self._endpoints else ""
        self.vision_model = self._endpoints[0].vision_model if self._endpoints else ""
        self.text_model = self._endpoints[0].text_model if self._endpoints else ""

    def _get_headers(self, endpoint: AIEndpointConfig | None = None) -> dict:
        """Get headers for AI API requests, including auth if configured."""
        headers = {"Content-Type": "application/json"}
        api_key = endpoint.api_key if endpoint else None
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    def _preprocess_image(self, image_path: str | Path) -> str:
        """
        Preprocess image for AI analysis.
        Returns base64-encoded JPEG string.
        """
        with Image.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode != "RGB":
                img = img.convert("RGB")

            # Auto-orient based on EXIF
            img = ImageOps.exif_transpose(img)

            # Resize to max 512x512 for faster AI processing
            max_size = 512
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

            # Convert to JPEG bytes
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=85)
            buffer.seek(0)

            return base64.b64encode(buffer.read()).decode("utf-8")

    def _parse_tags_from_response(self, response_text: str) -> ClothingTags:
        def extract_json(text: str) -> dict | None:
            try:
                return json.loads(text.strip())
            except json.JSONDecodeError:
                pass

            json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if json_match:
                try:
                    return json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    pass

            start_idx = text.find("{")
            if start_idx != -1:
                brace_count = 0
                for i, char in enumerate(text[start_idx:], start_idx):
                    if char == "{":
                        brace_count += 1
                    elif char == "}":
                        brace_count -= 1
                        if brace_count == 0:
                            json_str = text[start_idx : i + 1]
                            try:
                                return json.loads(json_str)
                            except json.JSONDecodeError:
                                break
            return None

        def reverse_zh(mapping: dict[str, str]) -> dict[str, str]:
            return {value.lower().strip(): key for key, value in mapping.items()}

        TYPE_ALIASES: dict[str, str] = {
            **reverse_zh(TYPE_ZH),
            "tee": "t-shirt",
            "tshirt": "t-shirt",
            "t shirt": "t-shirt",
            "t-shirt": "t-shirt",
            "dress shirt": "shirt",
            "button down": "shirt",
            "button-down": "shirt",
            "trouser": "pants",
            "trousers": "pants",
            "jean": "jeans",
            "sandal": "sandals",
            "boot": "boots",
            "shoe": "shoes",
            "sneaker": "sneakers",
            "accessory": "accessories",
            "裙子": "dress",
            "裙": "dress",
            "半裙": "skirt",
            "外套": "coat",
            "上衣": "top",
        }

        COLOR_ALIASES: dict[str, str] = {
            **reverse_zh(COLOR_ZH),
            "grey": "gray",
            "light grey": "gray",
            "light gray": "gray",
            "dark grey": "gray",
            "dark gray": "gray",
            "off-white": "cream",
            "ivory": "cream",
            "wine": "burgundy",
            "maroon": "burgundy",
            "forest green": "green",
            "dark blue": "navy",
            "royal blue": "blue",
            "sky blue": "light-blue",
            "baby blue": "light-blue",
            "camel": "tan",
            "khaki": "tan",
            "rust": "orange",
            "coral": "pink",
            "rose": "pink",
            "mauve": "purple",
            "lavender": "purple",
            "mustard": "yellow",
            "gold": "yellow",
            "silver": "gray",
            "charcoal": "gray",
            "off white": "cream",
            "米白": "cream",
            "米白色": "cream",
            "藏青色": "navy",
            "深蓝色": "navy",
            "浅蓝": "light-blue",
            "白": "white",
            "黑": "black",
            "灰": "gray",
            "蓝": "blue",
            "红": "red",
            "绿": "green",
        }
        PATTERN_ALIASES = {
            **reverse_zh(PATTERN_ZH),
            "plain": "solid",
            "none": "solid",
            "no pattern": "solid",
            "dots": "polka-dot",
            "polka dot": "polka-dot",
            "checks": "checkered",
            "checked": "checkered",
            "格子": "plaid",
            "印花": "floral",
        }
        MATERIAL_ALIASES = {
            **reverse_zh(MATERIAL_ZH),
            "jean": "denim",
            "knitted": "knit",
            "poly": "polyester",
            "cotton blend": "cotton",
            "棉质": "cotton",
        }
        FORMALITY_ALIASES = {
            **reverse_zh(FORMALITY_ZH),
            "everyday": "casual",
            "semi-formal": "smart-casual",
            "business": "business-casual",
            "商务": "business-casual",
        }
        STYLE_ALIASES = {
            **reverse_zh(STYLE_ZH),
            "sports": "sporty",
            "sport": "sporty",
            "minimal": "minimalist",
            "street": "streetwear",
        }
        SEASON_ALIASES = {
            **reverse_zh(SEASON_ZH),
            "autumn": "fall",
            "year-round": "all-season",
            "all seasons": "all-season",
            "四季皆宜": "all-season",
        }
        FIT_ALIASES = {
            **reverse_zh(FIT_ZH),
            "loose": "relaxed",
            "boxy": "relaxed",
            "宽松版": "relaxed",
            "常规版": "regular",
        }
        FEATURE_ALIASES = {
            "防风": "wind-resistant",
            "挡风": "wind-resistant",
            "windproof": "wind-resistant",
            "防雨": "water-resistant",
            "泼水": "water-resistant",
            "防水": "waterproof",
            "保暖": "warm",
            "加绒": "insulated",
            "夹棉": "insulated",
            "透气": "breathable",
            "轻薄": "lightweight",
            "轻量": "lightweight",
            "速干": "quick-dry",
            "弹力": "stretch",
            "防晒": "sun-protective",
            "吸湿排汗": "moisture-wicking",
            "排汗": "moisture-wicking",
            "热力": "thermal",
            "可叠穿": "layer-friendly",
            "连帽": "hooded",
        }
        WEATHER_ALIASES = {
            "晴天": "sunny",
            "多云": "cloudy",
            "雨天": "rainy",
            "下雨": "rainy",
            "有风": "windy",
            "刮风": "windy",
            "大风": "windy",
            "雪天": "snowy",
            "寒冷": "cold",
            "冷": "cold",
            "凉爽": "cool",
            "温和": "mild",
            "炎热": "hot",
            "热": "hot",
            "潮湿": "humid",
            "湿热": "humid",
        }
        WARMTH_ALIASES = {
            "非常轻薄": "very-light",
            "轻薄": "light",
            "中等": "medium",
            "保暖": "warm",
            "很保暖": "very-warm",
            "厚": "warm",
            "很厚": "very-warm",
        }

        def normalize_key(value: str) -> str:
            return value.strip().lower().replace("_", "-")

        def validate_value(
            value: str | None, valid_set: set, aliases: dict[str, str] | None = None
        ) -> str | None:
            if value is None:
                return None
            if not isinstance(value, str):
                value = str(value)
            value_lower = normalize_key(value)
            if value_lower in valid_set:
                return value_lower
            alias = (aliases or {}).get(value_lower)
            if alias and alias in valid_set:
                return alias
            return None

        def validate_list(
            values: list | str | None, valid_set: set, aliases: dict[str, str] | None = None
        ) -> list:
            if not values:
                return []
            if isinstance(values, str):
                values = re.split(r"[,，/、;；]\s*", values)
            normalized = []
            for value in values:
                valid_value = validate_value(value, valid_set, aliases)
                if valid_value and valid_value not in normalized:
                    normalized.append(valid_value)
            return normalized

        def pick(source: dict, *keys: str):
            for key in keys:
                if key in source:
                    return source.get(key)
            return None

        def clean_text(value: object | None, max_len: int = 100) -> str | None:
            if value is None:
                return None
            text = str(value).strip()
            if not text or text.lower() in {"null", "none", "unknown", "n/a"}:
                return None
            return text[:max_len]

        def clamp_int(value: object | None, min_value: int = -30, max_value: int = 50) -> int | None:
            if value is None:
                return None
            if isinstance(value, str):
                match = re.search(r"-?\d+", value)
                if not match:
                    return None
                value = match.group(0)
            try:
                number = int(round(float(value)))
            except (TypeError, ValueError):
                return None
            return max(min_value, min(max_value, number))

        data = extract_json(response_text)
        if not data:
            logger.warning(f"Could not parse JSON from AI response: {response_text[:200]}")
            return ClothingTags(raw_response=response_text)

        if isinstance(data, list):
            data = data[0] if data and isinstance(data[0], dict) else {}

        if isinstance(data.get("tags"), dict):
            nested = data["tags"]
            data = {**nested, **{key: value for key, value in data.items() if key != "tags"}}

        zh_data = data.get("zh") if isinstance(data.get("zh"), dict) else {}

        tags = ClothingTags()
        tags.raw_response = response_text

        item_type = validate_value(
            pick(data, "type", "item_type", "category"), VALID_TYPES, TYPE_ALIASES
        )
        if not item_type:
            item_type = validate_value(
                pick(zh_data, "type", "品类", "类别"), VALID_TYPES, TYPE_ALIASES
            )
        if item_type:
            tags.type = item_type
        else:
            tags.type = "unknown"

        subtype = pick(data, "subtype", "sub_type")
        tags.subtype = subtype.strip() if isinstance(subtype, str) and subtype.strip() else None
        tags.primary_color = validate_value(
            pick(data, "primary_color", "primaryColor", "color", "main_color"),
            VALID_COLORS,
            COLOR_ALIASES,
        )
        if not tags.primary_color:
            tags.primary_color = validate_value(
                pick(zh_data, "primary_color", "primaryColor", "color", "颜色", "主色"),
                VALID_COLORS,
                COLOR_ALIASES,
            )
        tags.colors = validate_list(
            pick(data, "colors", "colour", "colours"), VALID_COLORS, COLOR_ALIASES
        )
        if not tags.colors:
            tags.colors = validate_list(
                pick(zh_data, "colors", "颜色"), VALID_COLORS, COLOR_ALIASES
            )
        if tags.primary_color and tags.primary_color not in tags.colors:
            tags.colors.insert(0, tags.primary_color)
        tags.pattern = validate_value(pick(data, "pattern"), VALID_PATTERNS, PATTERN_ALIASES)
        if not tags.pattern:
            tags.pattern = validate_value(
                pick(zh_data, "pattern", "图案"), VALID_PATTERNS, PATTERN_ALIASES
            )
        tags.material = validate_value(
            pick(data, "material", "fabric"), VALID_MATERIALS, MATERIAL_ALIASES
        )
        if not tags.material:
            tags.material = validate_value(
                pick(zh_data, "material", "fabric", "材质", "面料"),
                VALID_MATERIALS,
                MATERIAL_ALIASES,
            )
        tags.formality = validate_value(
            pick(data, "formality", "occasion_level"), VALID_FORMALITY, FORMALITY_ALIASES
        )
        if not tags.formality:
            tags.formality = validate_value(
                pick(zh_data, "formality", "正式程度"), VALID_FORMALITY, FORMALITY_ALIASES
            )
        tags.style = validate_list(pick(data, "style", "styles"), VALID_STYLES, STYLE_ALIASES)
        if not tags.style:
            tags.style = validate_list(
                pick(zh_data, "style", "styles", "风格"), VALID_STYLES, STYLE_ALIASES
            )
        tags.season = validate_list(pick(data, "season", "seasons"), VALID_SEASONS, SEASON_ALIASES)
        if not tags.season:
            tags.season = validate_list(
                pick(zh_data, "season", "seasons", "季节"), VALID_SEASONS, SEASON_ALIASES
            )
        tags.fit = validate_value(pick(data, "fit"), VALID_FIT, FIT_ALIASES)
        if not tags.fit:
            tags.fit = validate_value(pick(zh_data, "fit", "版型"), VALID_FIT, FIT_ALIASES)
        tags.brand = clean_text(pick(data, "brand", "logo_brand", "visible_brand"))
        tags.condition = clean_text(pick(data, "condition", "wear_condition"))
        tags.features = validate_list(
            pick(data, "features", "functional_features", "functions"),
            VALID_FEATURES,
            FEATURE_ALIASES,
        )
        if not tags.features:
            tags.features = validate_list(
                pick(zh_data, "features", "functional_features", "功能"),
                VALID_FEATURES,
                FEATURE_ALIASES,
            )
        tags.weather_suitability = validate_list(
            pick(data, "weather_suitability", "suitable_weather", "weather"),
            VALID_WEATHER,
            WEATHER_ALIASES,
        )
        if not tags.weather_suitability:
            tags.weather_suitability = validate_list(
                pick(zh_data, "weather_suitability", "suitable_weather", "适合天气"),
                VALID_WEATHER,
                WEATHER_ALIASES,
            )
        tags.weather_avoid = validate_list(
            pick(data, "weather_avoid", "avoid_weather", "not_suitable_weather"),
            VALID_WEATHER,
            WEATHER_ALIASES,
        )
        if not tags.weather_avoid:
            tags.weather_avoid = validate_list(
                pick(zh_data, "weather_avoid", "avoid_weather", "不适合天气"),
                VALID_WEATHER,
                WEATHER_ALIASES,
            )
        temp_min = clamp_int(pick(data, "temperature_min_c", "min_temperature_c", "temp_min_c"))
        temp_max = clamp_int(pick(data, "temperature_max_c", "max_temperature_c", "temp_max_c"))
        if temp_min is None:
            temp_min = clamp_int(pick(zh_data, "temperature_min_c", "最低温度"))
        if temp_max is None:
            temp_max = clamp_int(pick(zh_data, "temperature_max_c", "最高温度"))
        if temp_min is not None and temp_max is not None and temp_min > temp_max:
            temp_min, temp_max = temp_max, temp_min
        tags.temperature_min_c = temp_min
        tags.temperature_max_c = temp_max
        tags.warmth_level = validate_value(
            pick(data, "warmth_level", "warmth"), VALID_WARMTH, WARMTH_ALIASES
        )
        if not tags.warmth_level:
            tags.warmth_level = validate_value(
                pick(zh_data, "warmth_level", "保暖程度"), VALID_WARMTH, WARMTH_ALIASES
            )
        tags.confidence = compute_tag_completeness(tags)
        tags.tags_zh = {**build_zh_tags(tags.model_dump()), **zh_data}

        logger.info(
            f"Parsed tags: type={tags.type}, color={tags.primary_color}, pattern={tags.pattern}"
        )
        return tags

    async def _call_with_fallback(
        self,
        messages: list,
        task_name: str,
        use_vision_model: bool = True,
        request_logprobs: bool = False,
    ) -> tuple[str | None, Exception | None, list | None, dict | None]:
        last_error = None

        def supports_logprobs(endpoint: AIEndpointConfig) -> bool:
            url = endpoint.url.lower()
            if "generativelanguage.googleapis.com" in url or "googleapis.com" in url:
                return False
            return True

        for endpoint in self._endpoints:
            logger.info(f"Trying AI endpoint for {task_name}: {endpoint.name}")
            model = endpoint.vision_model if use_vision_model else endpoint.text_model

            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                for attempt in range(self.settings.ai_max_retries):
                    try:
                        request_body = {
                            "model": model,
                            "messages": messages,
                            "stream": False,
                            "max_tokens": self.settings.ai_max_tokens,
                        }
                        if request_logprobs and supports_logprobs(endpoint):
                            request_body["logprobs"] = True
                            request_body["top_logprobs"] = 3

                        response = await client.post(
                            f"{endpoint.url}/chat/completions",
                            headers=self._get_headers(endpoint),
                            json=request_body,
                        )
                        response.raise_for_status()

                        data = response.json()
                        choice = data["choices"][0]
                        content = choice["message"]["content"]
                        logprobs_content = None
                        if request_logprobs:
                            lp = choice.get("logprobs")
                            if lp:
                                logprobs_content = lp.get("content")

                        used_model = data.get("model", model)
                        logger.info(
                            f"AI {task_name} successful via {endpoint.name} (model: {used_model})"
                        )
                        metadata = {
                            "task": task_name,
                            "provider": endpoint.name,
                            "model": used_model,
                            "configured_model": model,
                        }
                        return content, None, logprobs_content, metadata

                    except httpx.HTTPStatusError as e:
                        last_error = e
                        logger.warning(f"HTTP error from {endpoint.name}: {e}")
                        if attempt < self.settings.ai_max_retries - 1:
                            continue
                    except httpx.RequestError as e:
                        last_error = e
                        logger.warning(f"Request error from {endpoint.name}: {e}")
                        if attempt < self.settings.ai_max_retries - 1:
                            continue

        return None, last_error, None, None

    async def analyze_image(self, image_path: str | Path) -> ClothingTags:
        image_base64 = self._preprocess_image(image_path)

        # System/user separation for injection protection
        messages_tags = [
            {"role": "system", "content": TAGGING_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                ],
            },
        ]

        messages_desc = [
            {"role": "system", "content": DESCRIPTION_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                ],
            },
        ]

        tags = ClothingTags()
        last_error = None

        # First pass: structured tags with logprobs for real confidence
        content, err, logprobs_content, model_metadata = await self._call_with_fallback(
            messages_tags, "tags", request_logprobs=True
        )
        if content:
            tags = self._parse_tags_from_response(content)
            if model_metadata:
                tags.ai_provider = model_metadata.get("provider")
                tags.ai_model = model_metadata.get("model")
                tags.ai_models["tags"] = model_metadata
            logprobs_confidence = compute_confidence_from_logprobs(logprobs_content)
            if logprobs_confidence is not None:
                tags.logprobs_confidence = logprobs_confidence
        if err:
            last_error = err

        # Second pass: human-readable description
        content, err, _, model_metadata = await self._call_with_fallback(
            messages_desc, "description"
        )
        if content:
            if model_metadata:
                tags.ai_models["description"] = model_metadata
                tags.ai_provider = tags.ai_provider or model_metadata.get("provider")
                tags.ai_model = tags.ai_model or model_metadata.get("model")
            description = content.strip()
            if description.startswith('"') and description.endswith('"'):
                description = description[1:-1]
            tags.description = description

        messages_desc_zh = [
            {
                "role": "system",
                "content": (
                    "请用简体中文用一句话描述图片中的主要服装，"
                    "包含品类、颜色和显著特征，20 个汉字左右。只输出中文句子。"
                ),
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                ],
            },
        ]
        content, _, _, model_metadata = await self._call_with_fallback(
            messages_desc_zh, "description_zh"
        )
        if content:
            if model_metadata:
                tags.ai_models["description_zh"] = model_metadata
                tags.ai_provider = tags.ai_provider or model_metadata.get("provider")
                tags.ai_model = tags.ai_model or model_metadata.get("model")
            description_zh = content.strip().strip('"')
            tags.description_zh = description_zh

        if tags.type == "unknown" and not tags.description and last_error:
            raise last_error

        return tags

    async def check_health(self) -> dict:
        """Check health of all configured AI endpoints."""
        endpoints_health = []

        for endpoint in self._endpoints:
            try:
                async with httpx.AsyncClient(timeout=5, follow_redirects=True) as client:
                    # Try OpenAI-compatible /v1/models endpoint first
                    response = await client.get(
                        f"{endpoint.url}/models", headers=self._get_headers(endpoint)
                    )
                    if response.status_code == 200:
                        data = response.json()
                        # OpenAI format: {"data": [{"id": "model-name", ...}]}
                        models = data.get("data", [])
                        model_names = [m.get("id", "") for m in models]
                        endpoints_health.append(
                            {
                                "name": endpoint.name,
                                "url": endpoint.url,
                                "status": "healthy",
                                "vision_model": endpoint.vision_model,
                                "text_model": endpoint.text_model,
                                "available_models": model_names,
                            }
                        )
                        continue

                    # Fallback: Try Ollama-specific endpoint
                    response = await client.get(endpoint.url.replace("/v1", "/api/tags"))
                    if response.status_code == 200:
                        models = response.json().get("models", [])
                        model_names = [m.get("name", "") for m in models]
                        endpoints_health.append(
                            {
                                "name": endpoint.name,
                                "url": endpoint.url,
                                "status": "healthy",
                                "vision_model": endpoint.vision_model,
                                "text_model": endpoint.text_model,
                                "available_models": model_names,
                            }
                        )
                    else:
                        endpoints_health.append(
                            {
                                "name": endpoint.name,
                                "url": endpoint.url,
                                "status": "unhealthy",
                                "error": f"HTTP {response.status_code}",
                            }
                        )
            except Exception as e:
                endpoints_health.append(
                    {
                        "name": endpoint.name,
                        "url": endpoint.url,
                        "status": "unhealthy",
                        "error": str(e),
                    }
                )

        # Overall status is healthy if at least one endpoint is healthy
        any_healthy = any(ep["status"] == "healthy" for ep in endpoints_health)
        return {
            "status": "healthy" if any_healthy else "unhealthy",
            "endpoints": endpoints_health,
        }

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str | None = None,
        return_metadata: bool = False,
    ) -> str | TextGenerationResult:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        last_error = None

        for endpoint in self._endpoints:
            logger.info(f"Trying text generation via {endpoint.name}")

            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                for attempt in range(self.settings.ai_max_retries):
                    try:
                        response = await client.post(
                            f"{endpoint.url}/chat/completions",
                            headers=self._get_headers(endpoint),
                            json={
                                "model": endpoint.text_model,
                                "messages": messages,
                                "stream": False,
                                "temperature": 0.4,
                                "max_tokens": self.settings.ai_max_tokens,
                            },
                        )
                        response.raise_for_status()

                        data = response.json()
                        used_model = data.get("model", endpoint.text_model)
                        content = data["choices"][0]["message"]["content"]
                        logger.info(
                            f"Text generation successful via {endpoint.name} (model: {used_model})"
                        )

                        if return_metadata:
                            return TextGenerationResult(
                                content=content,
                                model=used_model,
                                endpoint=endpoint.name,
                            )
                        return content

                    except httpx.HTTPStatusError as e:
                        last_error = e
                        logger.warning(f"HTTP error from {endpoint.name}: {e}")
                        if attempt < self.settings.ai_max_retries - 1:
                            continue
                    except httpx.RequestError as e:
                        last_error = e
                        logger.warning(f"Request error from {endpoint.name}: {e}")
                        if attempt < self.settings.ai_max_retries - 1:
                            continue

        if last_error:
            raise last_error
        raise RuntimeError("Failed to generate text - no endpoints available")


# Singleton instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get or create AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service

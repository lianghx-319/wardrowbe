import json
import logging
from dataclasses import dataclass
from datetime import datetime

import httpx
import redis.asyncio as aioredis

from app.config import get_settings
from app.utils.redis_lock import get_redis

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class WeatherData:
    temperature: float  # Celsius
    feels_like: float  # Apparent temperature
    humidity: int  # Percentage
    precipitation_chance: int  # Percentage
    precipitation_mm: float  # mm in next hour
    wind_speed: float  # km/h
    condition: str  # sunny, cloudy, rainy, snowy, etc.
    condition_code: int  # WMO weather code
    is_day: bool
    uv_index: float
    timestamp: datetime

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "temperature": self.temperature,
            "feels_like": self.feels_like,
            "humidity": self.humidity,
            "precipitation_chance": self.precipitation_chance,
            "precipitation_mm": self.precipitation_mm,
            "wind_speed": self.wind_speed,
            "condition": self.condition,
            "condition_code": self.condition_code,
            "is_day": self.is_day,
            "uv_index": self.uv_index,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class DailyForecast:
    """Daily weather forecast."""

    date: str  # YYYY-MM-DD
    temp_min: float
    temp_max: float
    precipitation_chance: int
    condition: str
    condition_code: int


# WMO Weather interpretation codes
# https://open-meteo.com/en/docs
WMO_CODES = {
    0: "sunny",
    1: "mostly sunny",
    2: "partly cloudy",
    3: "cloudy",
    45: "foggy",
    48: "foggy",
    51: "light drizzle",
    53: "drizzle",
    55: "heavy drizzle",
    56: "freezing drizzle",
    57: "freezing drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    66: "freezing rain",
    67: "freezing rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    77: "snow grains",
    80: "light showers",
    81: "showers",
    82: "heavy showers",
    85: "light snow showers",
    86: "snow showers",
    95: "thunderstorm",
    96: "thunderstorm with hail",
    99: "thunderstorm with hail",
}


CACHE_TTL = 3600  # 1 hour
STALE_CACHE_TTL = 21600  # 6 hours
CACHE_PREFIX = "weather:"
STALE_CACHE_PREFIX = "weather:stale:"
API_ATTEMPTS = 2


class WeatherService:
    def __init__(self):
        self.base_url = settings.openmeteo_url.rstrip("/")
        self.openmeteo_url = self.base_url
        self.qweather_api_key = settings.qweather_api_key
        self.qweather_api_host = self._normalize_qweather_host(settings.qweather_api_host)
        self.provider_order = self._configured_provider_order()

    @staticmethod
    def _cache_key(lat: float, lon: float) -> str:
        return f"{CACHE_PREFIX}{round(lat, 2)},{round(lon, 2)}"

    @staticmethod
    def _stale_cache_key(lat: float, lon: float) -> str:
        return f"{STALE_CACHE_PREFIX}{round(lat, 2)},{round(lon, 2)}"

    async def _cache_get(self, lat: float, lon: float, stale: bool = False) -> WeatherData | None:
        try:
            redis = await get_redis()
            key = self._stale_cache_key(lat, lon) if stale else self._cache_key(lat, lon)
            raw = await redis.get(key)
        except aioredis.RedisError:
            logger.debug(f"Redis unavailable for weather cache read ({lat}, {lon})")
            return None
        if raw is None:
            return None
        data = json.loads(raw)
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        logger.debug(f"{'Stale ' if stale else ''}weather cache hit for ({lat}, {lon})")
        return WeatherData(**data)

    async def _cache_set(self, lat: float, lon: float, data: WeatherData) -> None:
        try:
            redis = await get_redis()
            await redis.set(
                self._cache_key(lat, lon),
                json.dumps(data.to_dict()),
                ex=CACHE_TTL,
            )
            await redis.set(
                self._stale_cache_key(lat, lon),
                json.dumps(data.to_dict()),
                ex=STALE_CACHE_TTL,
            )
        except aioredis.RedisError:
            logger.debug(f"Redis unavailable for weather cache write ({lat}, {lon})")

    def _validate_coordinates(self, latitude: float, longitude: float) -> None:
        """Validate latitude and longitude bounds."""
        if not -90 <= latitude <= 90:
            raise ValueError(f"Invalid latitude {latitude}: must be between -90 and 90")
        if not -180 <= longitude <= 180:
            raise ValueError(f"Invalid longitude {longitude}: must be between -180 and 180")

    def _interpret_weather_code(self, code: int) -> str:
        """Convert WMO weather code to human-readable condition."""
        return WMO_CODES.get(code, "unknown")

    @staticmethod
    def _normalize_qweather_host(host: str | None) -> str:
        if not host:
            return ""
        host = host.strip()
        if host.startswith("https://"):
            host = host.removeprefix("https://")
        elif host.startswith("http://"):
            host = host.removeprefix("http://")
        return host.rstrip("/")

    def _configured_provider_order(self) -> list[str]:
        providers: list[str] = []
        raw_providers = settings.weather_providers or "qweather,openmeteo"

        for raw_provider in raw_providers.split(","):
            provider = raw_provider.strip().lower().replace("_", "-")
            if provider in {"openmeteo", "open-meteo"}:
                normalized = "openmeteo"
            elif provider == "qweather":
                normalized = "qweather"
            else:
                logger.warning(f"Skipping unknown weather provider: {raw_provider}")
                continue

            if normalized == "qweather" and not (
                self.qweather_api_key and self.qweather_api_host
            ):
                logger.debug("Skipping QWeather provider because key or API host is missing")
                continue

            if normalized not in providers:
                providers.append(normalized)

        if not providers:
            providers.append("openmeteo")

        return providers

    @staticmethod
    def _qweather_location(latitude: float, longitude: float) -> str:
        return f"{longitude:.2f},{latitude:.2f}"

    @staticmethod
    def _to_float(value, default: float = 0.0) -> float:
        if value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _to_int(value, default: int = 0) -> int:
        if value is None:
            return default
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _parse_qweather_time(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    @staticmethod
    def _is_precipitation_condition(condition: str) -> bool:
        condition = condition.lower()
        return any(
            token in condition
            for token in (
                "rain",
                "drizzle",
                "shower",
                "thunder",
                "snow",
                "sleet",
                "雨",
                "雪",
                "雷",
                "雹",
            )
        )

    def _normalize_qweather_condition(self, text: str | None, icon: str | int | None = None) -> str:
        text_value = (text or "").lower()
        icon_value = str(icon or "")

        if any(token in text_value for token in ("雷", "thunder")):
            return "thunderstorm"
        if any(token in text_value for token in ("雪", "sleet", "snow")):
            return "snow"
        if any(token in text_value for token in ("雨", "drizzle", "shower", "rain")):
            if any(token in text_value for token in ("小", "light")):
                return "light rain"
            if any(token in text_value for token in ("大", "暴", "heavy")):
                return "heavy rain"
            return "rain"
        if any(token in text_value for token in ("雾", "霾", "沙", "尘", "fog", "haze")):
            return "foggy"
        if any(token in text_value for token in ("阴", "overcast")):
            return "cloudy"
        if any(token in text_value for token in ("云", "cloud")):
            return "partly cloudy"
        if any(token in text_value for token in ("晴", "clear", "sunny")):
            return "sunny"
        if "风" in text_value or "wind" in text_value:
            return "windy"

        if icon_value.startswith(("3", "4")):
            return "rain"
        if icon_value.startswith("5"):
            return "foggy"
        if icon_value in {"101", "102", "103", "151", "152", "153"}:
            return "partly cloudy"
        if icon_value in {"104", "154"}:
            return "cloudy"
        if icon_value in {"100", "150"}:
            return "sunny"

        return text or "unknown"

    async def _fetch_forecast_json(self, client: httpx.AsyncClient, params: dict, label: str) -> dict:
        last_error: httpx.HTTPError | None = None
        for attempt in range(1, API_ATTEMPTS + 1):
            try:
                response = await client.get(f"{self.openmeteo_url}/forecast", params=params)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                last_error = e
                logger.warning(
                    f"Weather API {label} attempt {attempt}/{API_ATTEMPTS} failed: {e}"
                )

        raise WeatherServiceError(f"Failed to fetch {label}: {last_error}") from None

    async def _fetch_qweather_json(
        self,
        client: httpx.AsyncClient,
        path: str,
        params: dict,
        label: str,
    ) -> dict:
        if not (self.qweather_api_key and self.qweather_api_host):
            raise WeatherServiceError("QWeather is not configured")

        url = f"https://{self.qweather_api_host}{path}"
        headers = {"X-QW-Api-Key": self.qweather_api_key}
        last_error: Exception | None = None

        for attempt in range(1, API_ATTEMPTS + 1):
            try:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                data = response.json()
                code = str(data.get("code", ""))
                if code != "200":
                    raise WeatherServiceError(f"QWeather {label} returned code {code}")
                return data
            except (httpx.HTTPError, ValueError, WeatherServiceError) as e:
                last_error = e
                logger.warning(
                    f"QWeather {label} attempt {attempt}/{API_ATTEMPTS} failed: {e}"
                )

        raise WeatherServiceError(f"Failed to fetch {label} from QWeather: {last_error}") from None

    async def _fetch_openmeteo_current_weather(
        self,
        client: httpx.AsyncClient,
        latitude: float,
        longitude: float,
    ) -> WeatherData:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": [
                "temperature_2m",
                "apparent_temperature",
                "relative_humidity_2m",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "is_day",
                "uv_index",
            ],
            "hourly": ["precipitation_probability"],
            "forecast_hours": 1,
            "timezone": "auto",
        }

        data = await self._fetch_forecast_json(client, params, "weather")
        current = data.get("current", {})
        hourly = data.get("hourly", {})

        precip_probs = hourly.get("precipitation_probability", [])
        precip_chance = precip_probs[0] if precip_probs else 0
        weather_code = current.get("weather_code", 0)

        return WeatherData(
            temperature=current.get("temperature_2m", 0),
            feels_like=current.get("apparent_temperature", 0),
            humidity=current.get("relative_humidity_2m", 0),
            precipitation_chance=precip_chance,
            precipitation_mm=current.get("precipitation", 0),
            wind_speed=current.get("wind_speed_10m", 0),
            condition=self._interpret_weather_code(weather_code),
            condition_code=weather_code,
            is_day=bool(current.get("is_day", 1)),
            uv_index=current.get("uv_index", 0),
            timestamp=datetime.utcnow(),
        )

    async def _fetch_qweather_current_weather(
        self,
        client: httpx.AsyncClient,
        latitude: float,
        longitude: float,
    ) -> WeatherData:
        location = self._qweather_location(latitude, longitude)
        params = {"location": location, "lang": "zh", "unit": "m"}
        data = await self._fetch_qweather_json(client, "/v7/weather/now", params, "weather")
        current = data.get("now") or {}

        condition = self._normalize_qweather_condition(current.get("text"), current.get("icon"))
        precipitation_mm = self._to_float(current.get("precip"))
        precipitation_chance = 80 if (
            precipitation_mm > 0 or self._is_precipitation_condition(condition)
        ) else 0

        try:
            hourly_data = await self._fetch_qweather_json(
                client,
                "/v7/weather/24h",
                params,
                "hourly forecast",
            )
            hourly = hourly_data.get("hourly") or []
            if hourly:
                precipitation_chance = self._to_int(
                    hourly[0].get("pop"),
                    default=precipitation_chance,
                )
        except WeatherServiceError as e:
            logger.warning(f"QWeather hourly precipitation unavailable: {e}")

        observed_at = self._parse_qweather_time(current.get("obsTime"))
        is_day = True
        if observed_at:
            is_day = 6 <= observed_at.hour < 18

        return WeatherData(
            temperature=self._to_float(current.get("temp")),
            feels_like=self._to_float(current.get("feelsLike")),
            humidity=self._to_int(current.get("humidity")),
            precipitation_chance=precipitation_chance,
            precipitation_mm=precipitation_mm,
            wind_speed=self._to_float(current.get("windSpeed")),
            condition=condition,
            condition_code=self._to_int(current.get("icon")),
            is_day=is_day,
            uv_index=0,
            timestamp=observed_at or datetime.utcnow(),
        )

    async def get_current_weather(
        self, latitude: float, longitude: float, use_cache: bool = True
    ) -> WeatherData:
        """
        Fetch current weather for a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            use_cache: Whether to use cached data if available

        Returns:
            WeatherData with current conditions

        Raises:
            ValueError: If coordinates are out of bounds
            WeatherServiceError: If API request fails
        """
        self._validate_coordinates(latitude, longitude)

        if use_cache:
            cached = await self._cache_get(latitude, longitude)
            if cached:
                return cached

        provider_errors: list[str] = []
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            for provider in self.provider_order:
                try:
                    if provider == "qweather":
                        weather = await self._fetch_qweather_current_weather(
                            client, latitude, longitude
                        )
                    else:
                        weather = await self._fetch_openmeteo_current_weather(
                            client, latitude, longitude
                        )
                except WeatherServiceError as e:
                    provider_errors.append(f"{provider}: {e}")
                    logger.warning(f"Weather provider {provider} failed: {e}")
                    continue

                await self._cache_set(latitude, longitude, weather)

                logger.info(
                    f"Weather fetched from {provider} for ({latitude}, {longitude}): "
                    f"{weather.temperature}°C, {weather.condition}"
                )

                return weather

        error = WeatherServiceError(
            "All weather providers failed: " + "; ".join(provider_errors)
        )
        if use_cache:
            stale = await self._cache_get(latitude, longitude, stale=True)
            if stale:
                logger.warning(
                    f"Using stale weather cache for ({latitude}, {longitude}) "
                    f"after API failure: {error}"
                )
                return stale

        logger.error(f"Weather API error: {error}")
        raise error

    async def get_daily_forecast(
        self, latitude: float, longitude: float, days: int = 7
    ) -> list[DailyForecast]:
        """
        Fetch daily forecast for a location.

        Args:
            latitude: Location latitude
            longitude: Location longitude
            days: Number of days to forecast (1-16)

        Returns:
            List of DailyForecast objects

        Raises:
            ValueError: If coordinates are out of bounds
            WeatherServiceError: If API request fails
        """
        self._validate_coordinates(latitude, longitude)

        provider_errors: list[str] = []
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            for provider in self.provider_order:
                try:
                    if provider == "qweather":
                        return await self._fetch_qweather_daily_forecast(
                            client, latitude, longitude, days
                        )
                    return await self._fetch_openmeteo_daily_forecast(
                        client, latitude, longitude, days
                    )
                except WeatherServiceError as e:
                    provider_errors.append(f"{provider}: {e}")
                    logger.warning(f"Weather forecast provider {provider} failed: {e}")
                    continue

        error = WeatherServiceError(
            "All weather forecast providers failed: " + "; ".join(provider_errors)
        )
        logger.error(f"Weather API error: {error}")
        raise error

    async def _fetch_openmeteo_daily_forecast(
        self,
        client: httpx.AsyncClient,
        latitude: float,
        longitude: float,
        days: int,
    ) -> list[DailyForecast]:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
                "weather_code",
            ],
            "forecast_days": min(days, 16),
            "timezone": "auto",
        }

        data = await self._fetch_forecast_json(client, params, "forecast")

        daily = data.get("daily", {})
        dates = daily.get("time", [])
        temp_maxs = daily.get("temperature_2m_max", [])
        temp_mins = daily.get("temperature_2m_min", [])
        precip_probs = daily.get("precipitation_probability_max", [])
        weather_codes = daily.get("weather_code", [])

        forecasts = []
        for i, date in enumerate(dates):
            code = weather_codes[i] if i < len(weather_codes) else 0
            forecasts.append(
                DailyForecast(
                    date=date,
                    temp_max=temp_maxs[i] if i < len(temp_maxs) else 0,
                    temp_min=temp_mins[i] if i < len(temp_mins) else 0,
                    precipitation_chance=precip_probs[i] if i < len(precip_probs) else 0,
                    condition=self._interpret_weather_code(code),
                    condition_code=code,
                )
            )

        return forecasts

    @staticmethod
    def _qweather_daily_days(days: int) -> str:
        if days <= 3:
            return "3d"
        if days <= 7:
            return "7d"
        if days <= 10:
            return "10d"
        if days <= 15:
            return "15d"
        return "30d"

    async def _fetch_qweather_daily_forecast(
        self,
        client: httpx.AsyncClient,
        latitude: float,
        longitude: float,
        days: int,
    ) -> list[DailyForecast]:
        location = self._qweather_location(latitude, longitude)
        forecast_days = self._qweather_daily_days(days)
        data = await self._fetch_qweather_json(
            client,
            f"/v7/weather/{forecast_days}",
            {"location": location, "lang": "zh", "unit": "m"},
            "forecast",
        )

        forecasts = []
        for raw_day in (data.get("daily") or [])[:days]:
            condition = self._normalize_qweather_condition(
                raw_day.get("textDay") or raw_day.get("textNight"),
                raw_day.get("iconDay") or raw_day.get("iconNight"),
            )
            precipitation_mm = self._to_float(raw_day.get("precip"))
            precipitation_chance = 80 if (
                precipitation_mm > 0 or self._is_precipitation_condition(condition)
            ) else 0

            forecasts.append(
                DailyForecast(
                    date=raw_day.get("fxDate", ""),
                    temp_max=self._to_float(raw_day.get("tempMax")),
                    temp_min=self._to_float(raw_day.get("tempMin")),
                    precipitation_chance=precipitation_chance,
                    condition=condition,
                    condition_code=self._to_int(
                        raw_day.get("iconDay") or raw_day.get("iconNight")
                    ),
                )
            )

        return forecasts

    async def get_tomorrow_weather(self, latitude: float, longitude: float) -> WeatherData:
        """
        Fetch tomorrow's weather forecast and return as WeatherData.

        This is used for day-before notifications where we need to recommend
        outfits based on tomorrow's expected weather.

        Args:
            latitude: Location latitude
            longitude: Location longitude

        Returns:
            WeatherData with tomorrow's forecast (avg temp, conditions)
        """
        forecasts = await self.get_daily_forecast(latitude, longitude, days=2)

        if len(forecasts) < 2:
            # Fallback to current weather if forecast fails
            logger.warning("Could not get tomorrow's forecast, using current weather")
            return await self.get_current_weather(latitude, longitude)

        tomorrow = forecasts[1]  # Index 0 is today, 1 is tomorrow

        # Use average of min/max for the representative temperature
        avg_temp = (tomorrow.temp_min + tomorrow.temp_max) / 2
        # Use the max temp for feels_like (daytime outfit)
        feels_like = tomorrow.temp_max

        return WeatherData(
            temperature=round(avg_temp, 1),
            feels_like=round(feels_like, 1),
            humidity=50,  # Not available in daily forecast, use typical value
            precipitation_chance=tomorrow.precipitation_chance,
            precipitation_mm=0,  # Not available for forecast
            wind_speed=0,  # Not available in daily forecast
            condition=tomorrow.condition,
            condition_code=tomorrow.condition_code,
            is_day=True,  # Assume daytime for outfit recommendations
            uv_index=0,  # Not available in daily forecast
            timestamp=datetime.utcnow(),
        )

    async def check_health(self) -> dict:
        """Check if the weather service is available."""
        errors: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                for provider in self.provider_order:
                    try:
                        if provider == "qweather":
                            await self._fetch_qweather_json(
                                client,
                                "/v7/weather/now",
                                {
                                    "location": "116.41,39.92",
                                    "lang": "zh",
                                    "unit": "m",
                                },
                                "health",
                            )
                            return {"status": "healthy", "provider": "qweather"}

                        response = await client.get(
                            f"{self.openmeteo_url}/forecast",
                            params={
                                "latitude": 0,
                                "longitude": 0,
                                "current": "temperature_2m",
                            },
                        )
                        if response.status_code == 200:
                            return {"status": "healthy", "provider": "open-meteo"}
                        errors.append(f"openmeteo: HTTP {response.status_code}")
                    except Exception as e:
                        errors.append(f"{provider}: {e}")
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}

        return {"status": "unhealthy", "error": "; ".join(errors) or "Unknown error"}


class WeatherServiceError(Exception):
    pass

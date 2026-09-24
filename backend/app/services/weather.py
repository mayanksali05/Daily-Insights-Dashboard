"""Weather via Open-Meteo (free, no API key)."""
import asyncio

import httpx

from ..cache import ttl_cache
from ..config import settings

GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather code -> (label, icon key used by the frontend)
WMO = {
    0: ("Clear sky", "sun"),
    1: ("Mainly clear", "sun"),
    2: ("Partly cloudy", "cloud-sun"),
    3: ("Overcast", "cloud"),
    45: ("Fog", "fog"),
    48: ("Fog", "fog"),
    51: ("Light drizzle", "rain"),
    53: ("Drizzle", "rain"),
    55: ("Heavy drizzle", "rain"),
    61: ("Light rain", "rain"),
    63: ("Rain", "rain"),
    65: ("Heavy rain", "rain"),
    71: ("Light snow", "snow"),
    73: ("Snow", "snow"),
    75: ("Heavy snow", "snow"),
    80: ("Rain showers", "rain"),
    81: ("Rain showers", "rain"),
    82: ("Violent showers", "rain"),
    95: ("Thunderstorm", "storm"),
    96: ("Thunderstorm", "storm"),
    99: ("Thunderstorm", "storm"),
}


def _describe(code: int) -> tuple[str, str]:
    return WMO.get(code, ("Unknown", "cloud"))


# Built-in coordinates so the default city works even if the geocoding API is unreachable.
KNOWN_PLACES = {
    "ahmedabad": {"name": "Ahmedabad", "country": "India", "latitude": 23.0225, "longitude": 72.5714},
}


# City lookups rarely change, so cache them for a week (one less call per refresh).
@ttl_cache(lambda: 7 * 24 * 3600)
async def _geocode(city: str) -> dict:
    if city.lower() == settings.weather_city.lower() and settings.weather_lat is not None and settings.weather_lon is not None:
        return {"name": city, "country": "", "latitude": settings.weather_lat, "longitude": settings.weather_lon}
    if city.lower() in KNOWN_PLACES:
        return KNOWN_PLACES[city.lower()]
    res = await _get(GEO_URL, {"name": city, "count": 1})
    results = res.json().get("results")
    if not results:
        raise ValueError(f"Location '{city}' not found")
    return results[0]


async def _get(url: str, params: dict) -> httpx.Response:
    """GET with one retry: shared cloud IPs occasionally get a 429/5xx or a timeout."""
    last: Exception | None = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "DailyCommandCenter/1.0"}) as client:
                res = await client.get(url, params=params)
            res.raise_for_status()
            return res
        except (httpx.HTTPStatusError, httpx.TransportError) as e:
            last = e
            if attempt == 0:
                await asyncio.sleep(1.5)
    raise last  # type: ignore[misc]


@ttl_cache(lambda: settings.cache_ttl_weather)
async def get_weather(city: str | None = None) -> dict:
    city = (city or settings.weather_city).strip()
    place = await _geocode(city)
    res = await _get(
        FORECAST_URL,
        {
            "latitude": place["latitude"],
            "longitude": place["longitude"],
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,"
            "wind_speed_10m,weather_code",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,"
            "precipitation_probability_max",
            "timezone": "auto",
            "forecast_days": 5,
        },
    )
    data = res.json()

    cur = data["current"]
    label, icon = _describe(cur["weather_code"])
    daily = data["daily"]
    forecast = []
    for i, day in enumerate(daily["time"]):
        d_label, d_icon = _describe(daily["weather_code"][i])
        forecast.append(
            {
                "date": day,
                "max": round(daily["temperature_2m_max"][i]),
                "min": round(daily["temperature_2m_min"][i]),
                "rain_chance": daily["precipitation_probability_max"][i],
                "label": d_label,
                "icon": d_icon,
            }
        )
    return {
        "city": place["name"],
        "country": place.get("country", ""),
        "temperature": round(cur["temperature_2m"]),
        "feels_like": round(cur["apparent_temperature"]),
        "humidity": cur["relative_humidity_2m"],
        "wind_kmh": round(cur["wind_speed_10m"]),
        "label": label,
        "icon": icon,
        "forecast": forecast,
    }

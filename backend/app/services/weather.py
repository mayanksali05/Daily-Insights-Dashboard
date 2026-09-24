"""Weather via Open-Meteo (free, no API key)."""
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


@ttl_cache(lambda: settings.cache_ttl_weather)
async def get_weather(city: str | None = None) -> dict:
    city = (city or settings.weather_city).strip()
    async with httpx.AsyncClient(timeout=10) as client:
        geo = await client.get(GEO_URL, params={"name": city, "count": 1})
        geo.raise_for_status()
        results = geo.json().get("results")
        if not results:
            raise ValueError(f"Location '{city}' not found")
        place = results[0]

        res = await client.get(
            FORECAST_URL,
            params={
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
        res.raise_for_status()
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

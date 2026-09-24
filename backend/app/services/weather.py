"""Weather: Open-Meteo first, MET Norway as fallback (both free, no API key)."""
import asyncio
import math
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

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


USER_AGENT = "DailyCommandCenter/1.0 (+https://github.com/mayanksali05/Daily-Insights-Dashboard)"
MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"

# Open-Meteo rate-limits per IP, and cloud hosts share IPs. After a 429 we skip it
# for a while and use MET Norway instead of hammering it.
_open_meteo_paused_until = 0.0
_last_good: dict[str, tuple[float, dict]] = {}
STALE_OK_SECONDS = 6 * 3600


class RateLimited(Exception):
    pass


async def _get(url: str, params: dict) -> httpx.Response:
    """GET with one retry for timeouts / 5xx. A 429 is raised immediately (retrying won't help)."""
    last: Exception | None = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=10, headers={"User-Agent": USER_AGENT}) as client:
                res = await client.get(url, params=params)
            if res.status_code == 429:
                raise RateLimited(url.split("/")[2])
            res.raise_for_status()
            return res
        except (httpx.HTTPStatusError, httpx.TransportError) as e:
            last = e
            if attempt == 0:
                await asyncio.sleep(1.5)
    raise last  # type: ignore[misc]


# ---------- provider 1: Open-Meteo ----------

async def _open_meteo(place: dict) -> dict:
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
        "temperature": round(cur["temperature_2m"]),
        "feels_like": round(cur["apparent_temperature"]),
        "humidity": cur["relative_humidity_2m"],
        "wind_kmh": round(cur["wind_speed_10m"]),
        "label": label,
        "icon": icon,
        "forecast": forecast,
        "source": "Open-Meteo",
    }


# ---------- provider 2: MET Norway (free, no key; needs an identifying User-Agent) ----------

def _met_describe(symbol: str | None) -> tuple[str, str]:
    s = (symbol or "").split("_")[0]
    exact = {
        "clearsky": ("Clear sky", "sun"),
        "fair": ("Mainly clear", "sun"),
        "partlycloudy": ("Partly cloudy", "cloud-sun"),
        "cloudy": ("Overcast", "cloud"),
        "fog": ("Fog", "fog"),
    }
    if s in exact:
        return exact[s]
    if "thunder" in s:
        return ("Thunderstorm", "storm")
    if "snow" in s or "sleet" in s:
        return ("Snow", "snow")
    if "heavyrain" in s:
        return ("Heavy rain", "rain")
    if "lightrain" in s:
        return ("Light rain", "rain")
    if "showers" in s:
        return ("Rain showers", "rain")
    if "rain" in s:
        return ("Rain", "rain")
    return ("Cloudy", "cloud")


def _apparent_temp(temp_c: float, rh: float, wind_ms: float) -> float:
    """Steadman apparent temperature (what "feels like" means on most weather sites)."""
    e = rh / 100 * 6.105 * math.exp(17.27 * temp_c / (237.7 + temp_c))
    return temp_c + 0.33 * e - 0.70 * wind_ms - 4.00


def _symbol(entry: dict) -> str | None:
    data = entry.get("data", {})
    for key in ("next_1_hours", "next_6_hours", "next_12_hours"):
        code = (data.get(key) or {}).get("summary", {}).get("symbol_code")
        if code:
            return code
    return None


async def _met_norway(place: dict) -> dict:
    res = await _get(MET_URL, {"lat": round(place["latitude"], 4), "lon": round(place["longitude"], 4)})
    series = res.json()["properties"]["timeseries"]
    tz = _tz()

    now = series[0]
    d = now["data"]["instant"]["details"]
    temp, rh, wind = d["air_temperature"], d.get("relative_humidity", 50), d.get("wind_speed", 0)
    label, icon = _met_describe(_symbol(now))

    days: dict[str, list[dict]] = {}
    for entry in series:
        local = datetime.fromisoformat(entry["time"].replace("Z", "+00:00")).astimezone(tz)
        days.setdefault(local.date().isoformat(), []).append({**entry, "_hour": local.hour})
    forecast = []
    for day, entries in list(days.items())[:5]:
        temps = [e["data"]["instant"]["details"]["air_temperature"] for e in entries]
        midday = min(entries, key=lambda e: abs(e["_hour"] - 12))
        d_label, d_icon = _met_describe(_symbol(midday))
        forecast.append(
            {"date": day, "max": round(max(temps)), "min": round(min(temps)),
             "rain_chance": None, "label": d_label, "icon": d_icon}
        )
    return {
        "temperature": round(temp),
        "feels_like": round(_apparent_temp(temp, rh, wind)),
        "humidity": round(rh),
        "wind_kmh": round(wind * 3.6),
        "label": label,
        "icon": icon,
        "forecast": forecast,
        "source": "MET Norway",
    }


def _tz():
    try:
        return ZoneInfo(settings.timezone)
    except Exception:
        return timezone(timedelta(hours=5, minutes=30))


@ttl_cache(lambda: settings.cache_ttl_weather)
async def get_weather(city: str | None = None) -> dict:
    global _open_meteo_paused_until
    city = (city or settings.weather_city).strip()
    place = await _geocode(city)

    errors = []
    providers = []
    if time.monotonic() >= _open_meteo_paused_until:
        providers.append(_open_meteo)
    providers.append(_met_norway)

    for provider in providers:
        try:
            body = await provider(place)
            result = {"city": place["name"], "country": place.get("country", ""), **body}
            _last_good[city.lower()] = (time.monotonic(), result)
            return result
        except RateLimited as e:
            if provider is _open_meteo:
                _open_meteo_paused_until = time.monotonic() + 30 * 60
            errors.append(f"{provider.__name__}: rate limited ({e})")
        except Exception as e:
            errors.append(f"{provider.__name__}: {type(e).__name__}: {e}")

    # Every provider failed: show the last good reading if it's recent enough.
    cached = _last_good.get(city.lower())
    if cached and time.monotonic() - cached[0] < STALE_OK_SECONDS:
        return {**cached[1], "stale": True}
    raise RuntimeError("; ".join(errors))

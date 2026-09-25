from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "daily_command_center"
    cors_origins: str = "http://localhost:5173"

    weather_city: str = "Ahmedabad"
    # Optional coordinates for WEATHER_CITY (skips the city lookup). Ahmedabad is built in.
    weather_lat: float | None = None
    weather_lon: float | None = None
    # Applied to gold/silver USD->INR conversion. India's rate was raised to 15% in May 2026.
    import_duty_percent: float = 15.0
    cache_ttl_weather: int = 900
    cache_ttl_markets: int = 60
    cache_ttl_news: int = 600
    cache_ttl_notion: int = 30

    # Optional: copied into the FIRST account at sign-up (each user then manages their
    # own Notion connection in Settings). Title or Notion URL/ID of the expenses page.
    notion_token: str = ""
    notion_expenses_page: str = "Expenses"
    # Used for "this month" boundaries
    timezone: str = "Asia/Kolkata"

    # Invite code others must enter to create an account (the first account needs none).
    # Empty = sign-ups closed once the first account exists.
    signup_code: str = ""
    # Signs session cookies and encrypts stored Notion tokens. Set a long random value
    # in production and don't change it (changing it signs everyone out and forgets Notion keys).
    secret_key: str = ""

    brief_provider: str = "extractive"
    llm_api_key: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

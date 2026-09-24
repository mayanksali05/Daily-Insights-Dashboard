from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "daily_command_center"
    cors_origins: str = "http://localhost:5173"

    weather_city: str = "Ahmedabad"
    # Applied to gold/silver USD->INR conversion. India's rate was raised to 15% in May 2026.
    import_duty_percent: float = 15.0
    cache_ttl_weather: int = 900
    cache_ttl_markets: int = 60
    cache_ttl_news: int = 600
    cache_ttl_notion: int = 30

    # Notion internal integration secret (backend only)
    notion_token: str = ""
    # Title of the expenses page/database, or its Notion URL/ID
    notion_expenses_page: str = "Expenses"
    # Used for "this month" boundaries
    timezone: str = "Asia/Kolkata"

    brief_provider: str = "extractive"
    llm_api_key: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

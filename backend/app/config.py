from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "daily_command_center"
    cors_origins: str = "http://localhost:5173"

    weather_city: str = "Ahmedabad"
    cache_ttl_weather: int = 900
    cache_ttl_markets: int = 60
    cache_ttl_news: int = 600

    brief_provider: str = "extractive"
    llm_api_key: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

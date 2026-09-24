# Daily Command Center

A personal dark-mode dashboard: weather, markets, news, an AI-ready daily brief, tasks and notes.

**Stack:** React + Vite + Tailwind · FastAPI · MongoDB (tasks & notes) · free public data sources (no API keys required)

## Run it

Prerequisites: Node 18+, Python 3.10+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
# 1. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env          # macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

The Vite dev server proxies `/api` to the backend, so the browser never talks to third parties directly.

## Structure

```
backend/app/
  main.py            app + CORS
  config.py          settings loaded from .env
  cache.py           in-memory TTL cache
  db.py              Mongo (motor) connection
  schemas.py         Pydantic models
  routers/           tasks.py, notes.py (CRUD), info.py (weather/markets/news/brief)
  services/          weather.py, markets.py, news.py, brief.py  <- one module per external source
frontend/src/
  App.jsx, api.js, hooks.js (settings + fetch hooks), utils.js
  components/        Header, Nav, WeatherCard, MarketCards, NewsSection, BriefCard,
                     TasksPanel, NotesPanel, SettingsPanel, ui
```

## Data sources

| Feature | Source | Key needed |
|---|---|---|
| Weather | Open-Meteo | No |
| Markets (NIFTY, SENSEX, S&P, NASDAQ, USD/INR, BTC) | Yahoo Finance chart endpoint (unofficial) | No |
| News | Public RSS (BBC, Al Jazeera, The Hindu, Times of India, TechCrunch, The Verge, VentureBeat) | No |

Each source lives in its own service module, so replacing one (e.g. with NewsAPI or Alpha Vantage) only touches that file. Put any future keys in `backend/.env`; they are never sent to the frontend.

## Connecting an LLM to "Today's Brief" later

`backend/app/services/brief.py` defines a provider interface. Implement `LLMBriefProvider.generate(headlines)` to return `{"summary": str, "bullets": [...]}`, then set `BRIEF_PROVIDER=llm` and `LLM_API_KEY=...` in `.env`. The API response shape and the frontend stay the same. Until then, the brief shows the top headline per topic.

## API

- `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/{id}`
- `GET/POST /api/notes`, `PATCH/DELETE /api/notes/{id}`
- `GET /api/weather?city=`, `GET /api/markets?symbols=nifty50,btc`, `GET /api/news/{world|india|tech|ai}`, `GET /api/brief`

## Notes

- Dashboard settings (sections, indices, news categories, name, city) are stored in the browser's localStorage.
- Tasks with no due date appear under Upcoming; overdue tasks show at the top of Today, highlighted in red.
- Cache TTLs (weather 15 min, markets 60 s, news 10 min) are configurable in `.env`.

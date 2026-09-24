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

## Deploy to Render (free)

The repo includes a `Dockerfile` (builds the frontend and backend into one image) and a `render.yaml` Blueprint (free web service in Singapore, health check on `/api/health`, auto-deploy on every push to `main`). Deployed, the dashboard **requires a password** (`DASHBOARD_PASSWORD`); a successful sign-in lasts 30 days, and 5 wrong attempts lock that IP out for 15 minutes.

1. **Database: MongoDB Atlas (free M0).** Create a free cluster (AWS, **Mumbai**), add a database user, and under *Network Access* allow `0.0.0.0/0` (Render's free plan has no fixed IP). Copy the connection string (`mongodb+srv://user:pass@.../?retryWrites=true&w=majority`).
2. **Push this repo to GitHub** (`main` branch). Check `backend/.env` is **not** committed.
3. **Render:** *New → Blueprint* → pick the repo. Render reads `render.yaml` and asks for the secrets:
   - `MONGODB_URI`: the Atlas connection string
   - `DASHBOARD_PASSWORD`: the password you'll sign in with
   - `NOTION_TOKEN`: your Notion integration secret
   (`SECRET_KEY` is generated automatically; other settings have defaults you can change later under *Environment*.)
4. Wait for the first build (a few minutes), open `https://<your-service>.onrender.com`, and sign in.

Free-plan behaviour: the service sleeps after 15 minutes with no visitors and takes about a minute to wake. While the dashboard is open it polls every 30–60 s, so it stays awake. One always-on free service fits within Render's 750 free hours a month.

For Lively Wallpaper or an app window, use the Render URL instead of `http://localhost:8000` and sign in once.

## Show it on your desktop (always on)

The backend can also serve the built frontend, so the whole dashboard runs as **one program at http://localhost:8000**.

1. **Build the frontend** (again after any frontend code change):
   ```
   cd frontend
   npm run build
   ```
2. **Start it:** double-click `start-dashboard.bat` (shows a console window), or `start-dashboard-hidden.vbs` (runs in the background). Stop it with `stop-dashboard.bat`.
3. **Start automatically at login:** press `Win + R`, type `shell:startup`, and put a shortcut to `start-dashboard-hidden.vbs` in that folder.
4. **MongoDB must be running at boot:** if you installed MongoDB with "Install as a Service", it already is (check *Services → MongoDB Server* is *Automatic*). If you use MongoDB Atlas, nothing to do.

**Display options**

- **As your desktop wallpaper (live):** install [Lively Wallpaper](https://www.rocksdanister.com/lively/) (free, also on the Microsoft Store). Click **+ Add Wallpaper**, paste `http://localhost:8000`, and set it as the wallpaper. Enable mouse input for wallpapers in Lively's settings if you want to tick tasks or click news from the desktop.
- **As its own window (no browser bars):** `msedge --app=http://localhost:8000` (or `chrome --app=...`). Pin it to the taskbar. Add `--start-fullscreen` for a dedicated screen.

Everything refreshes on its own: clock every second, prices every minute, Notion every 30 s, news and brief every 10 min, weather every 15 min.

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
| Gold & silver in INR | COMEX futures + USD/INR from Yahoo Finance (unofficial), converted to ₹ per 10 g / per kg and marked up by `IMPORT_DUTY_PERCENT` (indicative; excludes GST and jeweller premiums) | No |
| News | Public RSS (BBC, Al Jazeera, The Hindu, Times of India, TechCrunch, The Verge, VentureBeat) | No |
| Notion (recently edited pages) | Official Notion API, polled every 30 s | Yes: `NOTION_TOKEN` |


### Connecting Notion

1. Go to https://www.notion.so/profile/integrations → **New integration** (type: Internal), pick your workspace, and copy the **Internal Integration Secret**.
2. Add it to `backend/.env`: `NOTION_TOKEN=ntn_...` and restart the backend.
3. In Notion, open each top-level page (or database) you want to see → **•••** menu → **Connections** → add your integration. Its sub-pages come along automatically.

The **Expenses** card shows the total spent this month from the Notion page named in `NOTION_EXPENSES_PAGE` (default `Expenses`; a Notion URL also works). It refreshes every 30 seconds and whenever you return to the tab. The layout is detected automatically (`backend/app/services/notion_expenses.py`):

- a database (full-page or inline): sums the Amount/number column for rows dated this month (or created this month if there's no date column)
- a simple table: amount and date columns found from headers or contents; rows without a date count by when they were added
- lines of text such as `Groceries - 850` or `Rapido ₹120`: a date in the line wins, else a month heading above it, else when the line was added
- sub-pages or toggle headings named after months (`September 2026`)

Rows or lines starting with "Total" are skipped. Hover over the total to see which layout was detected. The token never leaves the backend.

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

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import auth
from .config import settings
from .db import get_db
from .routers import info, me, notes, tasks

app = FastAPI(title="Daily Command Center API")
log = logging.getLogger("uvicorn.error")


@app.on_event("startup")
async def create_indexes():
    try:
        db = get_db()
        await db.users.create_index("email", unique=True)
        await db.tasks.create_index([("user_id", 1), ("created_at", -1)])
        await db.notes.create_index([("user_id", 1), ("updated_at", -1)])
    except Exception as e:  # keep serving; /api/diagnostics explains DB problems
        log.error("Could not create indexes: %s: %s", type(e).__name__, e)

app.add_middleware(auth.AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    if request.headers.get("x-forwarded-proto") == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


app.include_router(auth.router)
app.include_router(me.router)
app.include_router(tasks.router)
app.include_router(notes.router)
app.include_router(info.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve the built React app (frontend/dist) from this same server, so the whole
# dashboard runs as one service. Run `npm run build` in frontend/ first (the
# Dockerfile does this). In development, Vite (port 5173) is used instead.
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if (DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(DIST):
            return FileResponse(file)
        return FileResponse(DIST / "index.html")

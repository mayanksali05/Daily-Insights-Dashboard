from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import info, notes, tasks

app = FastAPI(title="Daily Command Center API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router)
app.include_router(notes.router)
app.include_router(info.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}

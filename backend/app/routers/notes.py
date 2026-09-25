from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Request, Response

from ..auth import user_id_of
from ..db import get_db
from ..schemas import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/api/notes", tags=["notes"])


def _oid(note_id: str) -> ObjectId:
    try:
        return ObjectId(note_id)
    except InvalidId:
        raise HTTPException(404, "Note not found")


def _out(doc: dict) -> NoteOut:
    return NoteOut(
        id=str(doc["_id"]),
        title=doc.get("title", ""),
        content=doc.get("content", ""),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.get("", response_model=list[NoteOut])
async def list_notes(request: Request):
    docs = await get_db().notes.find({"user_id": user_id_of(request)}).sort("updated_at", -1).to_list(1000)
    return [_out(d) for d in docs]


@router.post("", response_model=NoteOut, status_code=201)
async def create_note(body: NoteCreate, request: Request):
    now = datetime.now(timezone.utc)
    doc = {**body.model_dump(), "user_id": user_id_of(request), "created_at": now, "updated_at": now}
    res = await get_db().notes.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _out(doc)


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(note_id: str, body: NoteUpdate, request: Request):
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        raise HTTPException(400, "Nothing to update")
    data["updated_at"] = datetime.now(timezone.utc)
    doc = await get_db().notes.find_one_and_update(
        {"_id": _oid(note_id), "user_id": user_id_of(request)}, {"$set": data}, return_document=True
    )
    if not doc:
        raise HTTPException(404, "Note not found")
    return _out(doc)


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: str, request: Request):
    res = await get_db().notes.delete_one({"_id": _oid(note_id), "user_id": user_id_of(request)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Note not found")
    return Response(status_code=204)

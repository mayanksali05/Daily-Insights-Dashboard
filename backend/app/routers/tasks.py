from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Response

from ..db import get_db
from ..schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _oid(task_id: str) -> ObjectId:
    try:
        return ObjectId(task_id)
    except InvalidId:
        raise HTTPException(404, "Task not found")


def _out(doc: dict) -> TaskOut:
    return TaskOut(
        id=str(doc["_id"]),
        title=doc["title"],
        priority=doc.get("priority", "medium"),
        due_date=doc.get("due_date"),
        completed=doc.get("completed", False),
        created_at=doc["created_at"],
    )


def _to_doc(data: dict) -> dict:
    # Mongo (BSON) cannot store datetime.date, so persist due_date as ISO string.
    if data.get("due_date") is not None:
        data["due_date"] = data["due_date"].isoformat()
    return data


@router.get("", response_model=list[TaskOut])
async def list_tasks():
    docs = await get_db().tasks.find().sort("created_at", -1).to_list(1000)
    return [_out(d) for d in docs]


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(body: TaskCreate):
    doc = _to_doc(body.model_dump())
    doc["created_at"] = datetime.now(timezone.utc)
    res = await get_db().tasks.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _out(doc)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, body: TaskUpdate):
    data = body.model_dump(exclude_unset=True)
    clear = data.pop("clear_due_date", False)
    update = _to_doc({k: v for k, v in data.items() if v is not None})
    op: dict = {}
    if update:
        op["$set"] = update
    if clear:
        op["$unset"] = {"due_date": ""}
    if not op:
        raise HTTPException(400, "Nothing to update")
    doc = await get_db().tasks.find_one_and_update(
        {"_id": _oid(task_id)}, op, return_document=True
    )
    if not doc:
        raise HTTPException(404, "Task not found")
    return _out(doc)


@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str):
    res = await get_db().tasks.delete_one({"_id": _oid(task_id)})
    if res.deleted_count == 0:
        raise HTTPException(404, "Task not found")
    return Response(status_code=204)

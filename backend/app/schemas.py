from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Priority = Literal["high", "medium", "low"]


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: Priority = "medium"
    due_date: Optional[date] = None
    completed: bool = False


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    priority: Optional[Priority] = None
    due_date: Optional[date] = None
    clear_due_date: bool = False
    completed: Optional[bool] = None


class TaskOut(TaskBase):
    id: str
    created_at: datetime


class NoteBase(BaseModel):
    title: str = Field(default="", max_length=200)
    content: str = Field(default="", max_length=20000)


class NoteCreate(NoteBase):
    pass


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    content: Optional[str] = Field(default=None, max_length=20000)


class NoteOut(NoteBase):
    id: str
    created_at: datetime
    updated_at: datetime

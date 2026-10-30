"""Справочники для фильтров: институты, предметы, семестры, типы работ, преподаватели (+ список годов).
Чтение — всем (включая гостей), изменение — модераторам и администраторам."""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, create_model
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_moderator
from app.models import Institute, Semester, Subject, Teacher, User, WorkType
from app.schemas import DictItem, SemesterItem, TeacherItem

router = APIRouter(prefix="/dictionaries", tags=["Справочники"])


class AllDictionaries(BaseModel):
    institutes: list[DictItem]
    subjects: list[DictItem]
    semesters: list[SemesterItem]
    work_types: list[DictItem]
    teachers: list[TeacherItem]
    years: list[int]


@router.get("", response_model=AllDictionaries)
def all_dictionaries(db: Session = Depends(get_db)):
    """Все справочники одним запросом — для экрана фильтров и формы создания поста."""
    def load(schema, model, order):
        return [schema.model_validate(x) for x in db.scalars(select(model).order_by(order))]

    return AllDictionaries(
        institutes=load(DictItem, Institute, Institute.name),
        subjects=load(DictItem, Subject, Subject.name),
        semesters=load(SemesterItem, Semester, Semester.number),
        work_types=load(DictItem, WorkType, WorkType.name),
        teachers=load(TeacherItem, Teacher, Teacher.full_name),
        years=list(range(datetime.now(timezone.utc).year, datetime.now(timezone.utc).year - 8, -1)),
    )


def _register(path: str, model: Any, field: str, py_type: type, title: str, field_kwargs: dict) -> None:
    """Создаёт CRUD-эндпоинты для одного справочника."""
    column = getattr(model, field)

    In = create_model(f"{model.__name__}In", **{field: (py_type, Field(..., **field_kwargs))})
    Out = create_model(
        f"{model.__name__}Out",
        __config__=ConfigDict(from_attributes=True),
        id=(int, ...),
        **{field: (py_type, ...)},
    )

    def _clean(value):
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Значение не может быть пустым")
        return value

    def _get_or_404(db: Session, item_id: int):
        obj = db.get(model, item_id)
        if obj is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"{title}: запись не найдена")
        return obj

    def _ensure_unique(db: Session, value, exclude_id: int | None = None):
        stmt = select(model.id).where(column == value)
        if exclude_id is not None:
            stmt = stmt.where(model.id != exclude_id)
        if db.scalar(stmt) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{title}: «{value}» уже есть в справочнике")

    def list_items(
        q: str | None = Query(None, max_length=100, description="Поиск по названию"),
        db: Session = Depends(get_db),
    ):
        stmt = select(model).order_by(column)
        if q and py_type is str:
            stmt = stmt.where(column.ilike(f"%{q.strip()}%"))
        return db.scalars(stmt).all()

    def create_item(data: In, db: Session = Depends(get_db), _: User = Depends(require_moderator)):
        value = _clean(getattr(data, field))
        _ensure_unique(db, value)
        obj = model(**{field: value})
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update_item(
        item_id: int, data: In, db: Session = Depends(get_db), _: User = Depends(require_moderator)
    ):
        obj = _get_or_404(db, item_id)
        value = _clean(getattr(data, field))
        _ensure_unique(db, value, exclude_id=item_id)
        setattr(obj, field, value)
        db.commit()
        db.refresh(obj)
        return obj

    def delete_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(require_moderator)):
        obj = _get_or_404(db, item_id)
        db.delete(obj)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{title}: запись используется в постах, удалить нельзя (можно переименовать)",
            ) from None

    router.add_api_route(
        f"/{path}", list_items, methods=["GET"], response_model=list[Out],
        summary=f"{title}: список",
    )
    router.add_api_route(
        f"/{path}", create_item, methods=["POST"], response_model=Out, status_code=201,
        summary=f"{title}: добавить (модератор)",
    )
    router.add_api_route(
        f"/{path}/{{item_id}}", update_item, methods=["PATCH"], response_model=Out,
        summary=f"{title}: изменить (модератор)",
    )
    router.add_api_route(
        f"/{path}/{{item_id}}", delete_item, methods=["DELETE"], status_code=204,
        summary=f"{title}: удалить (модератор)",
    )


_register("institutes", Institute, "name", str, "Институт", {"min_length": 1, "max_length": 255})
_register("subjects", Subject, "name", str, "Предмет", {"min_length": 1, "max_length": 255})
_register("semesters", Semester, "number", int, "Семестр", {"ge": 1, "le": 12})
_register("work_types", WorkType, "name", str, "Тип работы", {"min_length": 1, "max_length": 255})
_register("teachers", Teacher, "full_name", str, "Преподаватель", {"min_length": 1, "max_length": 255})

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tag, post_tags
from app.services import _escape_like

router = APIRouter(prefix="/tags", tags=["Теги"])


@router.get("", response_model=list[str])
def popular_tags(
    q: str | None = Query(None, max_length=30, description="Начало тега"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Теги по убыванию популярности — для подсказок при создании поста."""
    stmt = (
        select(Tag.name)
        .join(post_tags, post_tags.c.tag_id == Tag.id)
        .group_by(Tag.id)
        .order_by(func.count().desc(), Tag.name)
        .limit(limit)
    )
    if q and q.strip():
        prefix = _escape_like(q.strip().lstrip("#").lower())
        stmt = stmt.where(Tag.name.like(f"{prefix}%", escape="\\"))
    return list(db.scalars(stmt))

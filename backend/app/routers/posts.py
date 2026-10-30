from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user_optional, require_student
from app.files import POST_FILE_KINDS, delete_media, save_upload
from app.models import ROLE_ADMIN, Like, Post, PostFile, User
from app.schemas import LikeOut, PostCreate, PostOut, PostPage, PostUpdate
from app.services import (
    SortMode,
    build_post_filters,
    change_likes_count,
    get_post_or_404,
    order_posts,
    paginate_posts,
    serialize_posts,
    set_post_tags,
    validate_post_refs,
)

router = APIRouter(prefix="/posts", tags=["Посты"])


def _check_owner(post: Post, user: User) -> None:
    if post.author_id != user.id and user.role.name != ROLE_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это не ваш пост")


@router.get("", response_model=PostPage)
def search_posts(
    sort: SortMode = Query("new", description="new — от новых к старым, rating — по лайкам"),
    q: str | None = Query(None, max_length=100, description="Строка поиска"),
    institute_id: int | None = None,
    subject_id: int | None = None,
    semester_id: int | None = None,
    work_type_id: int | None = None,
    teacher_id: int | None = None,
    author_id: int | None = None,
    year: int | None = Query(None, description="Год материалов"),
    tag: str | None = Query(None, max_length=30, description="Точный тег"),
    limit: int = Query(6, ge=1, le=50, description="Сколько постов подгрузить"),
    offset: int = Query(0, ge=0, description="Сколько уже загружено (для кнопки «ещё»)"),
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    """Лента/поиск постов. Доступно всем, включая гостей.

    Кнопка «ещё»: повторить запрос с `offset = offset + limit`, пока `has_more = true`.
    """
    conds = build_post_filters(
        institute_id=institute_id,
        subject_id=subject_id,
        semester_id=semester_id,
        work_type_id=work_type_id,
        teacher_id=teacher_id,
        q=q,
        author_id=author_id,
        year=year,
        tag=tag,
    )
    stmt = order_posts(select(Post).where(*conds), sort)
    count_stmt = select(func.count(Post.id)).where(*conds)
    return paginate_posts(db, stmt, count_stmt, viewer, limit, offset)


@router.get("/{post_id}", response_model=PostOut)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    post = get_post_or_404(db, post_id)
    return serialize_posts(db, [post], viewer)[0]


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    data: PostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """Создать пост. Файлы прикрепляются отдельным запросом `POST /posts/{id}/files`."""
    validate_post_refs(
        db,
        institute_id=data.institute_id,
        subject_id=data.subject_id,
        semester_id=data.semester_id,
        work_type_id=data.work_type_id,
        teacher_id=data.teacher_id,
    )
    post = Post(
        author_id=user.id,
        display_nickname=user.nickname,
        comment=data.comment,
        institute_id=data.institute_id,
        subject_id=data.subject_id,
        semester_id=data.semester_id,
        work_type_id=data.work_type_id,
        teacher_id=data.teacher_id,
        **({"year": data.year} if data.year is not None else {}),
    )
    set_post_tags(db, post, data.tags)
    db.add(post)
    db.commit()
    db.refresh(post)
    return serialize_posts(db, [post], user)[0]


@router.patch("/{post_id}", response_model=PostOut)
def update_post(
    post_id: int,
    data: PostUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """Редактировать свой пост (передаются только изменяемые поля)."""
    post = get_post_or_404(db, post_id)
    _check_owner(post, user)

    fields = data.model_dump(exclude_unset=True)
    tags = fields.pop("tags", None)

    for required in ("institute_id", "subject_id", "semester_id", "work_type_id", "year"):
        if required in fields and fields[required] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Поле {required} не может быть пустым")
    if "comment" in fields and fields["comment"] is None:
        fields["comment"] = ""

    validate_post_refs(db, **{k: v for k, v in fields.items() if k.endswith("_id")})
    for key, value in fields.items():
        setattr(post, key, value)
    if tags is not None:
        set_post_tags(db, post, tags)
    post.updated_at = func.now()

    db.commit()
    db.refresh(post)
    return serialize_posts(db, [post], user)[0]


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """Удалить свой пост."""
    post = get_post_or_404(db, post_id)
    _check_owner(post, user)
    urls = [f.file_url for f in post.files]
    db.delete(post)
    db.commit()
    for url in urls:
        delete_media(url)


# ---------- Файлы поста ----------

@router.post("/{post_id}/files", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def upload_post_files(
    post_id: int,
    files: list[UploadFile] = File(..., description="Один или несколько файлов"),
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    """Прикрепить файлы к своему посту (pdf, docx, pptx, xlsx, txt, изображения, архивы)."""
    post = get_post_or_404(db, post_id)
    _check_owner(post, user)
    if len(post.files) + len(files) > settings.MAX_FILES_PER_POST:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"К посту можно прикрепить не больше {settings.MAX_FILES_PER_POST} файлов",
        )

    saved: list[str] = []
    try:
        for upload in files:
            url, kind = save_upload(upload, "posts", POST_FILE_KINDS, settings.MAX_UPLOAD_MB)
            saved.append(url)
            post.files.append(PostFile(file_url=url, file_kind=kind))
        db.commit()
    except Exception:
        db.rollback()
        for url in saved:
            delete_media(url)
        raise
    db.refresh(post)
    return serialize_posts(db, [post], user)[0]


@router.delete("/{post_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post_file(
    post_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    post = get_post_or_404(db, post_id)
    _check_owner(post, user)
    pf = db.get(PostFile, file_id)
    if pf is None or pf.post_id != post.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Файл не найден")
    url = pf.file_url
    post.files.remove(pf)
    db.commit()
    delete_media(url)


# ---------- Лайки ----------

@router.post("/{post_id}/like", response_model=LikeOut)
def like_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    post = get_post_or_404(db, post_id)
    if post.author_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя лайкнуть собственный пост")
    if db.get(Like, (user.id, post.id)) is None:
        try:
            db.add(Like(user_id=user.id, post_id=post.id))
            db.flush()
            count = change_likes_count(db, post.id, +1)
            db.commit()
        except IntegrityError:  # параллельный повторный лайк
            db.rollback()
            count = db.scalar(select(Post.likes_count).where(Post.id == post.id))
    else:
        count = post.likes_count
    return LikeOut(post_id=post.id, liked=True, likes_count=count)


@router.delete("/{post_id}/like", response_model=LikeOut)
def unlike_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
):
    post = get_post_or_404(db, post_id)
    like = db.get(Like, (user.id, post.id))
    if like is not None:
        db.delete(like)
        db.flush()
        count = change_likes_count(db, post.id, -1)
        db.commit()
    else:
        count = post.likes_count
    return LikeOut(post_id=post.id, liked=False, likes_count=count)

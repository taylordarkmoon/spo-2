"""Сохранение загруженных файлов на диск (том media в docker-compose)."""

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

MEDIA_ROOT = Path(settings.MEDIA_DIR).resolve()
CHUNK = 1024 * 1024

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

POST_FILE_KINDS: dict[str, str] = {
    **{ext: "image" for ext in IMAGE_EXT},
    ".pdf": "pdf",
    ".doc": "document",
    ".docx": "document",
    ".odt": "document",
    ".rtf": "document",
    ".txt": "text",
    ".md": "text",
    ".ppt": "presentation",
    ".pptx": "presentation",
    ".xls": "spreadsheet",
    ".xlsx": "spreadsheet",
    ".zip": "archive",
    ".rar": "archive",
    ".7z": "archive",
}


def ensure_media_dirs() -> None:
    for sub in ("avatars", "posts"):
        (MEDIA_ROOT / sub).mkdir(parents=True, exist_ok=True)


def save_upload(file: UploadFile, subdir: str, allowed: dict[str, str], max_mb: int) -> tuple[str, str]:
    """Сохраняет файл, возвращает (url, kind)."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Недопустимый тип файла «{ext or '?'}». Разрешено: {', '.join(sorted(allowed))}",
        )
    target_dir = MEDIA_ROOT / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = target_dir / name

    max_bytes = max_mb * 1024 * 1024
    size = 0
    try:
        with dest.open("wb") as out:
            while chunk := file.file.read(CHUNK):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"Файл «{file.filename}» больше {max_mb} МБ",
                    )
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Файл «{file.filename}» пустой")

    return f"{settings.MEDIA_URL}/{subdir}/{name}", allowed[ext]


def delete_media(url: str | None) -> None:
    """Удаляет файл с диска по его URL (только внутри MEDIA_ROOT)."""
    prefix = settings.MEDIA_URL.rstrip("/") + "/"
    if not url or not url.startswith(prefix):
        return
    path = (MEDIA_ROOT / url[len(prefix):]).resolve()
    if MEDIA_ROOT in path.parents:
        path.unlink(missing_ok=True)

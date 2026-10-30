# Шпора — бэкенд (FastAPI + PostgreSQL + Docker)

Веб-приложение, где студенты делятся шпаргалками и конспектами.

## Запуск

```bash
cp .env.example .env      # необязательно, без .env работают значения по умолчанию
docker compose up --build
```

- API: http://localhost:8000/api
- Swagger (документация + проверка запросов): http://localhost:8000/docs
- Загруженные файлы: http://localhost:8000/media/...
- PostgreSQL снаружи контейнера: `localhost:5433`, БД/логин/пароль `shpora`

При первом старте автоматически создаются таблицы, роли, администратор
(`admin@shpora.ru` / `admin12345` — поменяйте в `.env`) и стартовые справочники
(институты, предметы, типы работ, семестры 1–8).

В Swagger нажмите **Authorize**, в поле *username* введите почту, в *password* — пароль.

## Структура

```
spo-shpora/
├── docker-compose.yml
├── .env.example
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── main.py          # создание приложения, CORS, статика /media, старт (create_all + seed)
        ├── config.py        # настройки из переменных окружения
        ├── database.py      # подключение к Postgres (SQLAlchemy 2.0)
        ├── models.py        # таблицы по ER-диаграмме
        ├── schemas.py       # Pydantic-схемы запросов/ответов
        ├── security.py      # bcrypt + JWT
        ├── deps.py          # текущий пользователь, проверка ролей
        ├── files.py         # сохранение файлов и аватарок
        ├── services.py      # поиск постов, статистика, предупреждения/баны
        ├── seed.py          # начальные данные
        ├── migrations.py    # мини-миграции (добавление колонок при старте, без Alembic)
        └── routers/
            ├── auth.py          # регистрация и вход
            ├── posts.py         # лента, поиск, посты, файлы, лайки
            ├── users.py         # профиль
            ├── dictionaries.py  # справочники для фильтров
            ├── moderation.py    # модератор
            └── admin.py         # администратор
```

## Роли

| Роль | Как определяется | Что может |
|---|---|---|
| Гость | запрос без токена | смотреть посты, поиск с фильтрами, справочники |
| Студент | `student` | + создавать/редактировать/удалять свои посты, лайкать, профиль |
| Модератор | `moderator` | + удалять любые посты (с отметкой «нарушает правила» и комментарием), пополнять справочники, выдавать предупреждения |
| Администратор | `admin` | + назначать/снимать модераторов, бан/разбан, просмотр пользователей |

## Эндпоинты (все с префиксом `/api`)

### Регистрация и вход
| Метод | Путь | Описание |
|---|---|---|
| POST | `/auth/register` | `{email, nickname, password, password_confirm}` → токен + профиль |
| POST | `/auth/login` | `{email, password}` → токен + профиль |
| POST | `/auth/token` | то же через форму (для Swagger) |

Токен передаётся в заголовке `Authorization: Bearer <token>`.

### Поиск / лента (кнопка «Поиск»)
`GET /posts` — доступно гостям.

| Параметр | Значение |
|---|---|
| `sort` | `new` (по умолчанию, от новых к старым) или `rating` (по лайкам) |
| `q` | маленькая строка поиска (ищет по описанию, предмету, преподавателю, типу работы, нику и тегам) |
| `institute_id`, `subject_id`, `semester_id`, `work_type_id`, `teacher_id`, `year` | фильтры (комбинируются по «И») |
| `tag` | точный тег (без «#») |
| `limit` | сколько постов загружать (по умолчанию 6) |
| `offset` | сколько уже загружено |

Ответ: `{items, total, limit, offset, has_more}`. Кнопка **«ещё»** — тот же запрос с
`offset = offset + limit`; показывать её, пока `has_more = true`.

Значения для фильтров: `GET /dictionaries` (все справочники одним запросом).

### Посты
| Метод | Путь | Кто | Описание |
|---|---|---|---|
| GET | `/posts/{id}` | все | один пост |
| POST | `/posts` | студент+ | `{comment (до 200), institute_id, subject_id, semester_id, work_type_id, teacher_id?, year?, tags?}` — обязательны институт, предмет, семестр и тип работы; `year` по умолчанию текущий (2000 … следующий год); `tags` — до 10 тегов (без «#», в нижнем регистре, до 30 символов) |
| PATCH | `/posts/{id}` | автор | изменить любые поля |
| DELETE | `/posts/{id}` | автор | удалить свой пост |
| POST | `/posts/{id}/files` | автор | multipart, поле `files` (можно несколько) |
| DELETE | `/posts/{id}/files/{file_id}` | автор | убрать файл |
| POST | `/posts/{id}/like` | студент+ | лайк |
| DELETE | `/posts/{id}/like` | студент+ | убрать лайк |

В каждом посте есть `is_liked` — лайкнул ли его текущий пользователь (у гостя всегда `false`).

### Профиль (кнопка «Профиль»)
| Метод | Путь | Описание |
|---|---|---|
| GET | `/users/me` | ник, аватарка, **total_likes** (сумма лайков под всеми постами), posts_count, warnings_count |
| PATCH | `/users/me` | `{nickname}` |
| POST | `/users/me/avatar` | multipart, поле `file` (jpg/png/webp/gif, до 5 МБ) |
| DELETE | `/users/me/avatar` | удалить аватарку |
| POST | `/users/me/password` | смена пароля |
| GET | `/users/me/posts` | мои посты (с пагинацией) |
| GET | `/users/me/likes` | лайкнутые посты |
| GET | `/users/me/warnings` | мои предупреждения |
| GET | `/users/{id}`, `/users/{id}/posts` | чужой профиль (всем) |

### Модератор
| Метод | Путь | Описание |
|---|---|---|
| POST | `/moderation/posts/{id}/delete` | `{is_violation: bool, comment?}` — удалить пост; при `is_violation=true` автору выдаётся предупреждение |
| POST | `/moderation/users/{id}/warnings` | `{reason}` — выдать предупреждение |
| GET | `/moderation/users/{id}/warnings` | предупреждения пользователя |
| DELETE | `/moderation/warnings/{id}` | отозвать предупреждение |
| POST/PATCH/DELETE | `/dictionaries/{institutes,subjects,semesters,work_types,teachers}` | пополнение справочников |

После `WARNINGS_TO_AUTO_BAN` предупреждений (по умолчанию 3) пользователь банится
автоматически — в таблице `bans` запись с `is_auto = true`.

### Администратор
| Метод | Путь | Описание |
|---|---|---|
| GET | `/admin/users?status=all\|students\|moderators\|admins\|banned&q=` | просмотр пользователей |
| GET | `/admin/users/{id}` | карточка пользователя |
| PATCH | `/admin/users/{id}/role` | `{role: "moderator" \| "student"}` — назначить/снять модератора |
| POST | `/admin/users/{id}/ban` | бан |
| POST | `/admin/users/{id}/unban` | разбан |
| GET | `/admin/users/{id}/bans` | история банов |

## База данных

Таблицы соответствуют ER-диаграмме: `roles, users, bans, warnings, institutes, subjects,
semesters, work_types, teachers, posts, post_files, likes, tags, post_tags`.

`GET /tags?q=&limit=` — теги по убыванию популярности (подсказки при создании поста).
`GET /dictionaries` дополнительно отдаёт `years` — список годов для фильтра.

Проект без Alembic: новые таблицы создаёт `create_all`, а новые колонки в существующих таблицах добавляет
`app/migrations.py` (идемпотентные SQL при каждом старте).

Удалённые посты нигде не хранятся. Если модератор отметил «нарушает правила», его
комментарий сохраняется только в предупреждении автору (`warnings`).

`posts.likes_count` хранится в посте и меняется при лайке/снятии лайка — сортировка по
рейтингу и сумма лайков в профиле считаются быстро.

## Полезные команды

```bash
docker compose logs -f backend                 # логи
docker compose exec db psql -U shpora shpora   # консоль БД
docker compose down -v                         # остановить и удалить данные
```

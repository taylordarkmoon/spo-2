import { API_URL, PAGE_SIZE } from '../config'
import { AUTH_EXPIRED_EVENT, clearToken, getToken } from '../lib/token'
import type {
  AdminUser,
  AdminUserPage,
  BanRecord,
  DictKind,
  Dictionaries,
  ModerationDeleteResult,
  Post,
  PostEdit,
  PostInput,
  PostPage,
  PostQuery,
  TokenOut,
  UserMe,
  UserStatus,
  WarningItem,
  WarningResult,
} from '../types'
import { ApiError } from './errors'

const BASE = `${API_URL}/api`

export interface RegisterData {
  email: string
  nickname: string
  password: string
  password_confirm: string
}

interface Options {
  method?: string
  json?: unknown
  form?: FormData
  query?: Record<string, string | number | undefined>
}

/** Сообщение об ошибке из ответа FastAPI (detail — строка или список ошибок валидации). */
function detailMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d) => String((d as { msg?: string }).msg ?? '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join('. ')
  }
  return `Ошибка сервера (${status})`
}

async function request<T>(path: string, opts: Options = {}, withAuth = true): Promise<T> {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
  }

  const headers: Record<string, string> = {}
  const token = withAuth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    body = opts.form
  }

  let res: Response
  try {
    res = await fetch(url, { method: opts.method ?? 'GET', headers, body })
  } catch {
    throw new ApiError(0, 'Не удалось связаться с сервером. Проверьте, что бэкенд запущен')
  }

  if (res.status === 204) return undefined as T
  const data: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const message = detailMessage(data, res.status)
    const expired = res.status === 401 || (res.status === 403 && message.includes('заблокирован'))
    if (token && expired) {
      // токен недействителен (истёк, пользователь удалён или забанен): выходим из аккаунта
      clearToken()
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
      // публичные запросы повторяем гостем, чтобы лента не ломалась
      const isPublic = !path.startsWith('/users/me') && !path.startsWith('/admin') && !path.startsWith('/moderation')
      if ((opts.method ?? 'GET') === 'GET' && isPublic) {
        return request<T>(path, opts, false)
      }
    }
    throw new ApiError(res.status, message)
  }
  return data as T
}

/** Забирает все страницы списка (лимит бэкенда — 50 на страницу). */
async function fetchAll(path: string): Promise<Post[]> {
  const items: Post[] = []
  for (let offset = 0; offset < 500; offset += 50) {
    const page = await request<PostPage>(path, { query: { limit: 50, offset } })
    items.push(...page.items)
    if (!page.has_more) break
  }
  return items
}

/** Тело запроса справочника: у каждого справочника своё имя поля. */
function dictBody(kind: DictKind, value: string | number) {
  if (kind === 'semesters') return { number: Number(value) }
  if (kind === 'teachers') return { full_name: String(value) }
  return { name: String(value) }
}

function filesForm(files: File[]): FormData {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  return form
}

export const api = {
  // ---------- аккаунт ----------
  register: (data: RegisterData) => request<TokenOut>('/auth/register', { method: 'POST', json: data }, false),
  login: (email: string, password: string) =>
    request<TokenOut>('/auth/login', { method: 'POST', json: { email, password } }, false),
  getMe: () => request<UserMe>('/users/me'),
  getMyWarnings: () => request<WarningItem[]>('/users/me/warnings'),

  async updateMe({ nickname, avatar }: { nickname?: string; avatar?: File | null }) {
    let user: UserMe | null = null
    if (nickname !== undefined) {
      user = await request<UserMe>('/users/me', { method: 'PATCH', json: { nickname } })
    }
    if (avatar) {
      const form = new FormData()
      form.append('file', avatar)
      user = await request<UserMe>('/users/me/avatar', { method: 'POST', form })
    } else if (avatar === null) {
      user = await request<UserMe>('/users/me/avatar', { method: 'DELETE' })
    }
    return user ?? request<UserMe>('/users/me')
  },

  // ---------- справочники и теги ----------
  getDictionaries: () => request<Dictionaries>('/dictionaries'),
  getPopularTags: () => request<string[]>('/tags', { query: { limit: 12 } }),

  // ---------- посты ----------
  getPosts: (q: PostQuery) =>
    request<PostPage>('/posts', {
      query: {
        sort: q.sort,
        q: q.q?.trim() || undefined,
        institute_id: q.institute_id,
        subject_id: q.subject_id,
        semester_id: q.semester_id,
        work_type_id: q.work_type_id,
        teacher_id: q.teacher_id,
        year: q.year,
        limit: q.limit || PAGE_SIZE,
        offset: q.offset,
      },
    }),
  getPost: (id: number) => request<Post>(`/posts/${id}`),
  getMyPosts: () => fetchAll('/users/me/posts'),
  getMyLikes: () => fetchAll('/users/me/likes'),

  async createPost(data: PostInput) {
    const { files, ...fields } = data
    const post = await request<Post>('/posts', { method: 'POST', json: fields })
    if (files.length === 0) return post
    try {
      return await request<Post>(`/posts/${post.id}/files`, { method: 'POST', form: filesForm(files) })
    } catch (e) {
      // не оставляем пост без файлов, если загрузка не удалась
      await request<void>(`/posts/${post.id}`, { method: 'DELETE' }).catch(() => undefined)
      throw e
    }
  },

  async updatePost(id: number, { fields, removeFileIds, newFiles }: PostEdit) {
    let post = await request<Post>(`/posts/${id}`, { method: 'PATCH', json: fields })
    for (const fileId of removeFileIds) {
      await request<void>(`/posts/${id}/files/${fileId}`, { method: 'DELETE' })
    }
    if (newFiles.length) {
      post = await request<Post>(`/posts/${id}/files`, { method: 'POST', form: filesForm(newFiles) })
    } else if (removeFileIds.length) {
      post = await request<Post>(`/posts/${id}`)
    }
    return post
  },

  deletePost: (id: number) => request<void>(`/posts/${id}`, { method: 'DELETE' }),

  setLike: (postId: number, liked: boolean) =>
    request<{ liked: boolean; likes_count: number }>(`/posts/${postId}/like`, { method: liked ? 'POST' : 'DELETE' }),

  // ---------- модерация ----------
  moderatorDeletePost: (id: number, isViolation: boolean, comment: string) =>
    request<ModerationDeleteResult>(`/moderation/posts/${id}/delete`, {
      method: 'POST',
      json: { is_violation: isViolation, comment: comment.trim() || null },
    }),
  warnUser: (userId: number, reason: string) =>
    request<WarningResult>(`/moderation/users/${userId}/warnings`, { method: 'POST', json: { reason } }),
  getUserWarnings: (userId: number) => request<WarningItem[]>(`/moderation/users/${userId}/warnings`),
  revokeWarning: (warningId: number) => request<void>(`/moderation/warnings/${warningId}`, { method: 'DELETE' }),

  addDictItem: (kind: DictKind, value: string | number) =>
    request<unknown>(`/dictionaries/${kind}`, { method: 'POST', json: dictBody(kind, value) }),
  renameDictItem: (kind: DictKind, id: number, value: string | number) =>
    request<unknown>(`/dictionaries/${kind}/${id}`, { method: 'PATCH', json: dictBody(kind, value) }),
  deleteDictItem: (kind: DictKind, id: number) => request<void>(`/dictionaries/${kind}/${id}`, { method: 'DELETE' }),

  // ---------- администрирование ----------
  adminUsers: (q: { status: UserStatus; q?: string; limit: number; offset: number }) =>
    request<AdminUserPage>('/admin/users', { query: { ...q } }),
  adminSetRole: (userId: number, role: 'student' | 'moderator') =>
    request<AdminUser>(`/admin/users/${userId}/role`, { method: 'PATCH', json: { role } }),
  adminBan: (userId: number) => request<AdminUser>(`/admin/users/${userId}/ban`, { method: 'POST' }),
  adminUnban: (userId: number) => request<AdminUser>(`/admin/users/${userId}/unban`, { method: 'POST' }),
  adminBanHistory: (userId: number) => request<BanRecord[]>(`/admin/users/${userId}/bans`),
}

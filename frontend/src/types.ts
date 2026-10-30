// Типы повторяют схемы бэкенда (backend/app/schemas.py).

export type Role = 'student' | 'moderator' | 'admin'

export interface DictItem {
  id: number
  name: string
}
export interface SemesterItem {
  id: number
  number: number
}
export interface TeacherItem {
  id: number
  full_name: string
}

export interface Dictionaries {
  institutes: DictItem[]
  subjects: DictItem[]
  semesters: SemesterItem[]
  work_types: DictItem[]
  teachers: TeacherItem[]
  years: number[]
}

export type DictKind = 'institutes' | 'subjects' | 'semesters' | 'work_types' | 'teachers'

export interface UserShort {
  id: number
  nickname: string
  avatar_url: string | null
}

export interface UserMe extends UserShort {
  email: string
  role: Role
  created_at: string
  total_likes: number
  posts_count: number
  warnings_count: number
}

export interface TokenOut {
  access_token: string
  token_type: string
  user: UserMe
}

export interface PostFile {
  id: number
  file_url: string
  file_kind: string
  // бэкенд хранит файлы под uuid и не отдаёт эти поля — используются, если появятся
  name?: string
  size_bytes?: number
  pages?: number
}

export interface Post {
  id: number
  author: UserShort
  display_nickname: string
  comment: string
  tags: string[]
  institute: DictItem
  subject: DictItem
  semester: SemesterItem
  work_type: DictItem
  teacher: TeacherItem | null
  year: number
  files: PostFile[]
  likes_count: number
  is_liked: boolean
  created_at: string
  updated_at: string
}

export interface PostPage {
  items: Post[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export type SortMode = 'new' | 'rating'

export interface PostFilters {
  institute_id?: number
  subject_id?: number
  semester_id?: number
  work_type_id?: number
  teacher_id?: number
  year?: number
}
export type FilterKey = keyof PostFilters

export interface PostQuery extends PostFilters {
  sort: SortMode
  q?: string
  limit: number
  offset: number
}

/** Поля поста, общие для создания и редактирования. */
export interface PostFields {
  comment: string
  tags: string[]
  year: number
  institute_id: number
  subject_id: number
  semester_id: number
  work_type_id: number
  teacher_id: number | null
}

export interface PostInput extends PostFields {
  files: File[]
}

export interface PostEdit {
  fields: PostFields
  removeFileIds: number[]
  newFiles: File[]
}

// ---------- Модерация и администрирование ----------

export interface WarningItem {
  id: number
  user_id: number
  moderator: UserShort | null
  reason: string
  created_at: string
}

export interface WarningResult {
  warning: WarningItem
  warnings_count: number
  auto_banned: boolean
}

export interface ModerationDeleteResult {
  post_id: number
  is_violation: boolean
  warning_issued: boolean
  warnings_count: number | null
  auto_banned: boolean
}

export type UserStatus = 'all' | 'students' | 'moderators' | 'admins' | 'banned'

export interface AdminUser {
  id: number
  email: string
  nickname: string
  avatar_url: string | null
  role: Role
  is_banned: boolean
  created_at: string
  warnings_count: number
  posts_count: number
}

export interface AdminUserPage {
  items: AdminUser[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface BanRecord {
  id: number
  user_id: number
  banned_by: number | null
  is_auto: boolean
  banned_at: string
  unbanned_at: string | null
}

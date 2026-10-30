import { API_URL } from '../config'
import type { PostFile } from '../types'

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

/** Подпись под постом: «ПДФ · 8 стр. · 1,2 МБ» или «3 фото · 2,1 МБ». */
export function fileSummary(files: PostFile[]): string {
  if (files.length === 0) return 'Без файлов'
  const size = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0)
  const sizePart = size ? formatSize(size) : null
  const first = files[0]

  if (files.every((f) => f.file_kind === 'image')) {
    const label = `${files.length} ${plural(files.length, 'фото', 'фото', 'фото')}`
    return [label, sizePart].filter(Boolean).join(' · ')
  }
  const kind = first.file_kind === 'pdf' ? 'ПДФ' : files.length > 1 ? `${files.length} файла` : 'Файл'
  const pages = first.pages ? `${first.pages} стр.` : null
  return [kind, pages, sizePart].filter(Boolean).join(' · ')
}

export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return /^(https?:|blob:|data:)/.test(url) ? url : `${API_URL}${url}`
}

export function initials(nickname: string): string {
  const parts = nickname.split(/[._\-\s]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : nickname.slice(0, 2)
  return letters.toUpperCase()
}

/** Имя файла для показа и скачивания. Бэкенд хранит файлы под uuid, поэтому без `name` называем по порядку. */
export function fileName(file: PostFile, index = 0): string {
  if (file.name) return file.name
  const ext = file.file_url.split('.').pop()?.toLowerCase()
  const base = file.file_kind === 'image' ? 'Фото' : 'Файл'
  return ext && ext.length <= 5 ? `${base} ${index + 1}.${ext}` : `${base} ${index + 1}`
}

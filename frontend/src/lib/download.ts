import { fileName, mediaUrl } from './format'
import type { PostFile } from '../types'

/**
 * Скачивает файл. Атрибут download не работает для адресов другого origin (бэкенд на другом порту),
 * поэтому сначала забираем файл как blob. Если не вышло — открываем в новой вкладке.
 */
export async function downloadFile(file: PostFile, index = 0): Promise<void> {
  const url = mediaUrl(file.file_url)
  if (!url) return
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const blobUrl = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = fileName(file, index)
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}

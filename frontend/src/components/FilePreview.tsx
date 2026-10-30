import { mediaUrl } from '../lib/format'
import type { PostFile } from '../types'
import styles from './FilePreview.module.css'

const KIND_LABEL: Record<string, string> = {
  pdf: 'PDF',
  document: 'DOC',
  text: 'TXT',
  presentation: 'PPT',
  spreadsheet: 'XLS',
  archive: 'ZIP',
  image: 'ФОТО',
}

interface Props {
  files: PostFile[]
  /** compact — маленькая миниатюра для строк профиля */
  compact?: boolean
}

export function FilePreview({ files, compact }: Props) {
  const first = files[0]
  const src = first?.file_kind === 'image' ? mediaUrl(first.file_url) : undefined

  return (
    <div className={`${styles.preview} ${compact ? styles.compact : ''}`}>
      {src ? (
        <img src={src} alt="" loading="lazy" />
      ) : (
        <div className={styles.paper} aria-hidden="true">
          <span className={styles.kind}>{first ? (KIND_LABEL[first.file_kind] ?? 'ФАЙЛ') : '—'}</span>
          <span className={styles.lines} />
        </div>
      )}
      {!compact && files.length > 1 && <span className={styles.count}>+{files.length - 1}</span>}
    </div>
  )
}

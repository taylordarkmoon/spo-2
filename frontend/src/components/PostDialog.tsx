import { useEffect, useState } from 'react'
import { downloadFile } from '../lib/download'
import { fileName, formatSize, mediaUrl } from '../lib/format'
import type { Post, PostFile } from '../types'
import { Icon } from './Icon'
import styles from './PostDialog.module.css'

interface Props {
  post: Post
  /** с какого файла начать просмотр */
  startIndex?: number
  onClose: () => void
}

function Viewer({ file, index }: { file: PostFile; index: number }) {
  const url = mediaUrl(file.file_url)
  if (!url) return <p className={styles.nopreview}>Файл недоступен</p>

  if (file.file_kind === 'image') return <img className={styles.image} src={url} alt={fileName(file, index)} />
  if (file.file_kind === 'pdf') return <iframe className={styles.frame} src={url} title={fileName(file, index)} />

  return (
    <div className={styles.nopreview}>
      <Icon name="file" size={40} />
      <p>Предпросмотр для этого типа файлов недоступен.</p>
      <p>Скачайте файл, чтобы открыть его.</p>
    </div>
  )
}

/** Окно материала: просмотр файлов, открытие в новой вкладке и скачивание. */
export function PostDialog({ post, startIndex = 0, onClose }: Props) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(post.files.length - 1, 0)))
  const current = post.files[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={post.subject.name}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2>{post.subject.name}</h2>
            <span>
              {post.display_nickname} · {post.subject.name}
            </span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
            <Icon name="close" />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.viewer}>{current ? <Viewer file={current} index={index} /> : <p className={styles.nopreview}>Нет файлов</p>}</div>

          <aside className={styles.side}>
            {post.comment && <p className={styles.comment}>{post.comment}</p>}
            <dl className={styles.details}>
              <dt>Институт</dt>
              <dd>{post.institute.name}</dd>
              <dt>Тип работы</dt>
              <dd>{post.work_type.name}</dd>
              <dt>Семестр, год</dt>
              <dd>
                {post.semester.number} семестр, {post.year}
              </dd>
              {post.teacher && (
                <>
                  <dt>Преподаватель</dt>
                  <dd>{post.teacher.full_name}</dd>
                </>
              )}
            </dl>
            {post.tags.length > 0 && (
              <div className={styles.tagList}>
                {post.tags.map((t) => (
                  <span key={t}>#{t}</span>
                ))}
              </div>
            )}
            <h3>Файлы ({post.files.length})</h3>
            <ul className={styles.files}>
              {post.files.map((f, i) => (
                <li key={f.id} className={`${styles.file} ${i === index ? styles.active : ''}`}>
                  <button type="button" className={styles.pick} onClick={() => setIndex(i)}>
                    <Icon name="file" size={18} />
                    <span className={styles.fileText}>
                      <span className={styles.fileName}>{fileName(f, i)}</span>
                      {f.size_bytes ? <small>{formatSize(f.size_bytes)}</small> : null}
                    </span>
                  </button>
                  <a
                    className={styles.action}
                    href={mediaUrl(f.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Открыть ${fileName(f, i)} в новой вкладке`}
                    title="Открыть в новой вкладке"
                  >
                    <Icon name="external" size={18} />
                  </a>
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => downloadFile(f, i)}
                    aria-label={`Скачать ${fileName(f, i)}`}
                    title="Скачать"
                  >
                    <Icon name="download" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}

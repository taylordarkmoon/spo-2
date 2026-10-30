import { useState } from 'react'
import { fileSummary, formatDateTime } from '../lib/format'
import type { Post } from '../types'
import { Avatar } from './Avatar'
import { FilePreview } from './FilePreview'
import { Icon } from './Icon'
import { PostDialog } from './PostDialog'
import { PostTools } from './PostTools'
import styles from './PostRow.module.css'

interface Props {
  post: Post
  /** подпись под названием: «Вам нравится» / «Ваши лайки» */
  caption: string
  onRemoved: (post: Post) => void
}

/** Компактная строка поста для профиля. */
export function PostRow({ post, caption, onRemoved }: Props) {
  const [open, setOpen] = useState(false)
  const title = post.subject.name

  return (
    <article className={styles.row}>
      <header className={styles.head}>
        <Avatar nickname={post.display_nickname} url={post.author.avatar_url} size={24} />
        <span className={styles.nick}>{post.display_nickname}</span>
        <PostTools post={post} onRemoved={onRemoved} />
        <time className={styles.date} dateTime={post.created_at}>
          {formatDateTime(post.created_at)}
        </time>
      </header>
      <button type="button" className={styles.body} onClick={() => setOpen(true)} aria-label={`Открыть материал: ${title}`}>
        <FilePreview files={post.files} compact />
        <div className={styles.info}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.meta}>
            {post.work_type.name} · {post.semester.number} сем. · {post.year}
          </span>
          <span className={styles.meta}>{fileSummary(post.files)}</span>
          <span className={styles.likes}>
            <Icon name="heart" size={15} filled />
            {post.likes_count} · {caption}
          </span>
        </div>
      </button>
      <button type="button" className={styles.files} onClick={() => setOpen(true)}>
        <Icon name="eye" size={16} />
        Посмотреть
      </button>
      {open && <PostDialog post={post} onClose={() => setOpen(false)} />}
    </article>
  )
}

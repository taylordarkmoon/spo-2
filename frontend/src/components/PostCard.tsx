import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { fileSummary, formatDateTime } from '../lib/format'
import type { Post } from '../types'
import { Avatar } from './Avatar'
import { FilePreview } from './FilePreview'
import { Icon } from './Icon'
import { LikeButton } from './LikeButton'
import { PostDialog } from './PostDialog'
import { PostTools } from './PostTools'
import styles from './PostCard.module.css'

interface Props {
  post: Post
  onLike: (post: Post) => void
  onRemoved: (post: Post) => void
}

export function PostCard({ post, onLike, onRemoved }: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const isOwn = user?.id === post.author.id

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <Avatar nickname={post.display_nickname} url={post.author.avatar_url} />
        <span className={styles.nick}>{post.display_nickname}</span>
        <PostTools post={post} onRemoved={onRemoved} />
        <time className={styles.date} dateTime={post.created_at}>
          {formatDateTime(post.created_at)}
        </time>
      </header>

      <h3 className={styles.title}>{post.subject.name}</h3>
      {post.comment && <p className={styles.comment}>{post.comment}</p>}

      <div className={styles.tags}>
        <span className={styles.type}>{post.work_type.name}</span>
        <span className={styles.meta}>
          {post.semester.number} сем. · {post.year}
        </span>
        {post.tags.map((t) => (
          <span key={t} className={styles.tag}>
            #{t}
          </span>
        ))}
      </div>

      <button type="button" className={styles.previewBtn} onClick={() => setOpen(true)} aria-label="Открыть материал">
        <FilePreview files={post.files} />
      </button>

      <footer className={styles.foot}>
        <div className={styles.file}>
          <span className={styles.fileName}>{post.teacher?.full_name ?? post.institute.name}</span>
          <span className={styles.fileMeta}>{fileSummary(post.files)}</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.openBtn} onClick={() => setOpen(true)}>
            <Icon name="eye" size={16} />
            Посмотреть
          </button>
          <LikeButton
            count={post.likes_count}
            liked={post.is_liked}
            readOnly={isOwn}
            onToggle={() => onLike(post)}
          />
        </div>
      </footer>
      {open && <PostDialog post={post} onClose={() => setOpen(false)} />}
    </article>
  )
}

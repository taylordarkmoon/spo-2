import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import type { Post } from '../types'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'
import { ModerationDialog } from './ModerationDialog'
import styles from './PostTools.module.css'

interface Props {
  post: Post
  /** пост удалён (автором или модератором) — убрать из списка */
  onRemoved: (post: Post) => void
}

/** Кнопки над постом: автору — изменить и удалить, модератору — модерация. Остальным ничего. */
export function PostTools({ post, onRemoved }: Props) {
  const { user } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const [moderate, setModerate] = useState(false)

  if (!user) return null
  const isOwn = user.id === post.author.id
  const canModerate = !isOwn && (user.role === 'moderator' || user.role === 'admin')
  if (!isOwn && !canModerate) return null

  return (
    <div className={styles.tools}>
      {isOwn && (
        <>
          <Link to={`/posts/${post.id}/edit`} className={styles.btn} title="Изменить" aria-label="Изменить пост">
            <Icon name="pencil" size={16} />
          </Link>
          <button
            type="button"
            className={`${styles.btn} ${styles.danger}`}
            title="Удалить"
            aria-label="Удалить пост"
            onClick={() => setConfirm(true)}
          >
            <Icon name="trash" size={16} />
          </button>
        </>
      )}
      {canModerate && (
        <button type="button" className={styles.btn} title="Модерация" aria-label="Модерация поста" onClick={() => setModerate(true)}>
          <Icon name="shield" size={16} />
        </button>
      )}

      {confirm && (
        <ConfirmDialog
          title="Удалить пост?"
          message="Пост и все его файлы будут удалены без возможности восстановления."
          confirmLabel="Удалить"
          danger
          onConfirm={async () => {
            await api.deletePost(post.id)
            onRemoved(post)
          }}
          onClose={() => setConfirm(false)}
        />
      )}
      {moderate && <ModerationDialog post={post} onRemoved={onRemoved} onClose={() => setModerate(false)} />}
    </div>
  )
}

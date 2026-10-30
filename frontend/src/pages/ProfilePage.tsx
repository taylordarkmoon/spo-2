import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { PostRow } from '../components/PostRow'
import { WARNINGS_TO_BAN } from '../config'
import ui from '../components/ui.module.css'
import { formatDateTime } from '../lib/format'
import type { Post, WarningItem } from '../types'
import styles from './ProfilePage.module.css'

const ROLE_LABEL = { student: 'Студент', moderator: 'Модератор', admin: 'Администратор' } as const

export function ProfilePage() {
  const { user, loading, setUser, guestPath } = useAuth()
  const [liked, setLiked] = useState<Post[] | null>(null)
  const [mine, setMine] = useState<Post[] | null>(null)
  const [warnings, setWarnings] = useState<WarningItem[]>([])

  const userId = user?.id
  const warningsCount = user?.warnings_count ?? 0
  useEffect(() => {
    if (userId === undefined) return
    api.getMyLikes().then(setLiked).catch(() => setLiked([]))
    api.getMyPosts().then(setMine).catch(() => setMine([]))
  }, [userId])
  useEffect(() => {
    if (userId === undefined || warningsCount === 0) return
    api.getMyWarnings().then(setWarnings).catch(() => setWarnings([]))
  }, [userId, warningsCount])

  /** Пост удалён: убираем его из обоих списков и обновляем счётчики профиля. */
  const onRemoved = (post: Post) => {
    setLiked((list) => list && list.filter((p) => p.id !== post.id))
    setMine((list) => list && list.filter((p) => p.id !== post.id))
    api.getMe().then(setUser).catch(() => undefined)
  }

  if (loading) return <p className={styles.state}>Загружаем…</p>
  if (!user) return <Navigate to={guestPath} replace />

  return (
    <>
      <header className={styles.top}>
        <Logo />
        <span className={ui.muted}>Мой аккаунт</span>
      </header>

      <div className={styles.layout}>
      <div className={styles.side}>
      <h1 className={styles.heading}>Профиль</h1>
      <section className={styles.card}>
        <div className={styles.who}>
          <Avatar nickname={user.nickname} url={user.avatar_url} size={64} />
          <div>
            <h2 className={styles.nick}>{user.nickname}</h2>
            <p className={ui.muted}>{user.email}</p>
            <p className={styles.role}>{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <Link to="/profile/edit" className={`${ui.btn} ${ui.secondary} ${ui.block} ${ui.small}`}>
          Редактировать профиль <Icon name="pencil" size={16} />
        </Link>
      </section>

      <section className={styles.likes}>
        <div className={styles.total}>
          <strong>{user.total_likes}</strong>
          <span>
            <Icon name="heart" size={13} filled /> лайков
          </span>
        </div>
        <div>
          <h3>На всех моих публикациях</h3>
          <p>Твои знания помогают другим. Так держать!</p>
        </div>
      </section>

      {warnings.length > 0 && (
        <section className={styles.warnings} aria-label="Предупреждения">
          <h3>
            <Icon name="flag" size={16} /> Предупреждения: {warnings.length} из {WARNINGS_TO_BAN}
          </h3>
          <ul>
            {warnings.map((w) => (
              <li key={w.id}>
                <span>{w.reason}</span>
                <time dateTime={w.created_at}>{formatDateTime(w.created_at)}</time>
              </li>
            ))}
          </ul>
          <p>После {WARNINGS_TO_BAN} предупреждений аккаунт блокируется автоматически.</p>
        </section>
      )}
      </div>

      <div className={styles.content}>
        <PostSection title="Понравившееся" posts={liked} caption="Вам нравится" empty="Вы пока ничего не лайкали" onRemoved={onRemoved} />
        <PostSection title="Мои посты" posts={mine} caption="Ваши лайки" empty="Вы пока ничего не выкладывали" onRemoved={onRemoved} />
      </div>
      </div>
    </>
  )
}

const PREVIEW_COUNT = 2

interface SectionProps {
  title: string
  posts: Post[] | null
  caption: string
  empty: string
  onRemoved: (post: Post) => void
}

/** Блок профиля: сначала два поста, остальные по кнопке «Посмотреть все». */
function PostSection({ title, posts, caption, empty, onRemoved }: SectionProps) {
  const [expanded, setExpanded] = useState(false)
  const shown = posts && !expanded ? posts.slice(0, PREVIEW_COUNT) : posts

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        {posts && <span className={styles.badge}>{posts.length}</span>}
      </div>

      <div className={styles.list}>
        {shown?.map((p) => <PostRow key={p.id} post={p} caption={caption} onRemoved={onRemoved} />)}
        {posts?.length === 0 && <p className={ui.muted}>{empty}</p>}
        {posts === null && <p className={ui.muted}>Загружаем…</p>}
      </div>

      {posts && posts.length > PREVIEW_COUNT && (
        <button
          type="button"
          className={`${ui.btn} ${ui.secondary} ${ui.small} ${styles.more}`}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? 'Свернуть' : `Посмотреть все (${posts.length})`}
        </button>
      )}
    </section>
  )
}

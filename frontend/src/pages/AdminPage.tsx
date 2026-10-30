import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { errorMessage } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import ui from '../components/ui.module.css'
import { formatDateTime, plural } from '../lib/format'
import { useDebounced } from '../lib/hooks'
import type { AdminUser, BanRecord, UserStatus, WarningItem } from '../types'
import styles from './ManagePage.module.css'

const PAGE = 20

const STATUSES: { key: UserStatus; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'students', label: 'Студенты' },
  { key: 'moderators', label: 'Модераторы' },
  { key: 'admins', label: 'Админы' },
  { key: 'banned', label: 'Заблокированные' },
]

const ROLE_LABEL = { student: 'Студент', moderator: 'Модератор', admin: 'Администратор' } as const

type Action = { kind: 'role'; role: 'student' | 'moderator' } | { kind: 'ban' } | { kind: 'unban' }

/** Страница администратора: просмотр пользователей, назначение модераторов, бан и разбан. */
export function AdminPage() {
  const { user: me } = useAuth()
  const [status, setStatus] = useState<UserStatus>('all')
  const [query, setQuery] = useState('')
  const q = useDebounced(query)

  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    api
      .adminUsers({ status, q: q.trim() || undefined, limit: PAGE, offset: 0 })
      .then((page) => {
        if (stale) return
        setItems(page.items)
        setTotal(page.total)
        setHasMore(page.has_more)
      })
      .catch((e) => !stale && setError(errorMessage(e)))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [status, q])

  const loadMore = () =>
    api
      .adminUsers({ status, q: q.trim() || undefined, limit: PAGE, offset: items.length })
      .then((page) => {
        setItems((prev) => [...prev, ...page.items])
        setTotal(page.total)
        setHasMore(page.has_more)
      })
      .catch((e) => setError(errorMessage(e)))

  const replace = useCallback(
    (updated: AdminUser) => {
      setItems((prev) => {
        // после смены роли или бана пользователь может перестать подходить под текущий фильтр
        const fits =
          status === 'all' ||
          (status === 'banned' && updated.is_banned) ||
          (status === 'students' && updated.role === 'student') ||
          (status === 'moderators' && updated.role === 'moderator') ||
          (status === 'admins' && updated.role === 'admin')
        return prev.flatMap((u) => (u.id !== updated.id ? [u] : fits ? [updated] : []))
      })
    },
    [status],
  )

  return (
    <>
      <header className={styles.head}>
        <h1>Пользователи</h1>
        <p>Назначайте модераторов, блокируйте и разблокируйте пользователей. Администраторов менять нельзя.</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Фильтр пользователей">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={status === s.key}
              className={`${styles.tab} ${status === s.key ? styles.tabActive : ''}`}
              onClick={() => setStatus(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          className={styles.input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по нику или почте"
          aria-label="Поиск пользователей"
        />
      </div>

      <p className={styles.count}>
        {loading ? ' ' : `${total} ${plural(total, 'пользователь', 'пользователя', 'пользователей')}`}
      </p>

      {error && <p className={ui.error}>{error}</p>}

      <div className={styles.users}>
        {items.map((u) => (
          <UserCard key={u.id} user={u} isMe={u.id === me?.id} onChanged={replace} />
        ))}
      </div>
      {!loading && items.length === 0 && !error && <p className={ui.muted}>Никого не найдено.</p>}
      {hasMore && (
        <button type="button" className={`${ui.btn} ${ui.secondary} ${ui.small} ${styles.more}`} onClick={loadMore}>
          Показать ещё
        </button>
      )}
    </>
  )
}

function UserCard({ user, isMe, onChanged }: { user: AdminUser; isMe: boolean; onChanged: (u: AdminUser) => void }) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<Action | null>(null)
  const [warnings, setWarnings] = useState<WarningItem[] | null>(null)
  const [bans, setBans] = useState<BanRecord[] | null>(null)

  const editable = user.role !== 'admin' && !isMe

  const toggleDetails = () => {
    const next = !open
    setOpen(next)
    if (next) {
      api.getUserWarnings(user.id).then(setWarnings).catch(() => setWarnings([]))
      api.adminBanHistory(user.id).then(setBans).catch(() => setBans([]))
    }
  }

  const revoke = async (w: WarningItem) => {
    await api.revokeWarning(w.id)
    setWarnings((list) => list && list.filter((x) => x.id !== w.id))
    onChanged({ ...user, warnings_count: Math.max(0, user.warnings_count - 1) })
  }

  const confirmText = {
    role: (r: 'student' | 'moderator') =>
      r === 'moderator'
        ? { title: 'Назначить модератором?', text: `${user.nickname} сможет удалять любые посты, выдавать предупреждения и пополнять справочники.`, label: 'Назначить' }
        : { title: 'Снять с модераторов?', text: `${user.nickname} снова станет обычным студентом.`, label: 'Снять' },
    ban: { title: 'Заблокировать?', text: `${user.nickname} не сможет войти, а его действующая сессия перестанет работать.`, label: 'Заблокировать' },
    unban: { title: 'Разблокировать?', text: `${user.nickname} снова сможет пользоваться сервисом. Счётчик предупреждений для автобана начнётся заново.`, label: 'Разблокировать' },
  }

  const dialog = action && (action.kind === 'role' ? confirmText.role(action.role) : confirmText[action.kind])

  const run = async () => {
    if (!action) return
    const updated =
      action.kind === 'role'
        ? await api.adminSetRole(user.id, action.role)
        : action.kind === 'ban'
          ? await api.adminBan(user.id)
          : await api.adminUnban(user.id)
    onChanged(updated)
  }

  return (
    <article className={`${styles.user} ${user.is_banned ? styles.banned : ''}`}>
      <div className={styles.userMain}>
        <Avatar nickname={user.nickname} url={user.avatar_url} size={44} />
        <div className={styles.userInfo}>
          <div className={styles.userName}>
            <strong>{user.nickname}</strong>
            <span className={`${styles.badge} ${user.role !== 'student' ? styles.badgeRole : ''}`}>{ROLE_LABEL[user.role]}</span>
            {user.is_banned && <span className={`${styles.badge} ${styles.badgeBan}`}>Заблокирован</span>}
            {isMe && <span className={styles.badge}>Это вы</span>}
          </div>
          <span className={styles.email}>{user.email}</span>
          <span className={styles.stats}>
            {user.posts_count} {plural(user.posts_count, 'пост', 'поста', 'постов')} · {user.warnings_count}{' '}
            {plural(user.warnings_count, 'предупреждение', 'предупреждения', 'предупреждений')} · с {formatDateTime(user.created_at).split(' · ')[0]}
          </span>
        </div>
      </div>

      <div className={styles.actions}>
        {editable && (
          <>
            {user.role === 'student' ? (
              <button type="button" className={`${ui.btn} ${ui.secondary} ${ui.small}`} onClick={() => setAction({ kind: 'role', role: 'moderator' })}>
                Назначить модератором
              </button>
            ) : (
              <button type="button" className={`${ui.btn} ${ui.secondary} ${ui.small}`} onClick={() => setAction({ kind: 'role', role: 'student' })}>
                Снять с модераторов
              </button>
            )}
            {user.is_banned ? (
              <button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => setAction({ kind: 'unban' })}>
                Разблокировать
              </button>
            ) : (
              <button type="button" className={`${ui.btn} ${ui.danger} ${ui.small}`} onClick={() => setAction({ kind: 'ban' })}>
                Заблокировать
              </button>
            )}
          </>
        )}
        <button type="button" className={styles.link} onClick={toggleDetails} aria-expanded={open}>
          {open ? 'Скрыть детали' : 'Подробнее'}
        </button>
      </div>

      {open && (
        <div className={styles.details}>
          <div>
            <h3>Предупреждения</h3>
            {warnings === null && <p className={ui.muted}>Загружаем…</p>}
            {warnings?.length === 0 && <p className={ui.muted}>Предупреждений нет</p>}
            <ul>
              {warnings?.map((w) => (
                <li key={w.id}>
                  <span>{w.reason}</span>
                  <small>
                    {formatDateTime(w.created_at)} · {w.moderator ? w.moderator.nickname : 'модератор удалён'}
                  </small>
                  <button type="button" className={styles.link} onClick={() => revoke(w).catch(() => undefined)}>
                    Отозвать
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>История блокировок</h3>
            {bans === null && <p className={ui.muted}>Загружаем…</p>}
            {bans?.length === 0 && <p className={ui.muted}>Блокировок не было</p>}
            <ul>
              {bans?.map((b) => (
                <li key={b.id}>
                  <span>
                    {b.is_auto ? 'Автоматически (3 предупреждения)' : 'Администратором'}
                    {b.unbanned_at ? '' : ' — действует'}
                  </span>
                  <small>
                    с {formatDateTime(b.banned_at)}
                    {b.unbanned_at ? ` по ${formatDateTime(b.unbanned_at)}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {action && dialog && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.text}
          confirmLabel={dialog.label}
          danger={action.kind === 'ban'}
          onConfirm={run}
          onClose={() => setAction(null)}
        />
      )}
    </article>
  )
}

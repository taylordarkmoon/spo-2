import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import styles from './AccountMenu.module.css'

const ROLE_LABEL = { student: 'Студент', moderator: 'Модератор', admin: 'Администратор' } as const

/** Аватарка в шапке: по клику открывает меню «Профиль» / «Выйти из аккаунта». */
export function AccountMenu() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Меню аккаунта"
      >
        <Avatar nickname={user.nickname} url={user.avatar_url} size={40} />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.who}>
            <strong>{user.nickname}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <Link to="/profile" className={styles.item} role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="user" size={18} />
            Профиль
          </Link>
          <button
            type="button"
            className={`${styles.item} ${styles.danger}`}
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
            }}
          >
            <Icon name="logout" size={18} />
            Выйти из аккаунта
          </button>
        </div>
      )}
    </div>
  )
}

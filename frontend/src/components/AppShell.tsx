import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../types'
import { AccountMenu } from './AccountMenu'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import { Logo } from './Logo'
import ui from './ui.module.css'
import styles from './AppShell.module.css'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
}

/** Пункты меню зависят от роли: модератору добавляется «Модерация», администратору ещё и «Пользователи». */
function navItems(role: Role | undefined): NavItem[] {
  const items: NavItem[] = [
    { to: '/', label: 'Лента', icon: 'layers', end: true },
    { to: '/profile', label: 'Профиль', icon: 'user' },
  ]
  if (role === 'moderator' || role === 'admin') items.push({ to: '/moderation', label: 'Модерация', icon: 'shield' })
  if (role === 'admin') items.push({ to: '/admin', label: 'Пользователи', icon: 'users' })
  return items
}

const linkClass = ({ isActive }: { isActive: boolean }) => `${styles.link} ${isActive ? styles.linkActive : ''}`

/** Шапка для компьютера: логотип, навигация, действия. На телефоне скрыта. */
function SiteHeader() {
  const { user } = useAuth()

  return (
    <header className={styles.siteHeader}>
      <Logo />
      <nav className={styles.links} aria-label="Основная навигация">
        {navItems(user?.role).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.actions}>
        {user ? (
          <>
            <Link to="/posts/new" className={`${ui.btn} ${ui.small}`}>
              <Icon name="plus" size={18} />
              Выложить
            </Link>
            <AccountMenu />
          </>
        ) : (
          <>
            <Link to="/login" className={`${ui.btn} ${ui.secondary} ${ui.small}`}>
              Войти
            </Link>
            <Link to="/register" className={`${ui.btn} ${ui.small}`}>
              Регистрация
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

/** Каркас для основных экранов: на телефоне нижняя навигация, на компьютере шапка. */
export function AppShell() {
  const { user } = useAuth()
  const items = navItems(user?.role)

  return (
    <div className={styles.shell}>
      <SiteHeader />
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav className={styles.nav} aria-label="Основная навигация" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.icon}>
              <Icon name={item.icon} />
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Каркас без навигации (вход, регистрация, формы). */
export function PlainShell() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

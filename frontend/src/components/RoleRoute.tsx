import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../types'

/** Пускает на страницы только указанные роли; гостя отправляет на вход, остальных на главную. */
export function RoleRoute({ roles }: { roles: Role[] }) {
  const { user, loading, guestPath } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to={guestPath} replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}

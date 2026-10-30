import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api'
import type { RegisterData } from '../api'
import { AUTH_EXPIRED_EVENT, clearToken, getRefreshToken, getToken, setTokens } from '../lib/token'
import type { TokenOut, UserMe } from '../types'

interface AuthValue {
  user: UserMe | null
  /** true, пока проверяем сохранённый токен при старте */
  loading: boolean
  login(email: string, password: string): Promise<void>
  register(data: RegisterData): Promise<void>
  logout(): void
  setUser(user: UserMe): void
  /** куда отправлять гостя со страницы, закрытой для неавторизованных: на ленту после выхода, иначе на вход */
  guestPath: string
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null || getRefreshToken() !== null)
  const [loggedOut, setLoggedOut] = useState(false)

  useEffect(() => {
    if (!getToken() && !getRefreshToken()) return
    api
      .getMe()
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [])

  const accept = useCallback((res: TokenOut) => {
    setTokens(res.access_token, res.refresh_token)
    setLoggedOut(false)
    setUser(res.user)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => accept(await api.login(email, password)),
      register: async (data) => accept(await api.register(data)),
      logout: () => {
        const refreshToken = getRefreshToken()
        // сессию на сервере закрываем в фоне: выйти локально можно и без сети
        if (refreshToken) api.logout(refreshToken).catch(() => undefined)
        clearToken()
        setLoggedOut(true)
        setUser(null)
      },
      setUser,
      guestPath: loggedOut ? '/' : '/login',
    }),
    [user, loading, loggedOut, accept],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}

const KEY = 'token'

export const AUTH_EXPIRED_EVENT = 'auth:expired'

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // хранилище недоступно — сессия не переживёт перезагрузку
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ничего
  }
}

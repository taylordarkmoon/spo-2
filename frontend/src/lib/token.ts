const KEY = 'token'
const REFRESH_KEY = 'refresh_token'

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

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

/** Сохраняет пару токенов после входа, регистрации или обновления. */
export function setTokens(access: string, refresh: string): void {
  setToken(access)
  try {
    localStorage.setItem(REFRESH_KEY, refresh)
  } catch {
    // хранилище недоступно
  }
}

/** Удаляет оба токена (выход из аккаунта). */
export function clearToken(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(REFRESH_KEY)
  } catch {
    // ничего
  }
}

// Название приложения — меняется в одном месте
export const APP_NAME = 'ShporaMIREA'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const PAGE_SIZE = 5
export const COMMENT_MAX = 200
export const WARNINGS_TO_BAN = 3

// false — фильтры комбинируются (И); true — одновременно активен только один
export const SINGLE_FILTER = false

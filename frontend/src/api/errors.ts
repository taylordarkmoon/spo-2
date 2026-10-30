export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Что-то пошло не так. Попробуйте ещё раз'
}

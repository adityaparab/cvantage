export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
let csrfToken = ''
export function setCsrfToken(token: string) { csrfToken = token }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CVantage', 'X-CSRF-Token': csrfToken, ...options.headers },
  })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : 'The request failed. Please try again.'
    throw new ApiError(response.status, message)
  }
  return response.json() as Promise<T>
}

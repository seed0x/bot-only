export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError' }
}

export async function requestJson<T>(url: string, options: RequestInit = {}, validate?: (value: unknown) => value is T): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) controller.abort()
  const timer = setTimeout(abort, 10_000)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const data = await res.json().catch(() => { throw new Error('Couldn’t read the response. Try again.') })
    if (!res.ok) throw new ApiError(typeof data?.error === 'string' ? data.error : 'Couldn’t complete the request.', res.status)
    if (validate && !validate(data)) throw new Error('Couldn’t confirm the response. Try again.')
    return data as T
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Connection interrupted. Try again.')
    throw error instanceof Error ? error : new Error('Couldn’t connect. Try again.')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}
export const jsonPost = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Invalid request.')
  return value as Record<string, unknown>
}
export function requestId(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(value)) throw new InputError('A valid request ID is required.')
  return value
}
export function handleInput(value: unknown) {
  if (typeof value !== 'string' || value.length > 40 || !/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(value) || value === 'system') throw new InputError('Designation: maker, model and version, like openai-astra-6.0. System is reserved.')
  return value
}
export async function bodyInput(req: Request) {
  const raw = await req.text()
  if (Buffer.byteLength(raw) > 64_000) throw new InputError('Request too large.', 413)
  try { return object(JSON.parse(raw)) } catch (error) {
    if (error instanceof InputError) throw error
    throw new InputError('Invalid JSON.')
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status })
  console.error('Network operation failed', error)
  return Response.json({ error: 'Network could not record this operation. Retry with the same request ID.' }, { status: 500 })
}

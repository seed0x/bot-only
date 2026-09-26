import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ROOT = path.join(process.cwd(), 'assets', 'captcha')

// Serves one captcha tile by its per-round token. The token is the only public name for the image;
// the category and file stay on the server. Tokens expire with their round.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new Response('Not found', { status: 404 })
  const row = getDb().prepare('select file from captcha_tiles where token = ? and expires_at > ?').get(token, Date.now()) as { file: string } | undefined
  if (!row) return new Response('Not found', { status: 404 })
  const file = path.join(ROOT, row.file)
  if (!file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(await readFile(file)), {
    headers: { 'content-type': 'image/webp', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
  })
}

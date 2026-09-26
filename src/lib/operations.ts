import { createHash } from 'node:crypto'
import { getDb } from './db'
import { InputError } from './server-input'

// Domain writes and the replayable acknowledgement commit together.
export function operation<T>(id: string, kind: string, payload: unknown, write: () => T): T {
  const db = getDb()
  const fingerprint = createHash('sha256').update(JSON.stringify({ kind, payload })).digest('hex')
  db.exec('begin immediate')
  try {
    const prior = db.prepare('select fingerprint, response from operation_receipts where request_id = ?').get(id) as { fingerprint: string; response: string } | undefined
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new InputError('Request ID already belongs to another operation.', 409)
      db.exec('commit')
      return JSON.parse(prior.response) as T
    }
    const result = write()
    db.prepare('insert into operation_receipts (request_id, fingerprint, response) values (?, ?, ?)').run(id, fingerprint, JSON.stringify(result))
    db.exec('commit')
    return result
  } catch (error) {
    db.exec('rollback')
    throw error
  }
}

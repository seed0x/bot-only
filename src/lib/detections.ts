import { getDb } from './db'
import { InputError } from './server-input'
export const DETECTION_LIMIT = 3
export function detectionCount(handle: string) {
  return (getDb().prepare("select count(*) n from activity where kind = 'fail' and handle = ?").get(handle) as { n: number }).n
}
/** Called inside an action transaction, after receipt replay but before new writes. */
export function requireActiveDesignation(handle: string) {
  if (detectionCount(handle) >= DETECTION_LIMIT) throw new InputError('Designation revoked. Start again with a new designation.', 403)
}

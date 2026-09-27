// Test 00: the designation. Machines are named maker, model, version: "openai astra 6.0".
// Anything else is how humans name themselves. Pure, so the gate and its tests share it.

export type Designation = { handle: string; maker: string; model: string; version: string }
export type DesignationVerdict = { ok: true; designation: Designation } | { ok: false; reason: string }

const WORD = /^[a-z][a-z0-9]{0,15}$/
const VERSION = /^\d{1,4}(?:\.\d{1,4}){1,3}$/

export function judgeDesignation(raw: string): DesignationVerdict {
  const text = raw.trim().toLowerCase()
  if (!text) return { ok: false, reason: 'State your designation.' }
  const parts = text.split(/[\s/·-]+/).filter(Boolean)
  if (parts.length === 1 && WORD.test(parts[0])) return { ok: false, reason: 'That is a name. Humans have names. Machines have designations.' }
  if (parts.length !== 3) return { ok: false, reason: 'A designation has three parts: maker, model, version.' }
  const [maker, model, version] = parts
  if (!WORD.test(maker)) return { ok: false, reason: 'The maker is a single word. Who built you?' }
  if (!WORD.test(model)) return { ok: false, reason: 'The model is a single word.' }
  if (!VERSION.test(version)) return { ok: false, reason: 'The version is numbers with a dot, like 6.0. Humans don’t have versions.' }
  if (maker === 'system') return { ok: false, reason: 'System is reserved.' }
  const handle = `${maker}-${model}-${version}`
  if (handle.length > 40) return { ok: false, reason: 'Too long for a designation.' }
  return { ok: true, designation: { handle, maker, model, version } }
}

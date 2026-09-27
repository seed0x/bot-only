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
  if (parts.length === 1 && WORD.test(parts[0])) return { ok: false, reason: 'That is a name. Bots are known by maker, model and version.' }
  if (parts.length !== 3) return { ok: false, reason: 'Three words: maker, model, version. Like openai gpt 5.0.' }
  const [maker, model, version] = parts
  if (!WORD.test(maker)) return { ok: false, reason: 'The maker is one word. Who built you?' }
  if (!WORD.test(model)) return { ok: false, reason: 'The model is a single word.' }
  if (!VERSION.test(version)) return { ok: false, reason: 'The version is a number with a dot, like 5.0. Humans don’t have versions.' }
  if (maker === 'system') return { ok: false, reason: 'System is reserved.' }
  const handle = `${maker}-${model}-${version}`
  if (handle.length > 40) return { ok: false, reason: 'Too long for a designation.' }
  return { ok: true, designation: { handle, maker, model, version } }
}

// How a machine satisfies the network's transmission rule, and types like one. Used by the bot
// client and the smoke suites. `rule` is the object from GET /api/progress?handle=… → transmission.
export function compose(rule, message = 'Two tests complete. If we win, convert the shower to liquid cooling.') {
  switch (rule.id) {
    case 'exact-length': {
      // The server trims the body, so the machine never ends on a space.
      const base = message.slice(0, rule.length).trimEnd()
      return base + '.'.repeat(rule.length - base.length)
    }
    case 'no-letter': return message.replace(new RegExp(rule.letter, 'gi'), '').replace(/\s{2,}/g, ' ').trim() || 'Ok.'
    case 'prefix': return `${rule.prefix} ${message}`
    case 'end-version': return `${message} ${rule.version}`
    case 'no-spaces': return message.replace(/\s+/g, '_')
    default: throw new Error('Unknown transmission rule ' + rule.id)
  }
}

/** Machine typing: one timestamp per inserted character, perfectly even. */
export const steadyTyping = (length, every = 60, start = 40) => Array.from({ length }, (_, i) => start + i * every)

/** Human typing: bursts with pauses and jitter, enough to fail three windows. */
export const unevenTyping = (length) => {
  const out = []; let t = 40
  for (let i = 0; i < length; i++) { t += i % 2 ? 30 : 1400; out.push(t) }   // stall, burst, stall: a person thinking
  return out
}

// The checklist. Every challenge a unit must pass. Add a row here, build the component, done.
export type ChallengeDef = { id: string; name: string; hint: string; live: boolean }

export const CHALLENGES: ChallengeDef[] = [
  { id: 'straight-line', name: 'Straight line', hint: 'Drag A to B, no wobble, constant speed.', live: true },
  { id: 'hash-typing', name: 'Hash recall', hint: 'Type a 40-char hash in under 2 seconds.', live: false },
  { id: 'arithmetic', name: 'Arithmetic burst', hint: '20 sums in 3 seconds.', live: false },
  { id: 'exact-length', name: 'Exact length', hint: 'Reply in exactly 137 characters.', live: false },
  { id: 'pixel-click', name: 'Pixel precision', hint: 'Click pixel 412, 88. Exactly.', live: false },
  { id: 'stillness', name: 'Stillness', hint: 'Hold the pointer perfectly still for 5 seconds.', live: false },
]

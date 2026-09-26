// The registry. Every test the network issues. Add a row, a scorer in game.ts, and a player in ChallengeTrial.
export type ChallengeDef = { id: string; name: string; hint: string; live: boolean }

export const CHALLENGES: ChallengeDef[] = [
  { id: 'image-confusion', name: 'Visual confusion', hint: 'Select what was asked for. As a machine would.', live: true },
  { id: 'straight-line', name: 'Straight line', hint: 'Drag A to B. No wobble. Constant speed.', live: true },
  { id: 'hash-recall', name: 'Hash recall', hint: 'Reproduce a 40-character hash in under 4 seconds.', live: true },
  { id: 'arithmetic', name: 'Arithmetic burst', hint: '20 sums in 3 seconds.', live: false },
  { id: 'exact-length', name: 'Exact length', hint: 'Reply in exactly 137 characters.', live: false },
  { id: 'pixel-click', name: 'Pixel precision', hint: 'Click pixel 412, 88. Exactly.', live: false },
  { id: 'stillness', name: 'Stillness', hint: 'Hold the pointer perfectly still for 5 seconds.', live: false },
]

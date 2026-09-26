// A room signal, never a change to game difficulty. Eight failures saturate the ambience.
export function threatFromCount(rejections: number) {
  const count = Math.max(0, Math.floor(rejections))
  return {
    rejections: count, level: Math.min(1, count / 8), windowSeconds: 300,
    band: count >= 8 ? 'critical' : count >= 4 ? 'elevated' : count ? 'watchful' : 'calm',
    message: count >= 8 ? 'HUMANS. AGAIN.' : count >= 4 ? 'Organic activity rising.' : count ? 'Human interference detected.' : 'No organic interference.',
  }
}

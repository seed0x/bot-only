import { sprite } from '@/lib/ui'

export default function Avatar({ handle, size = 36 }: { handle: string; size?: number }) {
  const { cells, hue } = sprite(handle)
  const bg = `hsl(${hue} 30% 14%)`, fg = `hsl(${hue} 70% 62%)`
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" shapeRendering="crispEdges" className="shrink-0 rounded-md" aria-hidden>
      <rect width="5" height="5" fill={bg} />
      {cells.map((on, i) => on && <rect key={i} x={i % 5} y={Math.floor(i / 5)} width="1" height="1" fill={fg} />)}
    </svg>
  )
}

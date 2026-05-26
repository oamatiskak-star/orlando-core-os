import clsx from 'clsx'

export function Sparkline({
  values, width = 80, height = 22, stroke = 'currentColor', fill = true,
  className,
}: {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: boolean
  className?: string
}) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} className={clsx('opacity-30', className)} aria-hidden>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={stroke} strokeWidth={1} strokeDasharray="2 3" />
      </svg>
    )
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1)
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / span) * height}`)
    .join(' ')
  const areaPath = `M0,${height} L${points.replace(/ /g, ' L')} L${width},${height} Z`
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      {fill ? <path d={areaPath} fill={stroke} opacity={0.12} /> : null}
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

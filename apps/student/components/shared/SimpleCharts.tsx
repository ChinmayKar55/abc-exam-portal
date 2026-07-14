"use client"

interface LineChartProps {
  data: { label: string; value: number }[]
  color?: string
  height?: number
  max?: number
}

export function LineChart({ data, color = "var(--primary)", height = 160, max }: LineChartProps) {
  if (data.length === 0) return null
  const values = data.map((d) => d.value)
  const chartMax = max ?? Math.max(...values, 1)
  const chartMin = Math.min(...values, 0)
  const range = chartMax - chartMin || 1
  const padding = 24
  const width = 100
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * innerWidth
    const y = padding + innerHeight - ((d.value - chartMin) / range) * innerHeight
    return `${x},${y}`
  }).join(" ")

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 1, 2, 3].map((i) => {
        const y = padding + (i / 3) * innerHeight
        return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border)" strokeWidth="0.2" />
      })}
      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#lineGradient)" />
      {/* Line */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* Dots */}
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * innerWidth
        const y = padding + innerHeight - ((d.value - chartMin) / range) * innerHeight
        return <circle key={i} cx={x} cy={y} r="1.5" fill={color} />
      })}
    </svg>
  )
}

interface BarChartProps {
  data: { label: string; value: number }[]
  color?: string
  height?: number
  max?: number
}

export function BarChart({ data, color = "var(--primary)", height = 160, max }: BarChartProps) {
  if (data.length === 0) return null
  const values = data.map((d) => d.value)
  const chartMax = max ?? Math.max(...values, 1)
  const padding = 24
  const width = 100
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const barWidth = (innerWidth / data.length) * 0.6
  const gap = (innerWidth / data.length) * 0.4

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      {/* Grid lines */}
      {[0, 1, 2, 3].map((i) => {
        const y = padding + (i / 3) * innerHeight
        return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border)" strokeWidth="0.2" />
      })}
      {data.map((d, i) => {
        const barHeight = (d.value / chartMax) * innerHeight
        const x = padding + i * (barWidth + gap) + gap / 2
        const y = padding + innerHeight - barHeight
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx="1"
            fill={color}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}

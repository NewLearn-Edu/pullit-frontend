interface StatCardProps {
  label: string
  value: string
  /** value 색 강조 (예: 검수 대기 → primary) */
  valueColor?: string
  delta: string
  tone: 'up' | 'good' | 'flat'
}

export function StatCard({ label, value, valueColor, delta, tone }: StatCardProps) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value num" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <span className={`delta ${tone}`}>{delta}</span>
    </div>
  )
}

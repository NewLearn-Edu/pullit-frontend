interface StatCardProps {
  label: string
  value: string
  /** value 색 강조 (예: 검수 대기 → primary) */
  valueColor?: string
  delta: string
  /** up = 상승(빨강) · down = 하락(파랑) · good = 긍정 상태(초록) · flat = 중립 */
  tone: 'up' | 'down' | 'good' | 'flat'
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

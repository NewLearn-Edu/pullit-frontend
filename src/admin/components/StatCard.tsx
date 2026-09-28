import type { KeyboardEvent } from 'react'

interface StatCardProps {
  label: string
  value: string
  /** value 색 강조 (예: 검수 대기 → primary) */
  valueColor?: string
  delta: string
  /** up = 상승(빨강) · down = 하락(파랑) · good = 긍정 상태(초록) · flat = 중립 */
  tone: 'up' | 'down' | 'good' | 'flat'
  /**
   * 누르면 상세가 열리는 카드 (2026-09-28 · 리텐션 KPI). 없으면 표시 전용 — 문제 섹션 KPI 3카드는 표시 전용을 유지한다.
   * 시각 규격은 그대로 두고 커서·hover 만 붙는다 (.stat.stat-drill)
   */
  onOpen?: () => void
}

export function StatCard({ label, value, valueColor, delta, tone, onOpen }: StatCardProps) {
  return (
    <div
      className={onOpen ? 'card stat stat-drill' : 'card stat'}
      {...(onOpen
        ? {
            onClick: onOpen,
            role: 'button' as const,
            tabIndex: 0,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen()
              }
            },
          }
        : {})}
    >
      <div className="label">{label}</div>
      <div className="value num" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      <span className={`delta ${tone}`}>{delta}</span>
    </div>
  )
}

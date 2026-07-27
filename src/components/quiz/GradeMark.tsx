import { clsx } from 'clsx'

interface GradeMarkProps {
  type: 'correct' | 'wrong'
  /** 대상 텍스트를 감쌀 크기 지정 (px). 기본 80×40 */
  width?: number
  height?: number
}

/**
 * 문제 헤더 위에 빨간 색연필로 채점한 듯한 마크 오버레이.
 * - correct: ○ (원)
 * - wrong: / (사선)
 * stroke-dashoffset 애니메이션으로 손으로 그어지는 듯한 draw-on 효과.
 */
export function GradeMark({ type, width = 80, height = 40 }: GradeMarkProps) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width, height }}
    >
      <svg
        viewBox="0 0 80 40"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        {type === 'correct' ? (
          <ellipse
            cx="40"
            cy="20"
            rx="34"
            ry="16"
            fill="none"
            stroke="#DC2626"
            strokeWidth="2.4"
            strokeLinecap="round"
            className={clsx('grade-mark-draw')}
            style={{ strokeDasharray: 180, strokeDashoffset: 180 }}
          />
        ) : (
          <line
            x1="6"
            y1="34"
            x2="74"
            y2="6"
            stroke="#DC2626"
            strokeWidth="2.6"
            strokeLinecap="round"
            className={clsx('grade-mark-draw')}
            style={{ strokeDasharray: 90, strokeDashoffset: 90 }}
          />
        )}
      </svg>
    </span>
  )
}

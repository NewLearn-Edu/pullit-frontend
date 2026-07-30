import { clsx } from 'clsx'
import styles from './styles/GradeMark.module.scss'

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
 * stroke-dashoffset 애니메이션으로 손으로 그어지는 듯한 draw-on 효과 (globals.css).
 */
export function GradeMark({ type, width = 80, height = 40 }: GradeMarkProps) {
  return (
    <span aria-hidden className={styles.wrap} style={{ width, height }}>
      <svg viewBox="0 0 80 40" preserveAspectRatio="none" className={styles.svg}>
        {type === 'correct' ? (
          <ellipse
            cx="40"
            cy="20"
            rx="34"
            ry="16"
            className={clsx(styles.stroke, styles.strokeCircle, 'grade-mark-draw')}
          />
        ) : (
          <line
            x1="6"
            y1="34"
            x2="74"
            y2="6"
            className={clsx(styles.stroke, styles.strokeSlash, 'grade-mark-draw')}
          />
        )}
      </svg>
    </span>
  )
}

import { clsx } from 'clsx'
import { formatTime } from '@/user/utils/scoring'
import styles from './styles/TimerBadge.module.scss'

interface TimerBadgeProps {
  /** 경과 시간 (초) · 0:00 부터 count-up */
  elapsedSec: number
  /** 권장 시간 (초) · 이하 = ok 초록 */
  tRecSec: number
  /** 제한 시간 (초) · 이하 = warn 노랑, 초과 = over 빨강 */
  tMaxSec: number
  /** 다크 배경 위 = 밝은 톤 · 라이트 배경 위 = 어두운 톤 */
  variant?: 'onDark' | 'onLight'
}

/**
 * 시간 배지 · 경과 시간 count-up + 상태 dot.
 * phase 색상: ok(초록) → warn(노랑) → over(빨강) · 사용자에게 시간 압박 인지시킴.
 */
export function TimerBadge({
  elapsedSec,
  tRecSec,
  tMaxSec,
  variant = 'onDark',
}: TimerBadgeProps) {
  const phase: 'ok' | 'warn' | 'over' =
    elapsedSec <= tRecSec ? 'ok' : elapsedSec <= tMaxSec ? 'warn' : 'over'

  // Phase → dot 색 · text 색 SCSS 클래스 매핑
  const dotClass = {
    ok: styles.dotOk,
    warn: styles.dotWarn,
    over: styles.dotOver,
  }[phase]

  const textClass = {
    onDark: {
      ok: styles.onDarkOk,
      warn: styles.onDarkWarn,
      over: styles.onDarkOver,
    },
    onLight: {
      ok: styles.onLightOk,
      warn: styles.onLightWarn,
      over: styles.onLightOver,
    },
  }[variant][phase]

  return (
    <span className={clsx(styles.badge, textClass)}>
      <span className={clsx(styles.dot, dotClass)} aria-hidden />
      {formatTime(elapsedSec)}
    </span>
  )
}

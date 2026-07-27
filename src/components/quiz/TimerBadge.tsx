import { clsx } from 'clsx'
import { formatTime } from '@/utils/scoring'

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

  const dot = clsx(
    'h-2 w-2 rounded-full',
    phase === 'ok' && 'bg-success',
    phase === 'warn' && 'bg-yellow-500',
    phase === 'over' && 'bg-danger',
  )

  const textColor =
    variant === 'onDark'
      ? clsx(
          phase === 'ok' && 'text-white/80',
          phase === 'warn' && 'text-yellow-400',
          phase === 'over' && 'text-primary',
        )
      : clsx(
          phase === 'ok' && 'text-foreground',
          phase === 'warn' && 'text-yellow-700',
          phase === 'over' && 'text-primary',
        )

  return (
    <span
      className={clsx(
        'inline-flex flex-none items-center gap-xs whitespace-nowrap rounded-full px-sm py-xs text-body-sm font-semibold tabular-nums sm:px-md',
        textColor,
      )}
    >
      <span className={dot} aria-hidden />
      {formatTime(elapsedSec)}
    </span>
  )
}

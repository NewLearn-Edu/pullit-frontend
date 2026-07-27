/**
 * 약점 정책 §3.2 획득 점수 계산 규칙
 * - 권장 시간 이내 정답: 배점 × 100%
 * - 권장 시간 초과 · 제한 시간 이내 정답: 배점 × 60%
 * - 오답: 0점 (시간 무관)
 * - 제한 시간 초과 후 채점: 정답 여부 무관 0점 (시간초과 플래그)
 * - 답 안 내고 해설/정답 미리 열람: 자동 오답 · 0점
 */
export interface ScoreInput {
  points: 2 | 3 | 4
  correct: boolean
  elapsedSec: number
  tRecSec: number
  tMaxSec: number
  peekedBeforeAnswer: boolean
}

export interface ScoreResult {
  earnedPoints: number
  timeoverFlag: boolean
}

export function computeScore(input: ScoreInput): ScoreResult {
  const { points, correct, elapsedSec, tRecSec, tMaxSec, peekedBeforeAnswer } =
    input

  // 답 안 내고 해설/정답 미리 봄 → 자동 오답
  if (peekedBeforeAnswer) {
    return { earnedPoints: 0, timeoverFlag: elapsedSec > tMaxSec }
  }

  // 제한 시간 초과 후 채점 → 정답 여부 무관 0점 · 시간초과 플래그
  if (elapsedSec > tMaxSec) {
    return { earnedPoints: 0, timeoverFlag: true }
  }

  // 오답 → 0점
  if (!correct) {
    return { earnedPoints: 0, timeoverFlag: false }
  }

  // 정답
  if (elapsedSec <= tRecSec) {
    return { earnedPoints: points, timeoverFlag: false }
  }
  // 권장 초과 · 제한 이내 정답 → 60%
  return { earnedPoints: Math.round(points * 0.6 * 10) / 10, timeoverFlag: false }
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

import { fetchSkillScores, type SkillScore } from '@/user/api/attemptApi'
import type { Subject } from '@/user/stores/trialStore'

/**
 * 소단원 평균 점수 변동 결과 화면(/solve-result · Figma 3620-8320 / 2857-21967)용 스냅샷.
 *
 * 세트를 시작할 때 그 소단원의 현재 누적 점수(skill-scores)를 찍어 두고, 세트를 끝낸 뒤
 * 다시 조회한 값과 비교해 "이전 평균 → 현재 평균"을 보여준다.
 * 이어풀기(재발급 없음)는 세트가 처음 발급될 때의 값을 써야 하므로 setId 별로 sessionStorage 에 보관.
 */
export interface UnitScoreSnapshot {
  /** 0~100 누적 점수 */
  score: number
  /** 누적 배점 합 — 세트 반영 여부 판정(제출이 반영되면 커진다) */
  totalPoints: number
}

/** 서버 skill_node 정식 명칭("지수와 로그") ↔ 표시명("지수·로그") 느슨 매칭 */
export const normalizeUnitName = (s: string) => s.replace(/[·\s]/g, '').replace(/와|과/g, '')

export function findSkillScore(scores: SkillScore[], unitName: string): SkillScore | null {
  const key = normalizeUnitName(unitName)
  return scores.find((s) => normalizeUnitName(s.skillNode) === key) ?? null
}

/** 현재 누적 점수 조회 — 아직 기록이 없는 단원은 0점/0배점 */
export async function fetchUnitScoreSnapshot(subject: Subject, unitName: string): Promise<UnitScoreSnapshot> {
  const scores = await fetchSkillScores(subject)
  const hit = findSkillScore(scores, unitName)
  return hit ? { score: Math.round(hit.score), totalPoints: hit.totalPoints } : { score: 0, totalPoints: 0 }
}

const KEY_PREFIX = 'pullit_set_score_before:'

/** 세트 시작 시점 스냅샷 — 이어풀기면 처음 발급 때 저장한 값을 그대로 돌려준다 */
export async function snapshotUnitScoreForSet(
  subject: Subject,
  unitName: string,
  setId: number,
  resumed: boolean,
): Promise<UnitScoreSnapshot | null> {
  const key = `${KEY_PREFIX}${setId}`
  try {
    if (resumed) {
      const raw = sessionStorage.getItem(key)
      if (raw) return JSON.parse(raw) as UnitScoreSnapshot
    }
    const snap = await fetchUnitScoreSnapshot(subject, unitName)
    sessionStorage.setItem(key, JSON.stringify(snap))
    return snap
  } catch {
    return null // 조회 실패 — 결과 화면은 "현재 평균"만 보여준다
  }
}

export function clearUnitScoreSnapshot(setId: number): void {
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}${setId}`)
  } catch {
    /* storage 불가 환경 */
  }
}

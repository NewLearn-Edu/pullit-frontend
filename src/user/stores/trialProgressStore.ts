import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { CurriculumCategory, CurriculumUnit } from '@/user/data/curriculum'

/**
 * 맛보기 진단 진행 상태 (2026-08-12 정책)
 *
 * 정책 요약
 *  - 진단 단위 = 유닛(수학 소단원 · 영어 유형) 1개 = 맛보기 3문제 한 세트
 *  - 유닛은 커리큘럼 순서대로만 열린다 (건너뛰기 없음)
 *  - 하루 기본 1세트. 더 풀려면 크레딧으로 추가 세트를 연다
 *  - 카테고리(대단원 · 능력)의 유닛을 전부 진단하면 그 카테고리 약점 그래프가 열린다
 *  - 진단이 끝나지 않은 동안 데일리 추천 3문제는 "아직 안 푼 다음 유닛" 으로 나간다
 *
 * POC 저장소는 localStorage. 서버 붙으면 diagnosed 는 /api/attempts/skill-scores 로,
 * 데일리 카운터는 서버 일일 세션 기록으로 대체한다 (클라이언트 조작 방지).
 */

/**
 * 재열람용 문항별 결과 — 목 문제 데이터 없이도 결과 표를 다시 그릴 수 있게
 * 표시값(답안 문자열 등)을 진단 시점에 박제한다.
 */
export interface DiagnosisItem {
  correct: boolean
  /** 정답이지만 권장 시간 초과 (세모 채점) */
  overTime: boolean
  /** 풀이 시간 (초) */
  seconds: number
  /** 획득 점수 (시간 감점 반영) */
  earned: number
  /** 배점 */
  points: number
  /** 단답형 여부 — 답안 원기호 크기 보정용 */
  short: boolean
  /** 내 답 표시 문자열 (①~⑤ 또는 단답) */
  myAnswer: string
  /** 정답 표시 문자열 — 오답 보조줄용 */
  correctAnswer: string
  /** 권장 시간 (초) — 초과 보조줄용 */
  recSec: number
}

export interface UnitDiagnosis {
  /** 0~100 — 서버 SkillScoreResponse.score 와 같은 정의 (맞춘 배점 ÷ 푼 배점) */
  score: number
  /** 서버 WEAK_THRESHOLD(70) 미만 */
  weak: boolean
  /** 리스트 메타 표기용 */
  minutes: number
  correct: number
  /** 진단일 (YYYY-MM-DD) */
  date: string
  /** 문항별 결과 — 재열람 페이지용 (구버전 데이터엔 없을 수 있음) */
  items?: DiagnosisItem[]
}

/** 추가 세트 1개 가격 — 정책 확정 시 조정 */
export const EXTRA_SET_CREDIT_COST = 1

/** 하루 기본 무료 세트 수 */
const FREE_SETS_PER_DAY = 1

/** 로컬 자정 기준 날짜 키 (UTC 로 자르면 한국 시간 오전 9시에 리셋된다) */
export function todayKey(base: Date = new Date()): string {
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 데모 시드 — 홈 화면이 빈 상태로 보이지 않게 두 유닛만 진단된 것으로 시작한다.
 * 실서비스 연동 시 이 상수와 initial diagnosed 를 통째로 지우면 된다.
 */
const DEMO_DIAGNOSED: Record<string, UnitDiagnosis> = {
  // 순서 진행 정책과 어긋나지 않게 각 과목 "첫 유닛" 만 진단된 것으로 시드
  '지수·로그': { score: 68, weak: true, minutes: 24, correct: 2, date: '2026-08-11' },
  목적: { score: 82, weak: false, minutes: 18, correct: 3, date: '2026-08-11' },
}

/** 진행 중인 세트 — 결과 화면이 "어느 유닛을 푼 건지" 알아야 진단으로 확정할 수 있다 */
export interface PendingUnit {
  unitName: string
  /** 결과 화면 완료 후 돌아갈 경로 (진행 페이지) */
  returnTo: string
}

export interface TrialProgressState {
  /** 유닛명(= 서버 skill_node) → 진단 결과 */
  diagnosed: Record<string, UnitDiagnosis>
  /** 세트 카운터가 가리키는 날짜 — 다르면 카운터를 리셋한다 */
  dayKey: string
  /** 오늘 완료한 세트 수 */
  setsToday: number
  /** 오늘 크레딧으로 추가한 세트 수 */
  extraToday: number
  /** 풀이 중인 세트 (결과 화면에서 소진) */
  pendingUnit: PendingUnit | null

  /** 날짜가 바뀌었으면 오늘 카운터를 리셋 (읽기 전에 호출) */
  syncDay: () => void
  /** 세트 시작 — 어느 유닛을 푸는 중인지 표시만 한다 (카운터는 완료 시 소진) */
  startUnit: (pending: PendingUnit) => void
  /** 진행 중이던 세트를 진단 완료로 확정 — 오늘 세트를 1 소진한다. 없으면 no-op */
  finishPendingUnit: (result: Omit<UnitDiagnosis, 'date'>) => void
  /** 크레딧을 써서 오늘 세트를 하나 더 연다 (호출 전에 잔액 확인 필요) */
  buyExtraSet: () => void
  /** 개발용 초기화 */
  resetProgress: () => void
}

export const useTrialProgressStore = create<TrialProgressState>()(
  persist(
    (set, get) => ({
      diagnosed: DEMO_DIAGNOSED,
      dayKey: todayKey(),
      setsToday: 0,
      extraToday: 0,
      pendingUnit: null,

      syncDay: () => {
        const key = todayKey()
        if (get().dayKey !== key) set({ dayKey: key, setsToday: 0, extraToday: 0 })
      },

      startUnit: (pending) => {
        get().syncDay()
        set({ pendingUnit: pending })
      },

      /**
       * 세트를 "완료" 시점에 소진한다 (시작 시점이 아니라).
       * 중간에 이탈한 유저가 하루를 날리지 않게 하려는 것 — 어차피 완료해야 진도가 나가므로
       * 재시작 반복으로 얻는 이득이 없다.
       */
      finishPendingUnit: (result) => {
        const pending = get().pendingUnit
        if (!pending) return // 이미 확정됐거나 진행 페이지를 안 거친 세션 (맛보기 온보딩 등)
        get().syncDay()
        set((s) => ({
          diagnosed: { ...s.diagnosed, [pending.unitName]: { ...result, date: todayKey() } },
          setsToday: s.setsToday + 1,
          pendingUnit: null,
        }))
      },

      // TODO: 크레딧 차감 API 연동 (CreditTransactionType 에 소모 타입 추가 필요) — 지금은 로컬 카운터만
      buyExtraSet: () => {
        get().syncDay()
        set((s) => ({ extraToday: s.extraToday + 1 }))
      },

      resetProgress: () =>
        set({ diagnosed: {}, dayKey: todayKey(), setsToday: 0, extraToday: 0, pendingUnit: null }),
    }),
    {
      name: 'pullit_trial_progress',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        diagnosed: s.diagnosed,
        dayKey: s.dayKey,
        setsToday: s.setsToday,
        extraToday: s.extraToday,
        pendingUnit: s.pendingUnit,
      }),
    },
  ),
)

/**
 * 오늘 더 풀 수 있는 세트 수.
 * 셀렉터로 두면 컴포넌트가 카운터 변화에 자동으로 다시 그려진다 (getter 로 두면 안 그려짐).
 * 날짜가 지났는데 아직 syncDay 가 안 돌았어도 새 날 기준으로 답한다.
 */
export const selectRemainingSetsToday = (s: TrialProgressState): number => {
  if (s.dayKey !== todayKey()) return FREE_SETS_PER_DAY
  return Math.max(0, FREE_SETS_PER_DAY + s.extraToday - s.setsToday)
}

// ─────────────────────────────────────────────────────────────────────────────
// 진행도 계산 — 순수 함수 (스토어 없이 서버 점수 맵으로도 계산 가능)
// ─────────────────────────────────────────────────────────────────────────────

export type UnitState = 'done' | 'next' | 'locked'

export interface UnitProgressRow extends CurriculumUnit {
  state: UnitState
  diagnosis?: UnitDiagnosis
}

export interface CategoryProgress {
  rows: UnitProgressRow[]
  total: number
  doneCount: number
  /** 남은 유닛 수 */
  remaining: number
  /** 0~100 */
  percent: number
  /** 전부 진단 완료 = 약점 그래프 오픈 */
  unlocked: boolean
  /** 다음에 풀 유닛 (완료 시 undefined) */
  nextUnit?: UnitProgressRow
}

/**
 * 카테고리 진행도.
 * 순서대로 진행이라 "아직 진단 안 된 첫 유닛" 만 next, 그 뒤는 전부 locked.
 * (중간 유닛을 서버 점수로 먼저 채운 유저가 있어도 순서 판정은 유지된다)
 */
export function computeCategoryProgress(
  category: CurriculumCategory,
  diagnosed: Record<string, UnitDiagnosis>,
): CategoryProgress {
  const firstUnsolved = category.units.findIndex((u) => !diagnosed[u.name])

  const rows: UnitProgressRow[] = category.units.map((u, i) => {
    const diagnosis = diagnosed[u.name]
    if (diagnosis) return { ...u, state: 'done', diagnosis }
    return { ...u, state: i === firstUnsolved ? 'next' : 'locked' }
  })

  const total = category.units.length
  const doneCount = rows.filter((r) => r.state === 'done').length
  const remaining = total - doneCount

  return {
    rows,
    total,
    doneCount,
    remaining,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    unlocked: remaining === 0,
    nextUnit: rows.find((r) => r.state === 'next'),
  }
}

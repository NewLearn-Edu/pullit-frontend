import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CURRICULUM, type CurriculumCategory, type CurriculumUnit } from '@/user/data/curriculum'
import { fetchTrialDiagnoses } from '@/user/api/attemptApi'
import { TRIAL_GROUPS } from '@/user/services/problemSet'
import { useUserStore } from '@/user/stores/userStore'

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

/** 약점 판정 기준 — 서버 TrialDiagnosis.WEAK_THRESHOLD 와 동일 */
const WEAK_THRESHOLD = 70

/**
 * 서버 진단 기록의 group_code → 커리큘럼 유닛명.
 * diagnosed 키는 유닛 표시명('지수·로그')인데 서버 skill_node 는 정식 명칭('지수와 로그')이라
 * 안정 식별자인 group_code(TRIAL_GROUPS 역방향)로 잇는다.
 */
const UNIT_NAME_BY_GROUP: Record<string, string> = (() => {
  const nameByNode: Record<string, string> = {}
  for (const categories of Object.values(CURRICULUM)) {
    for (const category of categories) {
      for (const unit of category.units) {
        if (unit.nodeId) nameByNode[unit.nodeId] = unit.name
      }
    }
  }
  const byGroup: Record<string, string> = {}
  for (const [nodeId, groupCode] of Object.entries(TRIAL_GROUPS)) {
    if (nameByNode[nodeId]) byGroup[groupCode] = nameByNode[nodeId]
  }
  return byGroup
})()

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
  /** 진행 표식 제거 — 진행 페이지를 거치지 않는 맛보기 퍼널 시작 시 stale 잔재 정리 */
  clearPendingUnit: () => void
  /** 진행 중이던 세트를 진단 완료로 확정. 없으면 no-op */
  finishPendingUnit: (result: Omit<UnitDiagnosis, 'date'>) => void
  /** 크레딧을 써서 오늘 세트를 하나 더 연다 (호출 전에 잔액 확인 필요) */
  buyExtraSet: () => void
  /** 서버 진단 기록(trial_diagnoses)으로 diagnosed 를 동기화 — 홈 진입 시 호출 */
  hydrateFromServer: () => Promise<void>
  /** 개발용 초기화 */
  resetProgress: () => void
}

export const useTrialProgressStore = create<TrialProgressState>()(
  persist(
    (set, get) => ({
      diagnosed: {},
      dayKey: todayKey(),
      setsToday: 0,
      extraToday: 0,
      pendingUnit: null,

      syncDay: () => {
        const key = todayKey()
        if (get().dayKey !== key) set({ dayKey: key, setsToday: 0, extraToday: 0 })
      clearPendingUnit: () => set({ pendingUnit: null }),

      },

      startUnit: (pending) => {
        get().syncDay()
        set({ pendingUnit: pending })
      },

      /**
       * 진행 중 표식만 비운다 — 진행 페이지를 거치지 않는 세트(맛보기 퍼널)를 시작할 때 호출.
       * 이전에 unlock 에서 시작하고 이탈한 잔재가 남아 있으면 맛보기 완주를 그 유닛의
       * 완료로 오인해 세트를 소진하고 unlock 으로 복귀시키던 버그 (2026-08-25)
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

      // 크레딧 차감은 호출부(UnlockProgressPage)가 POST /api/credits/extra-set 성공 후 부른다
      buyExtraSet: () => {
        get().syncDay()
        set((s) => ({ extraToday: s.extraToday + 1 }))
      },

      /**
       * 서버 진단 기록으로 동기화 — 서버가 진실원이고, 같은 유닛의 로컬 항목은
       * 문항별 재열람(items)만 보존한다 (서버엔 문항별 결과가 없다).
       * 익명·조회 실패면 로컬 그대로 (풀이 직후 flush 지연 등 로컬이 더 최신일 수 있음).
       */
      hydrateFromServer: async () => {
        if (!useUserStore.getState().me) return
        const [math, english] = await Promise.all([
          fetchTrialDiagnoses('math').catch(() => null),
          fetchTrialDiagnoses('english').catch(() => null),
        ])
        if (math === null && english === null) return
        const server: Record<string, UnitDiagnosis> = {}
        for (const d of [...(math ?? []), ...(english ?? [])]) {
          const unitName = UNIT_NAME_BY_GROUP[d.groupCode]
          if (!unitName) continue // 커리큘럼에 없는 그룹 (구버전 데이터 등) — 표시 대상 아님
          server[unitName] = {
            score: d.score,
            weak: d.score < WEAK_THRESHOLD,
            minutes: d.timeSpentMs ? Math.max(1, Math.round(d.timeSpentMs / 60000)) : 0,
            correct: d.correctCount,
            date: d.completedAt.slice(0, 10),
            items: get().diagnosed[unitName]?.items,
          }
        }
        set((s) => ({ diagnosed: { ...s.diagnosed, ...server } }))
      },

      resetProgress: () =>
        set({ diagnosed: {}, dayKey: todayKey(), setsToday: 0, extraToday: 0, pendingUnit: null }),
    }),
    {
      name: 'pullit_trial_progress',
      storage: createJSONStorage(() => localStorage),
      // v2: 데모 시드(DEMO_DIAGNOSED) 제거 — 기존 브라우저에 박힌 가짜 진단을 비운다
      // v3: 문제 생성 정책 개편(unit_code 그룹·명칭 변경) — 구 명칭 기반 진단 캐시를 비운다
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Partial<TrialProgressState>
        if (version < 3) return { ...state, diagnosed: {} }
        return state
      },
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

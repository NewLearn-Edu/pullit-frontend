import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { CURRICULUM, type CurriculumCategory, type CurriculumUnit } from '@/user/data/curriculum'
import { fetchTrialDiagnoses } from '@/user/api/attemptApi'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { useUserStore } from '@/user/stores/userStore'

/**
 * 맛보기 진단 진행 상태 (2026-08-12 정책)
 *
 * 정책 요약
 *  - 진단 단위 = 유닛(수학 소단원 · 영어 유형) 1개 = 맛보기 3문제 한 세트
 *  - 유닛은 커리큘럼 순서대로만 열린다 (건너뛰기 없음)
 *  - 세트 시작 = 크레딧 차감 (일일 무료·"내일 열려" 제한 없음 — 2026-08-25 확정)
 *  - 카테고리(대단원 · 능력)의 유닛을 전부 진단하면 그 카테고리 약점 그래프가 열린다
 *  - 진단이 끝나지 않은 동안 데일리 추천 3문제는 "아직 안 푼 다음 유닛" 으로 나간다
 *
 * POC 저장소는 localStorage — diagnosed 는 서버(trial_diagnoses)가 진실원이고
 * 여기는 캐시 + 문항별 재열람(items) 보관용이다 (hydrateFromServer 로 동기화).
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
  /** 진단 시각 (HH:mm) — 최근 학습 카드 표기용 (구버전 데이터엔 없을 수 있음) */
  time?: string
  /** 문항별 결과 — 재열람 페이지용 (구버전 데이터엔 없을 수 있음) */
  items?: DiagnosisItem[]
}

/** 세트(소단원 3문제) 1개 진단 가격 — 서버 CreditCommandService.EXTRA_SET_COST 와 같은 값 */
export const SET_CREDIT_COST = 1

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
 * 서버 진단 기록의 group_code(=unit_code) → 커리큘럼 유닛명.
 * diagnosed 키는 유닛 표시명('지수·로그')인데 서버 skill_node 는 정식 명칭('지수와 로그')이라
 * 안정 식별자인 unit_code 로 잇는다 (커리큘럼 전 유닛에 unitCode 부여 — 2026-08-26).
 */
const UNIT_NAME_BY_GROUP: Record<string, string> = (() => {
  const byGroup: Record<string, string> = {}
  for (const categories of Object.values(CURRICULUM)) {
    for (const category of categories) {
      for (const unit of category.units) byGroup[unit.unitCode] = unit.name
    }
  }
  return byGroup
})()

/** 유닛 표시명 → 과목 — hydrate 때 과목별 서버 응답 성공 여부로 로컬 폐기 범위를 가른다 */
const UNIT_SUBJECT_BY_NAME: Record<string, 'math' | 'english'> = (() => {
  const map: Record<string, 'math' | 'english'> = {}
  for (const [subject, categories] of Object.entries(CURRICULUM)) {
    for (const category of categories) {
      for (const unit of category.units) map[unit.name] = subject as 'math' | 'english'
    }
  }
  return map
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
  /** 풀이 중인 세트 (결과 화면에서 확정) */
  pendingUnit: PendingUnit | null
  /** 세트 시작 — 어느 유닛을 푸는 중인지 표시한다 (크레딧 차감은 호출부가 서버로) */
  startUnit: (pending: PendingUnit) => void
  /** 진행 표식 제거 — 진행 페이지를 거치지 않는 맛보기 퍼널 시작 시 stale 잔재 정리 */
  clearPendingUnit: () => void
  /** 진행 중이던 세트를 진단 완료로 확정. 없으면 no-op */
  finishPendingUnit: (result: Omit<UnitDiagnosis, 'date'>) => void
  /** 서버 진단 기록(trial_diagnoses)으로 diagnosed 를 동기화 — 홈 진입 시 호출 */
  hydrateFromServer: () => Promise<void>
  /** 개발용 초기화 */
  resetProgress: () => void
}

export const useTrialProgressStore = create<TrialProgressState>()(
  persist(
    (set, get) => ({
      diagnosed: {},
      pendingUnit: null,

      startUnit: (pending) => set({ pendingUnit: pending }),

      /**
       * 진행 중 표식만 비운다 — 진행 페이지를 거치지 않는 세트(맛보기 퍼널)를 시작할 때 호출.
       * 이전에 unlock 에서 시작하고 이탈한 잔재가 남아 있으면 맛보기 완주를 그 유닛의
       * 완료로 오인해 세트를 소진하고 unlock 으로 복귀시키던 버그 (2026-08-25)
       */
      clearPendingUnit: () => set({ pendingUnit: null }),

      finishPendingUnit: (result) => {
        const pending = get().pendingUnit
        if (!pending) return // 이미 확정됐거나 진행 페이지를 안 거친 세션 (맛보기 온보딩 등)
        const now = new Date()
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        set((s) => ({
          diagnosed: { ...s.diagnosed, [pending.unitName]: { ...result, date: todayKey(), time } },
          pendingUnit: null,
        }))
      },

      /**
       * 서버 진단 기록으로 동기화 — 조회에 성공한 과목은 서버가 진실원이다.
       * 서버에 없는 로컬 진단은 폐기해 삭제된 기록이 캐시로 부활하지 않게 한다
       * (DB 에서 지운 진단이 홈에 계속 남던 버그, 2026-08-26). 같은 유닛의 로컬 항목은
       * 문항별 재열람(items)만 승계하고, 조회에 실패한 과목은 로컬을 그대로 둔다.
       */
      hydrateFromServer: async () => {
        if (!useUserStore.getState().me) return
        // 미전송 풀이를 먼저 반영 — 방금 푼 진단이 서버에 도착하기 전에 폐기되는 역전 방지
        await flushAttemptQueue().catch(() => {})
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
            time: d.completedAt.slice(11, 16) || undefined,
            items: get().diagnosed[unitName]?.items,
          }
        }
        set((s) => {
          // 조회 실패 과목·커리큘럼 밖 항목만 로컬 보존 — 성공 과목은 서버 목록으로 대체
          const kept: Record<string, UnitDiagnosis> = {}
          for (const [name, diag] of Object.entries(s.diagnosed)) {
            const unitSubject = UNIT_SUBJECT_BY_NAME[name]
            const fetched =
              unitSubject === 'math' ? math !== null
              : unitSubject === 'english' ? english !== null
              : false
            if (!fetched) kept[name] = diag
          }
          return { diagnosed: { ...kept, ...server } }
        })
      },

      resetProgress: () => set({ diagnosed: {}, pendingUnit: null }),
    }),
    {
      name: 'pullit_trial_progress',
      storage: createJSONStorage(() => localStorage),
      // v2: 데모 시드(DEMO_DIAGNOSED) 제거 — 기존 브라우저에 박힌 가짜 진단을 비운다
      // v3: 문제 생성 정책 개편(unit_code 그룹·명칭 변경) — 구 명칭 기반 진단 캐시를 비운다
      // v4: 일일 세트 제한 폐지 — dayKey·setsToday·extraToday 카운터 제거
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as Partial<TrialProgressState> & Record<string, unknown>
        if (version < 3) return { diagnosed: {}, pendingUnit: state.pendingUnit ?? null }
        if (version < 4) {
          const { dayKey: _d, setsToday: _s, extraToday: _e, ...rest } = state
          return rest
        }
        return state
      },
      partialize: (s) => ({
        diagnosed: s.diagnosed,
        pendingUnit: s.pendingUnit,
      }),
    },
  ),
)

// ─────────────────────────────────────────────────────────────────────────────
// 진행도 계산 — 순수 함수 (스토어 없이 서버 점수 맵으로도 계산 가능)
// ─────────────────────────────────────────────────────────────────────────────

export type UnitState = 'done' | 'next' | 'locked' | 'off'

export interface UnitProgressRow extends CurriculumUnit {
  state: UnitState
  diagnosis?: UnitDiagnosis
  /** off 구간의 시작 소단원 — "다시 풀면 열려" (재개 진입점, 2026-08-26 정책) */
  offHead?: boolean
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
 * 카테고리 진행도 (2026-08-26 정책).
 * 순서대로 진행이라 "아직 진단 안 된 첫 유닛" 만 next, 그 뒤는 전부 locked.
 * "안배웠어요"(unit_locks)가 선언된 카테고리는 offFrom 소단원부터 끝까지 off —
 * off 구간 첫 유닛(offHead)만 "다시 풀면 열려" 재개 진입점이 된다.
 */
export function computeCategoryProgress(
  category: CurriculumCategory,
  diagnosed: Record<string, UnitDiagnosis>,
  /** 서버 unit_locks 의 off 시작 소단원 unit_code (이 카테고리에 잠금이 없으면 null) */
  offFromUnitCode: string | null = null,
): CategoryProgress {
  const offFromIdx = offFromUnitCode
    ? category.units.findIndex((u) => u.unitCode === offFromUnitCode)
    : -1
  const isOff = (i: number) => offFromIdx >= 0 && i >= offFromIdx

  const firstUnsolved = category.units.findIndex(
    (u, i) => !diagnosed[u.name] && !isOff(i),
  )

  const rows: UnitProgressRow[] = category.units.map((u, i) => {
    const diagnosis = diagnosed[u.name]
    if (isOff(i)) return { ...u, state: 'off', diagnosis, offHead: i === offFromIdx }
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
    // 진행 경로상 "다음 풀 유닛" — off 구간은 제외 (재개는 offHead 로만)
    nextUnit: firstUnsolved >= 0 ? rows[firstUnsolved] : undefined,
  }
}

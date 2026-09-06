import { create } from 'zustand'
import { type Problem } from '@/user/data/mockProblems'
import { type AttemptSource } from '@/user/api/attemptApi'
import type { UnitScoreSnapshot } from '@/user/services/unitScoreSnapshot'
import type { Subject } from '@/user/stores/trialStore'

/**
 * 일반 문제풀이(/solve) 세션 — 진입처(오답노트 다시 풀기 등)가 문제 목록을
 * 준비해 넣고 이동하면, 풀이 화면(mode='solve')이 이걸 읽는다.
 *
 * persist 없음 — 새로고침하면 세션이 사라지고 풀이 화면의 폴백(returnTo 없이
 * 목 문제·홈 복귀)으로 동작한다. 풀이 원장은 문항마다 서버에 남으니 유실 없음.
 */
export interface SolveSession {
  problems: Problem[]
  /** 풀이 기록에 남길 진입 경로 — 오답 다시 풀기 = RETRY (skill 점수 제외) */
  source: AttemptSource
  /** 완료·닫기 시 돌아갈 경로 */
  returnTo: string
  /** 마지막 문항 제출 뒤 먼저 들를 결과 화면 (오답 다시 풀기 — 정답/오답 결과 페이지). 없으면 setId 여부로 세트 결과 또는 returnTo */
  resultTo?: string
  /** 발급 세트 id — 세트 풀이(FREE·DAILY)만, 오답 재풀이(RETRY)는 없음 */
  setId?: number
  /** 세트가 속한 소단원 표시명 — 세트 완료 후 점수 변동 결과 화면(/solve-result)의 제목·조회 키 */
  unitName?: string
  /** 세트 시작 시점의 소단원 누적 점수 — 결과 화면의 "이전 평균" (조회 실패 시 null) */
  scoreBefore?: UnitScoreSnapshot | null
  /** 세트 복원 키 (2026-09-06) — 재로드 시 진행 중 세트를 서버에서 다시 찾는 데 필요. 세트 풀이(setId 있음)만 */
  subject?: Subject
  unitCode?: string
  nodeId?: string
}

/**
 * 재로드 복원용 세션 메타 (2026-09-06) — 문제 배열은 메모리에만 두고, 세트를 다시 찾는 데 필요한 키만
 * sessionStorage 에 남긴다. 풀이 도중 브라우저가 페이지를 다시 로드하면(앱 전환 복귀·웹뷰 재시작) 세션이
 * 사라져 남은 문항이 세트 없이 제출되고, 서버 세트가 영원히 ACTIVE(이어풀기)로 남던 문제의 근거.
 * 세트 풀이(setId 있음)만 기록 — 오답 다시 풀기(RETRY)는 복원할 세트가 없다.
 */
/** 세트가 있는 소스 — 오답 다시 풀기(RETRY)는 세트가 없어 복원 대상이 아니다 */
export type SetSource = Exclude<AttemptSource, 'RETRY'>

export interface SolveSessionMeta {
  subject: Subject
  setId: number
  source: SetSource
  unitCode: string
  nodeId: string
  unitName?: string
  returnTo: string
}

const META_KEY = 'pullit_solve_session_meta'

export function readSolveSessionMeta(): SolveSessionMeta | null {
  try {
    const raw = sessionStorage.getItem(META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as Partial<SolveSessionMeta>
    if (!meta.setId || !meta.subject || !meta.unitCode || !meta.nodeId || !meta.source) return null
    return meta as SolveSessionMeta
  } catch {
    return null
  }
}

function writeSolveSessionMeta(session: SolveSession) {
  try {
    if (session.setId && session.subject && session.unitCode && session.nodeId && session.source !== 'RETRY') {
      const meta: SolveSessionMeta = {
        subject: session.subject,
        setId: session.setId,
        source: session.source,
        unitCode: session.unitCode,
        nodeId: session.nodeId,
        unitName: session.unitName,
        returnTo: session.returnTo,
      }
      sessionStorage.setItem(META_KEY, JSON.stringify(meta))
    } else {
      sessionStorage.removeItem(META_KEY)
    }
  } catch {
    /* 저장 불가 환경 — 복원 없이 진행 */
  }
}

export function clearSolveSessionMeta() {
  try {
    sessionStorage.removeItem(META_KEY)
  } catch {
    /* noop */
  }
}

/**
 * 세트 풀이 문항별 결과 — 세트 결과 화면(/solve/result · Figma 3620-8224)과 해설 리뷰의 근거.
 * 제출 직후엔 내 답·시간만 있고(pending), 서버 채점 응답이 오면 정답·해설·획득 점수가 채워진다
 * (서버 세트 문항은 로컬에 정답이 없어 채점은 서버 응답으로만 확정).
 */
export interface SolveItemResult {
  problemId: number
  selectedChoice: number | null
  elapsedMs: number
  /** 서버 채점 전 = true */
  pending: boolean
  correct?: boolean
  answerNo?: number | null
  explanation?: string | null
  translation?: string | null
  vocabulary?: { term: string; meaning: string }[] | null
  earnedPoints?: number
  timeoverFlag?: boolean
}

interface SolveState {
  session: SolveSession | null
  /** problemId → 결과 (세트 시작 시 비움) */
  results: Record<number, SolveItemResult>
  startSession: (session: SolveSession) => void
  recordResult: (problemId: number, patch: Partial<SolveItemResult>) => void
  clear: () => void
}

export const useSolveStore = create<SolveState>((set) => ({
  session: null,
  results: {},
  startSession: (session) => {
    writeSolveSessionMeta(session)
    set({ session, results: {} })
  },
  recordResult: (problemId, patch) =>
    set((s) => {
      const base: SolveItemResult = s.results[problemId] ?? {
        problemId,
        selectedChoice: null,
        elapsedMs: 0,
        pending: true,
      }
      return { results: { ...s.results, [problemId]: { ...base, ...patch } } }
    }),
  clear: () => {
    clearSolveSessionMeta()
    set({ session: null, results: {} })
  },
}))

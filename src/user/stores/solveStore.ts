import { create } from 'zustand'
import { type Problem } from '@/user/data/mockProblems'
import { type AttemptSource } from '@/user/api/attemptApi'

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
  /** 발급 세트 id — 세트 풀이(FREE·DAILY)만, 오답 재풀이(RETRY)는 없음 */
  setId?: number
}

interface SolveState {
  session: SolveSession | null
  startSession: (session: SolveSession) => void
  clear: () => void
}

export const useSolveStore = create<SolveState>((set) => ({
  session: null,
  startSession: (session) => set({ session }),
  clear: () => set({ session: null }),
}))

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type Subject = 'math' | 'english'

export interface QuizItemResult {
  problemId: number
  selectedChoice: number | null
  correct: boolean
  earnedPoints: number
  timeoverFlag: boolean
  peekedBeforeAnswer: boolean
  elapsedMs: number
  /** 서버 기록 성공 시 attemptId (null = 미전송·실패 → 재전송 큐에 적재됨) */
  attemptId?: number | null
  /** 서버 채점 결과 — 로컬 채점과 다르면 서버가 진실원 */
  serverCorrect?: boolean
}

interface TasteState {
  mathSkillNodeId: string | null
  englishTypeId: string | null
  mathResults: QuizItemResult[]
  englishResults: QuizItemResult[]
  /** 이번 세션에서 실제로 푼 과목 — 완주 가드 판정 기준 */
  lastSubject: Subject | null

  setMathSkillNode: (id: string) => void
  setEnglishType: (id: string) => void
  setLastSubject: (subject: Subject) => void
  addResult: (subject: Subject, result: QuizItemResult) => void
  updateResult: (subject: Subject, problemId: number, patch: Partial<QuizItemResult>) => void
  reset: () => void

  isMathComplete: () => boolean
  isEnglishComplete: () => boolean
  hasCompletedSession: () => boolean
  totalEarnedPoints: () => number
}

/**
 * POC 강제 세팅 - 사용자 선택 없이 지수와 로그 · 빈칸 추론으로 시작.
 * 정책 상 학생이 선택하지만 초기 개발용 임시 고정.
 */
const POC_MATH_SKILL_NODE = 'sn-exp-log-01'
const POC_ENGLISH_TYPE = 'en-blank'

export const useTasteStore = create<TasteState>()(
  persist(
    (set, get) => ({
      mathSkillNodeId: POC_MATH_SKILL_NODE,
      englishTypeId: POC_ENGLISH_TYPE,
      mathResults: [],
      englishResults: [],
      lastSubject: null,

      setMathSkillNode: (id) =>
        set({ mathSkillNodeId: id, mathResults: [] }),

      setEnglishType: (id) =>
        set({ englishTypeId: id, englishResults: [] }),

      setLastSubject: (subject) => set({ lastSubject: subject }),

      addResult: (subject, result) =>
        set((state) => {
          const key = subject === 'math' ? 'mathResults' : 'englishResults'
          return { [key]: [...state[key], result] } as Partial<TasteState>
        }),

      /** 서버 채점 응답이 도착하면 해당 문항 결과를 덧씌운다 (전송은 비동기라 나중에 도착) */
      updateResult: (subject, problemId, patch) =>
        set((state) => {
          const key = subject === 'math' ? 'mathResults' : 'englishResults'
          return {
            [key]: state[key].map((r) => (r.problemId === problemId ? { ...r, ...patch } : r)),
          } as Partial<TasteState>
        }),

      reset: () =>
        set({
          mathSkillNodeId: POC_MATH_SKILL_NODE,
          englishTypeId: POC_ENGLISH_TYPE,
          mathResults: [],
          englishResults: [],
          lastSubject: null,
        }),

      // 맛보기 세트 = 3문항 (정책 · mockProblems TRIAL_PROBLEM_COUNT 와 동일)
      isMathComplete: () => get().mathResults.length >= 3,
      isEnglishComplete: () => get().englishResults.length >= 3,

      /**
       * 완주 여부 — 실제 플로우는 과목 하나만 푼다.
       * (수학·영어 둘 다 요구하던 기존 가드는 정상 완주자도 /taste 로 되튕겼다)
       */
      hasCompletedSession: () => {
        const subject = get().lastSubject
        if (!subject) return get().isMathComplete() || get().isEnglishComplete()
        return subject === 'math' ? get().isMathComplete() : get().isEnglishComplete()
      },

      totalEarnedPoints: () => {
        const { mathResults, englishResults } = get()
        return (
          mathResults.reduce((s, r) => s + r.earnedPoints, 0) +
          englishResults.reduce((s, r) => s + r.earnedPoints, 0)
        )
      },
    }),
    {
      name: 'pullit_taste_session',
      /**
       * sessionStorage 인 이유 — 소셜 로그인은 외부 도메인을 왕복하지만 같은 탭이라
       * 결과가 살아남고, 브라우저를 닫으면 사라져 "맛보기 1회 세션" 의미와 맞는다.
       */
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      /** 데이터 필드만 저장 — 함수가 직렬화되면 rehydrate 후 호출이 불가능해진다 */
      partialize: (state) => ({
        mathSkillNodeId: state.mathSkillNodeId,
        englishTypeId: state.englishTypeId,
        mathResults: state.mathResults,
        englishResults: state.englishResults,
        lastSubject: state.lastSubject,
      }),
    },
  ),
)

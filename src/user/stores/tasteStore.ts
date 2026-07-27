import { create } from 'zustand'

export type Subject = 'math' | 'english'

export interface QuizItemResult {
  problemId: number
  selectedChoice: number | null
  correct: boolean
  earnedPoints: number
  timeoverFlag: boolean
  peekedBeforeAnswer: boolean
  elapsedMs: number
}

interface TasteState {
  mathSkillNodeId: string | null
  englishTypeId: string | null
  mathResults: QuizItemResult[]
  englishResults: QuizItemResult[]

  setMathSkillNode: (id: string) => void
  setEnglishType: (id: string) => void
  addResult: (subject: Subject, result: QuizItemResult) => void
  reset: () => void

  isMathComplete: () => boolean
  isEnglishComplete: () => boolean
  totalEarnedPoints: () => number
}

/**
 * POC 강제 세팅 - 사용자 선택 없이 지수와 로그 · 빈칸 추론으로 시작.
 * 정책 상 학생이 선택하지만 초기 개발용 임시 고정.
 */
const POC_MATH_SKILL_NODE = 'sn-exp-log-01'
const POC_ENGLISH_TYPE = 'en-blank'

export const useTasteStore = create<TasteState>((set, get) => ({
  mathSkillNodeId: POC_MATH_SKILL_NODE,
  englishTypeId: POC_ENGLISH_TYPE,
  mathResults: [],
  englishResults: [],

  setMathSkillNode: (id) =>
    set({ mathSkillNodeId: id, mathResults: [] }),

  setEnglishType: (id) =>
    set({ englishTypeId: id, englishResults: [] }),

  addResult: (subject, result) =>
    set((state) => {
      const key = subject === 'math' ? 'mathResults' : 'englishResults'
      return { [key]: [...state[key], result] } as Partial<TasteState>
    }),

  reset: () =>
    set({
      mathSkillNodeId: POC_MATH_SKILL_NODE,
      englishTypeId: POC_ENGLISH_TYPE,
      mathResults: [],
      englishResults: [],
    }),

  isMathComplete: () => get().mathResults.length >= 4,
  isEnglishComplete: () => get().englishResults.length >= 4,

  totalEarnedPoints: () => {
    const { mathResults, englishResults } = get()
    return (
      mathResults.reduce((s, r) => s + r.earnedPoints, 0) +
      englishResults.reduce((s, r) => s + r.earnedPoints, 0)
    )
  },
}))

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
  /** 서버 정답 번호 — 서버 세트 문항은 로컬에 정답이 없어(answer=0) 표시용으로 박제 */
  serverAnswerNo?: number | null
  /**
   * 서버 해설 — 블록 배열을 담은 JSON 문자열 또는 구 마크다운 문자열.
   * 있으면 목 데이터 해설 대신 이걸 보여준다 (어드민 검수 화면과 같은 조판).
   */
  serverExplanation?: string | null
  /** 서버 지문 해석(영어) — 해설 패널 "해석" 탭 */
  serverTranslation?: string | null
  /** 서버 어휘 [{term, meaning}] — 풀이 탭 하단 */
  serverVocabulary?: { term: string; meaning: string }[]
}

interface TrialState {
  mathSkillNodeId: string | null
  englishTypeId: string | null
  mathResults: QuizItemResult[]
  englishResults: QuizItemResult[]
  /** 이번 세션에서 실제로 푼 과목 — 완주 가드 판정 기준 */
  lastSubject: Subject | null
  /**
   * 첫 진단 보상 지급 확정 — 제출 응답의 grantedReward(TRIAL_FIRST_CLEAR)로만 켜진다.
   * 서버 원장이 진실원이라 로컬 추측 없이 축하 시트 노출 근거가 된다 (회원 경로).
   */
  firstRewardGranted: boolean
  /** 축하 시트 노출 완료 — 같은 세션에서 결과 화면을 재방문해도 다시 뜨지 않게 */
  firstCreditCelebrated: boolean
  /**
   * 결과 화면(/weakness · 퍼널은 /trial/{subject}/weakness) 열람권 — 세트를 막 끝낸 직후에만 유효한 1회용 패스.
   * 세트 완료 시 발급하고, 결과를 다 보고 홈으로 나갈 때 소비한다.
   * 해설 왕복·소셜 로그인 왕복은 결과 화면으로 되돌아오므로 유지된다.
   */
  resultPass: boolean
  /**
   * 진행 중 발급 세트 id — 홈에서 시작한 진단 세트의 제출에 첨부돼
   * 서버 세트 완료 판정·이어풀기의 연결고리가 된다.
   * 온보딩 맛보기(가입 전)는 발급이 없어 null.
   */
  activeSetId: number | null

  setMathSkillNode: (id: string) => void
  setEnglishType: (id: string) => void
  setLastSubject: (subject: Subject) => void
  addResult: (subject: Subject, result: QuizItemResult) => void
  updateResult: (subject: Subject, problemId: number, patch: Partial<QuizItemResult>) => void
  markFirstRewardGranted: () => void
  markFirstCreditCelebrated: () => void
  grantResultPass: () => void
  consumeResultPass: () => void
  setActiveSetId: (id: number | null) => void
  reset: () => void

  isMathComplete: () => boolean
  isEnglishComplete: () => boolean
  hasCompletedSession: () => boolean
  totalEarnedPoints: () => number
}

/**
 * 맛보기 고정 영역 — 수학 = 지수·로그, 영어 = 주제(topic).
 * 맛보기 테스트 정책 §2 (과목만 선택, 출제 영역 고정).
 */
const POC_MATH_SKILL_NODE = 'sn-exp-log-01'
const POC_ENGLISH_TYPE = 'en-topic'

export const useTrialStore = create<TrialState>()(
  persist(
    (set, get) => ({
      mathSkillNodeId: POC_MATH_SKILL_NODE,
      englishTypeId: POC_ENGLISH_TYPE,
      mathResults: [],
      englishResults: [],
      lastSubject: null,
      firstRewardGranted: false,
      firstCreditCelebrated: false,
      resultPass: false,
      activeSetId: null,

      setMathSkillNode: (id) =>
        set({ mathSkillNodeId: id, mathResults: [] }),

      setEnglishType: (id) =>
        set({ englishTypeId: id, englishResults: [] }),

      setLastSubject: (subject) => set({ lastSubject: subject }),

      addResult: (subject, result) =>
        set((state) => {
          const key = subject === 'math' ? 'mathResults' : 'englishResults'
          // 같은 문제 재제출(뒤로가기로 돌아가 다시 풀기)은 기존 결과를 교체 —
          // 중복 append 되면 3문항 세트가 4개 결과로 집계되던 버그 (2026-08-24)
          const rest = state[key].filter((r) => r.problemId !== result.problemId)
          return { [key]: [...rest, result] } as Partial<TrialState>
        }),

      /** 서버 채점 응답이 도착하면 해당 문항 결과를 덧씌운다 (전송은 비동기라 나중에 도착) */
      updateResult: (subject, problemId, patch) =>
        set((state) => {
          const key = subject === 'math' ? 'mathResults' : 'englishResults'
          return {
            [key]: state[key].map((r) => (r.problemId === problemId ? { ...r, ...patch } : r)),
          } as Partial<TrialState>
        }),

      markFirstRewardGranted: () => set({ firstRewardGranted: true }),
      markFirstCreditCelebrated: () => set({ firstCreditCelebrated: true }),

      grantResultPass: () => set({ resultPass: true }),
      consumeResultPass: () => set({ resultPass: false }),

      setActiveSetId: (id) => set({ activeSetId: id }),

      // 보상 플래그 2종은 reset 대상이 아니다 — 세트 재시작마다 초기화되면
      // 같은 세션에서 축하 시트가 다시 뜰 수 있다 (탭 닫으면 자연 소멸)
      reset: () =>
        set({
          mathSkillNodeId: POC_MATH_SKILL_NODE,
          englishTypeId: POC_ENGLISH_TYPE,
          mathResults: [],
          englishResults: [],
          lastSubject: null,
          resultPass: false,
          activeSetId: null,
        }),

      // 맛보기 세트 = 3문항 (정책 · mockProblems TRIAL_PROBLEM_COUNT 와 동일)
      isMathComplete: () => get().mathResults.length >= 3,
      isEnglishComplete: () => get().englishResults.length >= 3,

      /**
       * 완주 여부 — 실제 플로우는 과목 하나만 푼다.
       * (수학·영어 둘 다 요구하던 기존 가드는 정상 완주자도 /trial 로 되튕겼다)
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
      name: 'pullit_trial_session',
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
        firstRewardGranted: state.firstRewardGranted,
        firstCreditCelebrated: state.firstCreditCelebrated,
        resultPass: state.resultPass,
        activeSetId: state.activeSetId,
      }),
    },
  ),
)

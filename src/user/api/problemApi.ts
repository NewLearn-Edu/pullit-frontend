import { api } from '@/user/api/authApi'

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** 용어 주석 — 순서 보존 배열 [{term, meaning}] (문제 생성 정책 §2) */
export interface GlossaryEntry {
  term: string
  meaning: string
}

/**
 * 학생 풀이용 문제 세트 문항 (GET /api/problems) — 문제 생성 정책 2026-08 규격.
 * 정답·해설은 서버가 내려주지 않는다 — 채점 결과는 제출 응답으로만 확인.
 *
 * question 은 발문·지문·조판 통합 원문 — '[' 로 시작하면 블록 배열 직렬화(타입 미확정),
 * 아니면 기존 문자열 본문으로 렌더한다.
 */
export interface ProblemSetItem {
  id: string
  subject: 'MATH' | 'ENGLISH'
  unitCode: string
  unitLarge: string | null
  skillNode: string
  question: string
  choices: string[]
  answerType: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER'
  difficulty: 'BASIC' | 'NORMAL' | 'ADVANCED' | null
  /** 배점 — 소수 허용 (1.5·2.5) */
  score: number
  /** 권장 풀이시간(초) — 제한시간은 ×3 으로 유도 */
  recommendedTimeSec: number
  concept: string | null
  glossary: GlossaryEntry[]
}

/** 유닛(unit_code) 진단 세트 조회 — ACTIVE 문항 코드 오름차순 상위 size개 */
export async function fetchProblemSet(
  subject: 'math' | 'english',
  unitCode: string,
  size = 3,
): Promise<ProblemSetItem[]> {
  const { data } = await api.get<BaseResponse<ProblemSetItem[]>>('/api/problems', {
    params: { subject: subject.toUpperCase(), unitCode, size },
  })
  return data.data
}

/**
 * 맛보기 세트 문항 — 일반 세트와 달리 정답·해설 포함.
 * 맛보기는 가입 전(세션 없음) 풀이라 서버 채점이 불가능해 로컬 채점한다.
 * 정답: 객관식 = answerIndex(1~5) · 단답형 = answerValue(정답 숫자값).
 */
export interface TrialProblemSetItem extends ProblemSetItem {
  answerIndex: number | null
  answerValue: number | null
  answerText: string | null
  explanation: string | null
  /** 영어 지문 해석 블록(JSON 문자열) — 없으면 null */
  translation: string | null
}

/**
 * 맛보기(트라이얼) 출제 세트 조회 (GET /api/trial-problems).
 * 어드민이 선별해 올린 trial_problems 세트 — 그룹의 최소 세트 번호를 sequence 순으로.
 * groupCode = unit_code (수학: math_2022_1_1_1 · 영어: english_2015_1_0_1).
 */
export async function fetchTrialProblemSet(
  subject: 'math' | 'english',
  groupCode: string,
): Promise<TrialProblemSetItem[]> {
  const { data } = await api.get<BaseResponse<TrialProblemSetItem[]>>('/api/trial-problems', {
    params: { subject: subject.toUpperCase(), groupCode },
  })
  return data.data
}

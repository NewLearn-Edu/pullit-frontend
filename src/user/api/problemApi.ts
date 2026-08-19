import { api } from '@/user/api/authApi'

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/**
 * 학생 풀이용 문제 세트 문항 (GET /api/problems).
 * 정답·해설은 서버가 내려주지 않는다 — 채점 결과는 제출 응답으로만 확인.
 */
export interface ProblemSetItem {
  id: string
  subject: 'MATH' | 'ENGLISH'
  unitLarge: string | null
  skillNode: string
  renderCode: string
  question: string
  passage: string | null
  choices: string[]
  answerType: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER'
  difficulty: 'BASIC' | 'NORMAL' | 'ADVANCED' | null
  points: number
  meta: Record<string, unknown>
}

/** 유닛(skill_node) 진단 세트 조회 — ACTIVE 문항 id 오름차순 상위 size개 */
export async function fetchProblemSet(
  subject: 'math' | 'english',
  skillNode: string,
  size = 3,
): Promise<ProblemSetItem[]> {
  const { data } = await api.get<BaseResponse<ProblemSetItem[]>>('/api/problems', {
    params: { subject: subject.toUpperCase(), skillNode, size },
  })
  return data.data
}

/**
 * 맛보기 세트 문항 — 일반 세트와 달리 정답·해설 포함.
 * 맛보기는 가입 전(세션 없음) 풀이라 서버 채점이 불가능해 로컬 채점한다.
 */
export interface TrialProblemSetItem extends ProblemSetItem {
  answerNumber: number | null
  answerText: string | null
  explanation: string | null
}

/**
 * 맛보기(트라이얼) 출제 세트 조회 (GET /api/trial-problems).
 * 어드민이 선별해 올린 trial_problems 세트 — 그룹의 최소 세트 번호를 sequence 순으로.
 * groupCode = 임포트 파일명 그룹 (수학: 2022_1_1_1 · 영어: 01_topic 등).
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

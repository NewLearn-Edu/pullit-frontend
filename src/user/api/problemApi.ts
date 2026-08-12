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

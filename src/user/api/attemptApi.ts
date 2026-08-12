import { api } from '@/user/api/authApi'

export type AttemptSource = 'DAILY' | 'FREE' | 'RETRY' | 'TRIAL'

export interface AttemptSubmitRequest {
  /** 서버 problems 테이블 PK (예: 2022_1_1_1-S0252) */
  problemId: string
  source: AttemptSource
  submittedNo?: number | null
  submittedText?: string | null
  timeSpentMs: number
  /** 무응답 제출("모르겠어요") — 오답 채점 + 원장에서 찍은 오답과 구분 기록 */
  skipped?: boolean
}

export interface AttemptSubmitResponse {
  attemptId: number
  isCorrect: boolean
  answerNumber: number | null
  answerText: string | null
  explanation: string | null
}

interface BaseResponse<T> {
  successCode: string
  message: string
  data: T
}

/** 풀이 1건 제출 — 채점은 서버가 한다 (클라이언트 정답 여부는 신뢰하지 않음) */
export async function submitAttempt(req: AttemptSubmitRequest): Promise<AttemptSubmitResponse> {
  const { data } = await api.post<BaseResponse<AttemptSubmitResponse>>('/api/attempts', req)
  return data.data
}

/** 오답노트 항목 — 마지막 시도가 오답인 문제 (정답·해설은 미포함) */
export interface WrongNoteItem {
  problemId: string
  subject: 'MATH' | 'ENGLISH'
  unitLarge: string | null
  unitMid: string | null
  skillNode: string | null
  points: number | null
  renderCode: string | null
  difficulty: string | null
  question: string | null
  passage: string | null
  choices: string[]
  answerType: string | null
  glossary: Record<string, string>
  wrongCount: number
  lastWrongAt: string
}

/** 오답노트 조회 (과목별 · 맛보기 오답 포함) */
export async function fetchWrongNotes(subject: 'math' | 'english'): Promise<WrongNoteItem[]> {
  const { data } = await api.get<BaseResponse<WrongNoteItem[]>>('/api/attempts/wrong-notes', {
    params: { subject: subject.toUpperCase() },
  })
  return data.data
}

/** 오답노트에서 문제 제거 — wrong_notes 행 삭제 */
export async function deleteWrongNote(problemId: string): Promise<void> {
  await api.delete(`/api/attempts/wrong-notes/${encodeURIComponent(problemId)}`)
}

/** 오답노트 삭제 취소 — 풀이 원장에서 재계산해 행 복원 (멱등) */
export async function restoreWrongNote(problemId: string): Promise<void> {
  await api.post(`/api/attempts/wrong-notes/${encodeURIComponent(problemId)}/restore`)
}

/** 유저×skill_node 누적 점수 — 맞춘 배점/푼 배점 ×100 (RETRY 제외) */
export interface SkillScore {
  skillNode: string
  unitLarge: string | null
  earnedPoints: number
  totalPoints: number
  score: number
  weak: boolean
}

export async function fetchSkillScores(subject: 'math' | 'english'): Promise<SkillScore[]> {
  const { data } = await api.get<BaseResponse<SkillScore[]>>('/api/attempts/skill-scores', {
    params: { subject: subject.toUpperCase() },
  })
  return data.data
}

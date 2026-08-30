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
  /** 발급 세트 id — 세트 풀이면 첨부(완료 판정·이어풀기 근거), 세트 밖 풀이는 생략 */
  setId?: number | null
}

export interface AttemptSubmitResponse {
  attemptId: number
  isCorrect: boolean
  /** 객관식 정답 선지 번호 1~5 (단답형은 null) */
  answerIndex: number | null
  /** 단답형 정답 숫자값 (객관식은 null) */
  answerValue: number | null
  answerText: string | null
  explanation: string | null
  /** 이 제출로 실제 지급된 보상 (null = 없음) — TRIAL_FIRST_CLEAR 면 첫 진단 축하 시트 신호 */
  grantedReward: 'TRIAL_FIRST_CLEAR' | null
  /** 이 제출로 세트가 완료되며 일어난 난이도 레벨 변동 (null = 없음) */
  levelChange: 'UP' | 'DOWN' | null
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
  unitCode: string | null
  unitLarge: string | null
  unitMid: string | null
  skillNode: string | null
  /** 배점 — 소수 허용 */
  score: number | null
  recommendedTimeSec: number | null
  difficulty: string | null
  question: string | null
  choices: string[]
  answerType: string | null
  /** 용어 주석 — 순서 보존 배열 (문제 생성 정책 §2) */
  glossary: { term: string; meaning: string }[]
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

/** 맛보기 진단 완료 기록 — 세트 완주 시 서버가 자동 박제한 행 (trial_diagnoses) */
export interface TrialDiagnosis {
  skillNode: string
  groupCode: string
  setNo: number
  score: number
  correctCount: number
  totalCount: number
  timeSpentMs: number | null
  completedAt: string
}

export async function fetchTrialDiagnoses(
  subject: 'math' | 'english',
): Promise<TrialDiagnosis[]> {
  const { data } = await api.get<BaseResponse<TrialDiagnosis[]>>('/api/trial-diagnoses', {
    params: { subject: subject.toUpperCase() },
  })
  return data.data
}

/** 마이페이지 학습 통계 — accuracyPct 는 풀이가 없으면 null ("—" 표시) */
export interface StudyStats {
  solvedCount: number
  accuracyPct: number | null
  /** 오늘(안 풀었으면 어제)까지 풀이가 이어진 연속 일수 */
  streakDays: number
}

export async function fetchStudyStats(): Promise<StudyStats> {
  const { data } = await api.get<BaseResponse<StudyStats>>('/api/attempts/me/stats')
  return data.data
}

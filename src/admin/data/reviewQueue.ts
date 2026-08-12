import { type ExplainBlock } from '@/shared/components/ExamBlocks'

/**
 * 문제 검수 큐 (localStorage)
 *
 * 업로드 화면에서 체크한 문항을 모아 두고, 검수 페이지에서 나열해 본다.
 * 서버 테이블을 쓰지 않는 이유 — 검수는 운영자 한 명이 자기 브라우저에서
 * 하는 임시 작업이고, 원본은 이미 problems 에 적재돼 있어 유실돼도 재수집이
 * 가능하다. 여러 명이 검수를 나눠 갖게 되면 그때 서버로 올린다.
 */

const KEY = 'pullit_admin_review_queue'
/** 저장 상한 — localStorage(약 5MB)를 해설 블록이 금방 채우므로 넉넉히 잘라 둔다 */
const MAX_ITEMS = 300

/** 업로드 파일 1행 = 문항 하나 (jsonl 원본 스키마) */
export interface ReviewProblem {
  id?: string | number
  subject?: string
  question?: string
  passage?: string
  choices?: string[]
  answer_no?: number
  answer_text?: string
  /** 구 포맷 = 마크다운 문자열 · 신 포맷(2026-08-09~) = 블록 배열 */
  explanation?: string | ExplainBlock[]
  difficulty?: string
}

export interface ReviewEntry {
  /** 중복 방지 키 — 같은 문항을 두 번 담지 않는다 */
  key: string
  problemId: string
  fileName: string
  /** 단원 경로 (대수 › 삼각함수 › 삼각함수) */
  filePath: string
  subject: string
  problem: ReviewProblem
  addedAt: string
}

function read(): ReviewEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(entries: ReviewEntry[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ITEMS)))
    return true
  } catch {
    return false // 용량 초과 등 — 호출부가 안내 문구를 띄운다
  }
}

export function readReviewQueue(): ReviewEntry[] {
  // 최근에 담은 것이 위로
  return read().slice().reverse()
}

export function reviewQueueCount(): number {
  return read().length
}

export function makeReviewKey(fileName: string, problem: ReviewProblem, index: number): string {
  return `${fileName}#${problem.id ?? index}`
}

/**
 * 검수 큐에 담기 — 이미 있는 문항은 건너뛴다.
 * @returns 실제로 담긴 수 · 중복 수 · 저장 실패 여부
 */
export function addToReviewQueue(
  entries: ReviewEntry[],
): { added: number; skipped: number; stored: boolean } {
  const current = read()
  const seen = new Set(current.map((e) => e.key))
  const fresh = entries.filter((e) => !seen.has(e.key))
  if (fresh.length === 0) return { added: 0, skipped: entries.length, stored: true }
  const stored = write([...current, ...fresh])
  return { added: fresh.length, skipped: entries.length - fresh.length, stored }
}

export function removeFromReviewQueue(key: string): void {
  write(read().filter((e) => e.key !== key))
}

export function clearReviewQueue(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 접근 불가 환경 — 무시 */
  }
}

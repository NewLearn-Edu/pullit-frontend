import { isAxiosError } from 'axios'
import { submitAttempt, type AttemptSubmitRequest } from '@/user/api/attemptApi'

/**
 * 풀이 전송 실패분 재시도 큐.
 *
 * 전송은 화면 진행을 막지 않는 fire-and-forget 이라, 네트워크 단절·서버 오류로
 * 떨어진 기록을 여기 쌓아뒀다가 세션 확보 직후 · 로그인 직후 · 완료 화면 진입 시 재전송한다.
 * sessionStorage 인 이유: 소셜 로그인 외부 왕복(같은 탭)에서 살아남고, 브라우저를 닫으면
 * 사라져 잔존 데이터가 남지 않는다. 인증 토큰이 아닌 풀이 데이터라 저장 제약과 무관.
 */
const KEY = 'pullit_attempt_queue'
const MAX_QUEUE = 50

function read(): AttemptSubmitRequest[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(queue: AttemptSubmitRequest[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(queue.slice(-MAX_QUEUE)))
  } catch {
    /* 저장 불가 환경 — 큐 없이 진행 */
  }
}

export function enqueueAttempt(req: AttemptSubmitRequest) {
  write([...read(), req])
}

/** 재시도 가치가 있는 실패인가 — 네트워크 단절·5xx 만. 4xx(401 제외)는 폐기해 무한 재시도를 막는다 */
export function isRetryableAttemptError(error: unknown): boolean {
  if (!isAxiosError(error)) return true // 네트워크 레벨 실패
  const status = error.response?.status
  if (status == null) return true
  return status >= 500 || status === 401
}

let flushing = false

/** 큐 순차 재전송 — 성공분 제거, 복구 불가분 폐기, 재시도분 유지 */
export async function flushAttemptQueue(): Promise<void> {
  if (flushing) return // 로그인 콜백·완료 화면에서 동시 호출될 수 있어 재진입 방지
  const queue = read()
  if (queue.length === 0) return

  flushing = true
  try {
    const remain: AttemptSubmitRequest[] = []
    for (const req of queue) {
      try {
        await submitAttempt(req)
      } catch (error) {
        if (isRetryableAttemptError(error)) remain.push(req)
        // 복구 불가(404 등)는 버린다
      }
    }
    write(remain)
  } finally {
    flushing = false
  }
}

import { isAxiosError } from 'axios'
import { submitAttempt, type AttemptSubmitRequest } from '@/user/api/attemptApi'
import { useUserStore } from '@/user/stores/userStore'

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

/**
 * 진행 중인 제출(fire-and-forget) 추적 (2026-09-04).
 * 풀이 화면은 제출을 기다리지 않고 다음 문항·결과 화면으로 넘어간다. 결과 화면이 마지막 제출이 서버에 닿기 전에
 * 누적 점수를 조회하면 분모에서 그 문항이 빠져 점수가 틀려 보인다 (3·9 중 4점 문항 미도착 → 3/5 = 60점).
 * 제출 Promise 를 여기 등록해 두고, 결과 화면은 waitForPendingAttempts() 뒤에 조회한다.
 */
const inFlight = new Set<Promise<unknown>>()

export function trackAttempt<T>(promise: Promise<T>): Promise<T> {
  const entry: Promise<unknown> = promise.then(
    () => undefined,
    () => undefined, // 실패도 "끝남" — 대기 자체는 풀려야 한다 (재시도는 큐가 맡는다)
  )
  inFlight.add(entry)
  void entry.finally(() => inFlight.delete(entry))
  return promise
}

/** 진행 중 제출이 모두 끝날 때까지 (최대 timeoutMs) — 결과 화면의 점수 조회 앞에서 */
export async function waitForPendingAttempts(timeoutMs = 4000): Promise<void> {
  if (inFlight.size === 0) return
  await Promise.race([
    Promise.all(Array.from(inFlight)),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ])
}

/** 큐 순차 재전송 — 성공분 제거, 복구 불가분 폐기, 재시도분 유지 */
export async function flushAttemptQueue(): Promise<void> {
  if (flushing) return // 로그인 콜백·완료 화면에서 동시 호출될 수 있어 재진입 방지
  // 익명(가입 전 맛보기)이면 보류 — 401 왕복 없이 가입·게스트 생성 시점을 기다린다
  if (!useUserStore.getState().me) return
  const queue = read()
  if (queue.length === 0) return

  flushing = true
  try {
    const remain: AttemptSubmitRequest[] = []
    let rewardGranted = false
    for (const req of queue) {
      try {
        const res = await submitAttempt(req)
        if (res.grantedReward === 'TRIAL_FIRST_CLEAR') rewardGranted = true
      } catch (error) {
        if (isRetryableAttemptError(error)) remain.push(req)
        // 복구 불가(404 등)는 버린다
      }
    }
    write(remain)
    // flush 중 보상이 지급됐으면(게스트 생성·가입 직후 경로) 잔액을 재조회 —
    // 캐시된 me 로 홈 크레딧 배지가 낡은 잔액을 보여주지 않게 (2026-08-26)
    if (rewardGranted) await useUserStore.getState().loadMe(true)
  } finally {
    flushing = false
  }
}

import { api } from '@/user/api/authApi'

/**
 * UTM 유입 카운트 + 최초 유입 귀속 (2026-09-07 개편).
 *
 * 두 단계로 나눈다:
 * 1) captureUtm — 마케팅 링크(?utm_source=...)로 어느 화면에 도착하든 UTM 을 브라우저(localStorage)에 메모만 한다.
 *    서버엔 안 보낸다 — 페이지가 열리기만 해도 세면 Meta 링크 미리보기 크롤러·봇까지 방문으로 잡힌다.
 * 2) reportUtmVisit — /start 의 [시작하기](사람의 클릭)에서 메모를 꺼내 방문 1건을 적재한다.
 *    적재 시점엔 누구인지 모르므로 서버가 돌려준 방문 id 를 보관해 두고, 이 브라우저에서 users 행이 생기는 순간
 *    (맛보기 결과의 [건너뛰기] = 게스트 · 소셜 로그인 = 회원) 그 id 로 방문을 "인수"해 user_id 를 채운다.
 *    처음 보관한 id 는 덮지 않는다(최초 유입). 서버도 유저당 1건만 인수한다.
 *
 * 같은 브라우저가 부풀리지 않게 소스×캠페인별로 24시간에 1회만 보낸다.
 * 실패는 조용히 무시 — 카운트·귀속이 화면 흐름을 방해하면 안 된다.
 */
const DEDUP_PREFIX = 'pullit_utm_visit:'
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000
/** 도착 때 메모해 둔 UTM — [시작하기]에서 보낸다. 새 utm 링크로 다시 오면 덮는다 (이번에 누른 링크가 방문) */
const PENDING_KEY = 'pullit_utm_pending'
/** 이 브라우저의 최초 유입 방문 id — users 행이 생기면 인수에 쓴다 */
const VISIT_ID_KEY = 'pullit_visit_id'
/** 인수를 마친 userId — 같은 유저면 다시 안 보낸다 */
const CLAIMED_KEY = 'pullit_visit_claimed'

interface VisitPayload {
  utmSource: string
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  landingPath: string
}

/** 소스×캠페인 24시간 1회 전송 · 처음 받은 방문 id 는 보관 */
function send(payload: VisitPayload): void {
  const dedupKey = `${DEDUP_PREFIX}${payload.utmSource}:${payload.utmCampaign ?? ''}`
  try {
    const last = Number(localStorage.getItem(dedupKey) ?? 0)
    if (Date.now() - last < DEDUP_WINDOW_MS) return
    localStorage.setItem(dedupKey, String(Date.now()))
  } catch {
    /* storage 불가 환경 — 중복 방지 없이 1회 전송 */
  }

  api
    .post<{ data: { visitId: number | null } | null }>('/api/metrics/visit', payload)
    .then(({ data }) => {
      const id = data.data?.visitId
      if (id == null) return
      try {
        if (!localStorage.getItem(VISIT_ID_KEY)) localStorage.setItem(VISIT_ID_KEY, String(id))
      } catch {
        /* 보관 실패 — 카운트만 남는다 */
      }
    })
    .catch(() => {})
}

const clean = (v: string | null | undefined, max: number) => {
  const t = v?.trim()
  return t ? t.slice(0, max) : null
}

function parseUtm(search: string, path: string): VisitPayload | null {
  const params = new URLSearchParams(search)
  const source = clean(params.get('utm_source'), 64)
  if (!source) return null
  return {
    utmSource: source,
    utmMedium: clean(params.get('utm_medium'), 64),
    utmCampaign: clean(params.get('utm_campaign'), 64),
    utmContent: clean(params.get('utm_content'), 128),
    landingPath: path.slice(0, 128),
  }
}

/** 1) 도착 — URL 에 utm_source 가 있으면 브라우저에 메모만 (App 첫 마운트 · 어느 경로든) */
export function captureUtm(search: string = window.location.search, path: string = window.location.pathname): void {
  const payload = parseUtm(search, path)
  if (!payload) return
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload))
  } catch {
    /* storage 불가 — [시작하기] 때 URL 에 utm 이 남아 있으면 그걸로 보낸다 */
  }
}

/** 2) [시작하기] — 메모해 둔 UTM(없으면 지금 URL 의 utm)으로 방문 1건 적재 후 메모 비움 */
export function reportUtmVisit(): void {
  let payload: VisitPayload | null = null
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (raw) payload = JSON.parse(raw) as VisitPayload
  } catch {
    payload = null
  }
  payload ??= parseUtm(window.location.search, window.location.pathname)
  if (!payload) return
  send(payload)
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* 무시 */
  }
}

/**
 * users 행이 생긴 직후 호출 — 보관된 방문 id 가 있으면 그 방문을 이 유저에 귀속시킨다.
 * 실패는 조용히 무시 (귀속 하나 때문에 로그인·체험 흐름을 막지 않는다).
 */
export function claimUtmVisit(userId: number | null | undefined): void {
  if (userId == null) return
  let visitId: string | null = null
  try {
    visitId = localStorage.getItem(VISIT_ID_KEY)
    if (!visitId || localStorage.getItem(CLAIMED_KEY) === String(userId)) return
  } catch {
    return
  }
  api
    .post(`/api/metrics/visit/${encodeURIComponent(visitId)}/claim`)
    .then(() => {
      try {
        localStorage.setItem(CLAIMED_KEY, String(userId))
      } catch {
        /* 무시 */
      }
    })
    .catch(() => {})
}

/**
 * 얼리버드 직접 방문 집계 — utm 없이 /earlybird 로 들어온 경우도 세기 위한 폴백.
 * utm 이 붙어 있으면 App 의 reportUtmVisit 이 캠페인별로 집계하므로 여기선 건너뛴다.
 */
export function reportEarlybirdDirectVisit(): void {
  const params = new URLSearchParams(window.location.search)
  if (params.get('utm_source')?.trim()) return
  send({ utmSource: 'earlybird', utmMedium: null, utmCampaign: 'direct', utmContent: null, landingPath: '/earlybird' })
}

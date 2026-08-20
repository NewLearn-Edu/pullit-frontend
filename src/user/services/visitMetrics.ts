import { api } from '@/user/api/authApi'

/**
 * UTM 유입 카운트 — 마케팅 링크(?utm_source=...)로 랜딩에 도착하면 1건 적재한다.
 *
 * 같은 브라우저의 새로고침·재방문이 부풀리지 않게 소스×캠페인별로
 * 24시간에 1회만 보낸다 (localStorage 표식). 실패는 조용히 무시 —
 * 카운트가 화면 흐름을 방해하면 안 된다.
 */
const DEDUP_PREFIX = 'pullit_utm_visit:'
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000

/** 소스×캠페인 24시간 1회 전송 — 성공 시 true */
function send(source: string, medium: string | null, campaign: string | null): void {
  const dedupKey = `${DEDUP_PREFIX}${source}:${campaign ?? ''}`
  try {
    const last = Number(localStorage.getItem(dedupKey) ?? 0)
    if (Date.now() - last < DEDUP_WINDOW_MS) return
    localStorage.setItem(dedupKey, String(Date.now()))
  } catch {
    /* storage 불가 환경 — 중복 방지 없이 1회 전송 */
  }

  api
    .post('/api/metrics/visit', {
      utmSource: source.slice(0, 64),
      utmMedium: medium?.slice(0, 64) ?? null,
      utmCampaign: campaign?.slice(0, 64) ?? null,
    })
    .catch(() => {})
}

export function reportUtmVisit(search: string = window.location.search): void {
  const params = new URLSearchParams(search)
  const source = params.get('utm_source')?.trim()
  if (!source) return
  send(source, params.get('utm_medium')?.trim() || null, params.get('utm_campaign')?.trim() || null)
}

/**
 * 얼리버드 직접 방문 집계 — utm 없이 /earlybird 로 들어온 경우도 세기 위한 폴백.
 * utm 이 붙어 있으면 랜딩의 reportUtmVisit 이 캠페인별로 집계하므로 여기선 건너뛴다.
 */
export function reportEarlybirdDirectVisit(): void {
  const params = new URLSearchParams(window.location.search)
  if (params.get('utm_source')?.trim()) return
  send('earlybird', null, 'direct')
}

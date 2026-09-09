/**
 * 소재별 /start 랜딩 변형 (2026-09-09).
 *
 * 메타 광고 소재마다 다른 인트로를 보여주기 위해 /start 아래에 슬러그를 둔다 — /start/math-1 처럼.
 * 변형은 /start 의 "대체판"이다: 유저는 진입한 변형 경로에 그대로 머물고, 코드가 /start 로 보내는 모든 곳
 * (로그인 뒤 퍼널 복귀 · 회원 영역 가드의 미완주 → 퍼널)은 startPath() 로 유저가 들어온 변형을 돌려준다.
 *
 * - 소재 식별은 utm_content, 랜딩 식별은 경로 — 둘을 분리해 같은 소재를 두 랜딩에 붙여 비교할 수 있다
 * - 등록 안 된 슬러그는 404 나 /start 리다이렉트 대신 기본 인트로를 그 주소 그대로 그린다.
 *   광고를 내린 뒤 링크가 남아도 유입이 죽지 않고, 리다이렉트로 ?utm 이 날아가 방문 적재가 빠지는 일도 없다
 * - 방문 적재(visit_events.landing_path)는 경로를 그대로 남기므로 랜딩별 퍼널이 추가 작업 없이 잡힌다.
 *   퍼널 0단계 판정(visitMetrics.FUNNEL_STEPS · 서버 FunnelPath.java)은 /start/<슬러그> 도 받는다
 */
import type { ComponentType } from 'react'
import StartMathReviewPage from '@/user/pages/trial/start-variants/StartMathReviewPage'

/** 슬러그 규칙 — 소문자·숫자·하이픈. 서버 FunnelPath 의 0단계 정규식과 같아야 한다 */
export const START_PATH_RE = /^\/start(\/[a-z0-9-]+)?$/

export interface StartVariantProps {
  slug: string
}

export interface StartVariant {
  /** 어떤 소재·메시지용인지 (등록일과 함께 — 광고 내린 뒤 정리할 때 근거) */
  note: string
  since: string
  /** 변형 화면. 없으면 기본 인트로(TrialIntroPage)를 그 주소 그대로 그린다 */
  component?: ComponentType<StartVariantProps>
}

/**
 * 변형 등록부 — 슬러그는 소재 파일명이 아니라 "랜딩이 말하는 내용" 기준으로 짧게 (소재는 자주 바뀌고 랜딩은 재사용된다).
 * 예) 'math-1': { note: '고1 수학 소재용 — 지수와 로그 진단 강조', since: '2026-09-09', component: StartMath1Page }
 */
export const START_VARIANTS: Record<string, StartVariant> = {
  'math-review': {
    note: '수학 후기형 — 인스타 DM 캡처 + 스토리 말풍선 (Figma 풀잇_인스타그램 335-123 "/start-후기2")',
    since: '2026-09-09',
    component: StartMathReviewPage,
  },
}

export function getStartVariant(slug: string | undefined): StartVariant | null {
  return slug ? (START_VARIANTS[slug] ?? null) : null
}

/** 유저가 들어온 /start 변형 경로 — 로그인·가입 리다이렉트를 건너도 남도록 localStorage */
const START_PATH_KEY = 'pullit_start_path'

/** /start 계열 화면에 도착할 때 호출 — 변형이면 기억, 기본 /start 면 기억을 지운다 (진입점이 곧 리셋) */
export function rememberStartPath(pathname: string): void {
  if (!START_PATH_RE.test(pathname)) return
  try {
    if (pathname === '/start') localStorage.removeItem(START_PATH_KEY)
    else localStorage.setItem(START_PATH_KEY, pathname)
  } catch {
    /* storage 불가 — 기본 /start 로 간다 */
  }
}

/** 퍼널 시작 화면 경로 — 유저가 변형으로 들어왔으면 그 변형, 아니면 /start */
export function startPath(): string {
  try {
    const saved = localStorage.getItem(START_PATH_KEY)
    if (saved && START_PATH_RE.test(saved)) return saved
  } catch {
    /* noop */
  }
  return '/start'
}

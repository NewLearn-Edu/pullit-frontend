import { startPath } from '@/user/services/startVariants'

/**
 * 맛보기 퍼널 진입 표식 (2026-09-09) — "/start 를 거쳐 들어왔는가".
 *
 * 퍼널 화면(/trial · /trial/quiz · /trial/review · /trial/{subject}/weakness)은 주소만 치면 열렸다.
 * 과목 노드가 POC 기본값으로 항상 채워져 있어 기존 가드가 발동하지 않았기 때문. 직접 진입은
 * /trial 의 세트 리셋(이전 결과·타이머·진행 단원 정리)을 건너뛰어 재도전 결과가 엉킬 수 있다.
 *
 * /start(변형 포함)·로그인의 "비회원으로 약점보기"처럼 퍼널의 정식 입구에서만 표식을 세우고,
 * 퍼널 화면은 표식이 없으면 startPath()(들어온 /start 변형)로 돌려보낸다.
 * sessionStorage — 소셜 로그인 왕복·새로고침(같은 탭)에는 살아남고, 새 탭·?qa-reset 에서는 비워진다.
 */
const KEY = 'pullit_trial_funnel_entered'

export function markTrialFunnelEntered(): void {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* storage 불가 — 가드도 같은 이유로 통과시킨다 */
  }
}

export function hasEnteredTrialFunnel(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function clearTrialFunnelEntered(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

/** 퍼널 정식 입구에서 — 표식을 세우고 과목 선택 경로를 돌려준다: navigate(enterTrialFunnel()) */
export function enterTrialFunnel(): string {
  markTrialFunnelEntered()
  return '/trial'
}

/** 퍼널 화면이 표식 없이 열렸을 때 돌아갈 곳 */
export function trialFunnelEntryPath(): string {
  return startPath()
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { captureInviteCode } from './user/services/referral'
import { applyAppInsets } from './user/utils/standalone'
import { restoreProblemNotes } from './user/services/problemNotes'
// Pretendard 셀프호스팅 (dynamic subset) — CDN 통짜 가변 폰트(~2MB) 로드가
// 매 새로고침마다 시스템 폰트 → Pretendard 교체 깜빡임(FOUT)을 만들어 전환.
// 유니코드 범위별 분할 파일이라 필요한 글리프만 수십 KB 단위로 즉시 로드된다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles/globals.css'
// KaTeX 렌더링 CSS · 이거 없으면 \sqrt[n], \frac, ^ 등이 배치되지 않아 수식이 깨져 보임
import 'katex/dist/katex.min.css'

// QA 전용 URL 리셋 (dev 빌드 한정) — 모바일 실기기는 콘솔을 열 수 없어
// 주소에 ?qa-reset 을 붙여 열면 1회성 로컬 플래그·맛보기 세션 잔재를 지운다.
// 프로덕션 번들에서는 import.meta.env.DEV 가 false 라 코드째 제거된다.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('qa-reset')) {
  localStorage.removeItem('pullit_first_credit_celebrated') // 첫 크레딧 시트 1회 노출 플래그
  localStorage.removeItem('pullit_trial_progress') // 단원 진단 캐시·오늘 세트 카운터·pendingUnit
  localStorage.removeItem('pullit_resume_prompt_shown_at') // 이어풀기 팝업 24시간 쿨다운
  sessionStorage.clear() // 맛보기 결과·풀이 큐·문항 타이머 스냅샷
}

// 초대 링크(?invite=)로 진입한 경우 코드를 즉시 저장 — 소셜 로그인 리다이렉트로 URL 이 날아가기 전에.
// 렌더 전에 실행해 어떤 라우트로 들어오든 붙잡는다
captureInviteCode()
// 앱(iPad 래퍼·PWA) 상단 인셋 폴백 — 상태바 아래 여백 (--safe-top)
applyAppInsets()

// 못 올린 필기(로컬 저널) 복구 — 어떤 화면으로 들어오든 세션이 확인되는 즉시 서버로 보낸다
void restoreProblemNotes()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

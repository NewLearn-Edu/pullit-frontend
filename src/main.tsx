import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
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
  sessionStorage.clear() // 맛보기 결과·풀이 큐·문항 타이머 스냅샷
}

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

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * 브라우저 뒤로가기(버튼 · 엣지 스와이프 · 마우스 제스처) 차단 — 풀이·결과 화면 전용 (2026-09-04).
 *
 * 진입 시 현재 주소를 한 번 더 push 해 첫 back 을 흡수하고, popstate 가 오면 즉시 현재 주소로 replace 한 뒤
 * 가드를 다시 쌓는다. 이탈은 화면 안 버튼(X · 완료)으로만 가능하다.
 * (가드만 쌓는 방식은 히스토리 밑단의 이전 엔트리로 라우터가 되돌아가 버린다 — TrialQuizPage 에 있던
 * 패턴을 공용화.) 같은 화면 안에서 주소가 바뀌어도(문항 이동) 최신 주소로 되돌린다.
 *
 * 뒤로가기로 풀이 화면에 다시 들어가 같은 문항을 재제출하면 원장이 두 번 적히는 사고를 여기서 1차로 막고,
 * 서버는 같은 세트·같은 문항 재제출을 멱등 처리해 2차로 막는다.
 */
export function useBlockBackNavigation(enabled = true) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const currentRef = useRef(pathname + search)
  useEffect(() => {
    currentRef.current = pathname + search
  }, [pathname, search])

  useEffect(() => {
    if (!enabled) return
    window.history.pushState(null, '', window.location.href) // 첫 back 흡수용 가드
    const onPop = () => {
      navigate(currentRef.current, { replace: true }) // 팝된 엔트리를 현재 주소로 교체
      window.history.pushState(null, '', currentRef.current) // 가드 재적재
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [enabled, navigate])
}

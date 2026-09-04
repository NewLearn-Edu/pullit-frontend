import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useNavStackStore } from '@/user/stores/navStackStore'

/**
 * 브라우저 뒤로가기(버튼 · 엣지 스와이프 · 마우스 제스처) 전역 차단 (2026-09-04 전 화면으로 확대).
 * App 의 BlockBackNavigation 에서 한 번만 부른다 — 화면별로 부르면 핸들러가 겹쳐 가드가 이중으로 쌓인다.
 * 이탈은 화면 안 버튼으로만 가능하고, 헤더의 "직전 화면" 뒤로가기는 navStackStore 로 되돌아간다.
 *
 * 진입 · 화면 안 주소 변경마다 현재 주소의 쌍둥이 가드를 push 해 back 을 흡수하고, popstate 가 오면
 * 현재 주소로 replace 한 뒤 가드를 다시 쌓는다. 팝되는 엔트리가 항상 현재 주소의 쌍둥이라
 * 재장전 전 한 틱 동안 라우터가 다른 화면을 그리지 않는다.
 *
 * ★ 재장전은 반드시 한 틱 늦춘다 (setTimeout 0). iOS·iPadOS 엣지 스와이프(WKWebView 래퍼 앱 · Safari)는
 * 제스처가 끝난 뒤 popstate 를 쏘는데, 그 핸들러 안에서 동기로 pushState 하면 WebKit UI 프로세스의
 * 히스토리 커서가 갱신되지 않아 다음 스와이프가 한 칸이 아니라 두 칸 뒤로 간다. 그러면 화면은 매번 되돌아와도
 * 스와이프마다 이전 문항·홈 스냅샷이 차례로 보이고 뒤 히스토리가 하나씩 파괴된다.
 * (iOS 18.6 시뮬레이터로 확인 — 동기: /weak → /q2 → /q1 → /home 순으로 팝, 지연: 항상 /weak)
 *
 * 뒤로가기로 풀이 화면에 다시 들어가 같은 문항을 재제출하면 원장이 두 번 적히는 사고를 여기서 1차로 막고,
 * 서버는 같은 세트·같은 문항 재제출을 멱등 처리해 2차로 막는다.
 */
export function useBlockBackNavigation(enabled = true) {
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const { pathname, search } = useLocation()
  const record = useNavStackStore((s) => s.record)
  // 잠근 주소 — 앱이 스스로 이동한(PUSH·REPLACE) 마지막 주소. POP 으로 바뀐 주소는 절대 받아들이지 않는다:
  // 재장전 타이머가 뜨기 전 back 이 한 번 더 들어오면(하드웨어 버튼 연타 · 자동화) 팝된 이전 주소가 잠깐
  // 현재가 되는데, 그걸 현재로 삼으면 그대로 빠져나간다. 타이머는 항상 잠근 주소로 되돌린다.
  const currentRef = useRef(pathname + search)
  const navigateRef = useRef(navigate)
  useEffect(() => {
    if (navigationType !== 'POP') currentRef.current = pathname + search
    navigateRef.current = navigate
  }, [navigationType, pathname, search, navigate])

  // 앱 방문 스택 기록 — 차단 여부와 무관하게 항상 (헤더 뒤로가기의 진실원)
  useEffect(() => {
    record(navigationType, pathname + search)
  }, [record, navigationType, pathname, search])

  // 진입 · 화면 안 주소 변경마다 현재 주소의 쌍둥이 가드를 쌓는다 (재장전은 같은 주소라 여기 안 걸린다)
  useEffect(() => {
    if (!enabled) return
    window.history.pushState(null, '', window.location.href)
  }, [enabled, pathname, search])

  useEffect(() => {
    if (!enabled) return
    let timer: number | undefined
    const onPop = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        navigateRef.current(currentRef.current, { replace: true }) // 팝된 엔트리를 현재 주소로 교체
        window.history.pushState(null, '', currentRef.current) // 가드 재적재
      }, 0)
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('popstate', onPop)
    }
  }, [enabled])
}

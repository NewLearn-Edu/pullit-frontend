import { useEffect, useRef, useState } from 'react'
import { isMetaInAppBrowser } from '@/user/utils/standalone'

/**
 * 인앱 브라우저 안내 시트 (2026-09-10) — 인스타그램·페이스북 광고를 누르면 그 앱 안의 웹뷰로 열린다.
 * 인앱 웹뷰는 소셜 로그인(구글 disallowed_useragent)·쿠키 보존이 불안정해 외부 브라우저로 안내한다.
 *
 * - 안드로이드: "브라우저로 열기" → 크롬 intent URL 로 이동. 인스타·페이스북 인앱이 허용해 크롬이 바로 뜬다
 * - iOS: "Safari 로 열기" → x-safari-https:// 로 이동 (비공식이지만 인스타·페이스북 인앱에서 사파리가 열린다).
 *   1.2초 안에 화면이 그대로면(안 열림) 수동 안내("··· → 외부 브라우저에서 열기")로 바꾼다
 * - "그냥 계속하기": 맛보기는 인앱에서도 되므로 퍼널을 막지 않는다. 이 세션에선 다시 띄우지 않는다
 * 현재 URL(utm·fbclid 포함)을 그대로 넘겨 광고 귀속이 끊기지 않게 한다. 카카오톡은 index.html 이 먼저 내보내므로 여기 안 온다.
 */
const DISMISS_KEY = 'pullit_inapp_gate_dismissed'

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent || '')
}

/** 안드로이드 크롬 intent — 크롬이 없으면 browser_fallback_url 로 같은 주소를 기본 브라우저에 연다 */
function chromeIntentUrl(url: string): string {
  const u = new URL(url)
  const fallback = encodeURIComponent(url)
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`
}

export function shouldShowInAppGate(): boolean {
  if (!isMetaInAppBrowser()) return false
  try {
    return sessionStorage.getItem(DISMISS_KEY) !== '1'
  } catch {
    return true
  }
}

export function InAppBrowserGate() {
  const [open, setOpen] = useState(() => shouldShowInAppGate())
  const [needManual, setNeedManual] = useState(false)
  const timer = useRef<number | null>(null)
  const android = isAndroid()

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  if (!open) return null

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
    setOpen(false)
  }

  const openExternal = () => {
    const url = window.location.href
    if (android) {
      window.location.href = chromeIntentUrl(url)
      return
    }
    // iOS — 사파리로. 이동에 성공하면 이 웹뷰는 백그라운드로 가고(visibilitychange), 실패하면 화면이 그대로다
    window.location.href = 'x-safari-' + url
    timer.current = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setNeedManual(true)
    }, 1200)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inapp-gate-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-[20px] max-md:items-end max-md:p-0"
    >
      <style>{`
        @keyframes pi-inapp-fade { from { opacity: 0 } }
        @keyframes pi-inapp-pop { from { opacity: 0; transform: scale(0.94) translateY(10px) } }
        @keyframes pi-inapp-rise { from { transform: translateY(100%) } }
      `}</style>
      <div className="absolute inset-0 animate-[pi-inapp-fade_200ms_ease] bg-[rgba(21,17,18,0.38)]" aria-hidden="true" />

      <div className="relative w-full max-w-[400px] animate-[pi-inapp-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[24px] bg-white px-[20px] pb-[20px] pt-[32px] shadow-[0px_-16px_25px_rgba(0,0,0,0.12)] max-md:max-w-none max-md:animate-[pi-inapp-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[32px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="mb-[16px] hidden justify-center max-md:flex">
          <span className="h-[5px] w-[42px] rounded-full bg-[#d6d8db]" />
        </div>

        <h2 id="inapp-gate-title" className="text-center text-[20px] font-semibold leading-[1.4] text-[#121417]">
          {android ? '브라우저에서 열면 더 편해요' : 'Safari 에서 열면 더 편해요'}
        </h2>
        <p className="mt-[10px] text-center text-[14px] font-medium leading-[1.6] text-[#5e6368]">
          인스타그램 안에서는 로그인이 막히거나
          <br />
          학습 기록이 사라질 수 있어요
        </p>

        {needManual && (
          <div className="mt-[16px] rounded-[14px] bg-[#f8f8f8] px-[16px] py-[14px] text-[14px] font-medium leading-[1.6] text-[#121417]" role="status">
            자동으로 열리지 않았어요.
            <br />
            오른쪽 위 <b className="font-bold">···</b> 을 누르고
            <br />
            <b className="font-bold">외부 브라우저에서 열기</b>를 선택해 주세요
          </div>
        )}

        <div className="mt-[20px] flex flex-col gap-[10px]">
          <button
            type="button"
            onClick={openExternal}
            className="flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[#FF385C] text-[16px] font-bold text-white transition-colors hover:bg-[#E6203F]"
          >
            {android ? '브라우저로 열기' : 'Safari 로 열기'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="flex h-[44px] w-full items-center justify-center rounded-[12px] text-[14px] font-semibold text-[#80858b] transition-colors hover:bg-[#f8f8f8]"
          >
            그냥 계속하기
          </button>
        </div>
      </div>
    </div>
  )
}

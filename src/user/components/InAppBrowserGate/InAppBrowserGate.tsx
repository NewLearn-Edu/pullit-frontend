import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { isMetaInAppBrowser } from '@/user/utils/standalone'

/**
 * 인앱 브라우저 안내 시트 (2026-09-10) — 인스타그램·페이스북 광고를 누르면 그 앱 안의 웹뷰로 열린다.
 * 인앱 웹뷰는 소셜 로그인(구글 disallowed_useragent)·쿠키 보존이 불안정해 외부 브라우저로 안내한다.
 *
 * - 안드로이드: "브라우저로 열기" → 크롬 intent URL 로 이동. 인스타·페이스북 인앱이 허용해 크롬이 바로 뜬다
 * - iOS 인스타그램·스레드: "Safari 로 열기" 는 인스타 자체 스킴 instagram://extbrowser/?url= 를 href 로 가진 <a> 다.
 *   x-safari-https:// 는 2025년 중반부터 메타 웹뷰가 조용히 버린다(구버전 인스타에서만 열려 "가끔 되는" 증상).
 *   extbrowser 는 인스타가 "외부 브라우저에서 열기" 메뉴에 쓰는 경로라 막지 않지만, 사용자 탭으로 시작한 앵커 이동만 받고
 *   스크립트의 location.href 대입은 무시한다 — 그래서 button 이 아니라 a 태그다
 * - iOS 페이스북 등 나머지: x-safari-https:// 로 이동 (전용 스킴이 없다)
 *   어느 쪽이든 2.5초 안에 pagehide·visibilitychange 가 안 오면(안 열림) 수동 안내("··· → 외부 브라우저에서 열기")를 덧붙인다
 * - "그냥 계속하기" 또는 핸들을 아래로 끌기(80px 이상): 맛보기는 인앱에서도 되므로 퍼널을 막지 않는다. 이 세션에선 다시 띄우지 않는다
 * 현재 URL(utm·fbclid 포함)을 그대로 넘겨 광고 귀속이 끊기지 않게 한다. 카카오톡은 index.html 이 먼저 내보내므로 여기 안 온다.
 */
const DISMISS_KEY = 'pullit_inapp_gate_dismissed'

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent || '')
}

/** 인스타그램·스레드(Barcelona) 인앱 — instagram://extbrowser 스킴을 받는 웹뷰 */
function isInstagramFamily(): boolean {
  return /Instagram|Barcelona/i.test(navigator.userAgent || '')
}

/** 인스타 자체 "외부 브라우저에서 열기" 스킴 — 기본 브라우저(대개 Safari)로 같은 주소를 연다 */
function instagramExtBrowserUrl(url: string): string {
  return 'instagram://extbrowser/?url=' + encodeURIComponent(url)
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

/** 외부 브라우저가 실제로 열리면 이 웹뷰는 백그라운드로 간다 — 그 신호가 이 시간 안에 없으면 "안 열림" 으로 본다 */
const OPEN_TIMEOUT_MS = 2500
/** 핸들을 이만큼 아래로 끌면 닫는다 */
const DRAG_CLOSE_PX = 80
const CLOSE_ANIM_MS = 220

export function InAppBrowserGate() {
  const [open, setOpen] = useState(() => shouldShowInAppGate())
  const [needManual, setNeedManual] = useState(false)
  const timer = useRef<number | null>(null)
  // 핸들 드래그 — 아래로 끌면 시트가 따라 내려오고, 충분히 내리면(DRAG_CLOSE_PX) 닫힌다. 모자라면 제자리로 튕긴다
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const android = isAndroid()
  const instagram = !android && isInstagramFamily()

  useEffect(() => {
    // 성공(백그라운드 전환) 신호가 오면 실패 판정 타이머를 끈다
    const cancel = () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') cancel() }
    window.addEventListener('pagehide', cancel)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancel()
      window.removeEventListener('pagehide', cancel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (!open) return null

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* noop */ }
    setOpen(false)
  }

  /** 아래로 밀어 닫기 — 퇴장 애니메이션(translateY 100%) 뒤에 실제로 지운다 */
  const slideOutAndDismiss = () => {
    setClosing(true)
    window.setTimeout(dismiss, CLOSE_ANIM_MS)
  }

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (closing) return
    dragStartY.current = e.clientY
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return
    setDragY(Math.max(0, e.clientY - dragStartY.current))
  }
  const onHandlePointerUp = () => {
    if (dragStartY.current === null) return
    dragStartY.current = null
    setDragging(false)
    if (dragY >= DRAG_CLOSE_PX) {
      slideOutAndDismiss()
      return
    }
    setDragY(0)
  }

  const armFailureTimer = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      if (document.visibilityState === 'visible') setNeedManual(true)
    }, OPEN_TIMEOUT_MS)
  }

  // 인스타·스레드 iOS 는 <a href> 탭 자체가 이동이다 — 여기서는 실패 판정만 건다 (preventDefault 금지)
  const onInstagramTap = () => {
    armFailureTimer()
  }

  const openExternal = () => {
    const url = window.location.href
    if (android) {
      window.location.href = chromeIntentUrl(url)
      return
    }
    // iOS 페이스북 등 — x-safari 로. 성공하면 백그라운드로 가고(visibilitychange), 실패하면 화면이 그대로다
    window.location.href = 'x-safari-' + url
    armFailureTimer()
  }

  const buttonClass =
    'flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[#FF385C] text-[16px] font-bold text-white transition-colors hover:bg-[#E6203F]'
  const buttonLabel = android ? '브라우저로 열기' : 'Safari 로 열기'

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

      <div
        className="relative w-full max-w-[400px] animate-[pi-inapp-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[24px] bg-white px-[20px] pb-[20px] pt-[32px] shadow-[0px_-16px_25px_rgba(0,0,0,0.12)] max-md:max-w-none max-md:animate-[pi-inapp-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[32px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))] max-md:pt-[8px]"
        style={{
          transform: closing ? 'translateY(110%)' : dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : `transform ${CLOSE_ANIM_MS}ms cubic-bezier(0.22,0.9,0.3,1)`,
        }}
      >
        {/* 핸들 — 잡는 영역은 가로 전체·세로 34px 로 넓혀 두고, 보이는 바는 위쪽에 붙인다 */}
        <div
          className="hidden cursor-grab touch-none select-none justify-center pb-[20px] pt-[6px] active:cursor-grabbing max-md:flex"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          aria-hidden="true"
        >
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
          {instagram ? (
            <a href={instagramExtBrowserUrl(window.location.href)} onClick={onInstagramTap} className={buttonClass}>
              {buttonLabel}
            </a>
          ) : (
            <button type="button" onClick={openExternal} className={buttonClass}>
              {buttonLabel}
            </button>
          )}
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

import { useEffect, useState } from 'react'

/**
 * 크레딧 사용 토스트 (Figma 2857-21836 · 3631-9472).
 *
 * 정책(시안 주석): 크레딧을 사용한 "첫 문제 화면"에서만 1회, 2초 노출.
 * 이후 문제로 넘어가면 다시 뜨지 않는다.
 *
 * 세트를 발급(차감)한 쪽이 sessionStorage 플래시를 남기고, 문제 페이지가
 * 마운트될 때 이 컴포넌트가 소비한다 — 읽는 즉시 지워져 1회 보장.
 * 이어풀기(재발급 없음)는 플래시를 안 남기므로 뜨지 않는다.
 */

const FLASH_KEY = 'pullit_credit_used_flash'

export function setCreditUsedFlash(used: number, remaining: number): void {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ used, remaining: Math.max(0, remaining) }))
  } catch {
    /* storage 불가 환경 — 토스트 생략 */
  }
}

function consumeCreditUsedFlash(): { used: number; remaining: number } | null {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY)
    if (!raw) return null
    sessionStorage.removeItem(FLASH_KEY)
    const parsed = JSON.parse(raw) as { used?: number; remaining?: number }
    if (typeof parsed.used !== 'number' || typeof parsed.remaining !== 'number') return null
    return { used: parsed.used, remaining: parsed.remaining }
  } catch {
    return null
  }
}

export function CreditUsedToast() {
  const [flash, setFlash] = useState<{ used: number; remaining: number } | null>(null)

  useEffect(() => {
    const consumed = consumeCreditUsedFlash()
    if (!consumed) return
    setFlash(consumed)
    const timer = window.setTimeout(() => setFlash(null), 2000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!flash) return null

  return (
    <div
      role="status"
      // 채점하기 푸터 위 — 폰은 좌우 20px, 패드·웹은 본문 폭(620px)에 맞춰 중앙
      className="fixed bottom-[calc(112px+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100%-40px)] max-w-[620px] -translate-x-1/2 animate-[credit-toast-in_260ms_cubic-bezier(0.22,0.9,0.3,1)] items-center gap-[8px] rounded-[16px] bg-[#40464c] p-[16px] backdrop-blur-[8px]"
    >
      <style>{`
        @keyframes credit-toast-in {
          from { opacity: 0; transform: translate(-50%, 10px) }
          to { opacity: 1; transform: translate(-50%, 0) }
        }
      `}</style>
      <div className="flex min-w-0 flex-1 items-center gap-[8px]">
        <ToastCoinIcon />
        <p className="min-w-0 flex-1 text-[16px] font-semibold leading-[1.4] text-white">
          크레딧 {flash.used}개를 사용했어
        </p>
      </div>
      <p className="shrink-0 text-[14px] font-bold leading-[1.4] text-[#e5e7ea]">
        남은 크레딧 {flash.remaining}
      </p>
    </div>
  )
}

/** 서비스 크레딧 코인 (CreditBadge.CreditCoin 과 동일 그래픽 · 시안 20px) */
function ToastCoinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
      <circle cx="10" cy="10" r="9.2" fill="#F8D558" />
      <circle cx="10" cy="10" r="6.9" stroke="#EC9C40" strokeWidth="1.6" />
      <path
        d="M12.9 7.9a3.4 3.4 0 100 4.2"
        stroke="#E08E39"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

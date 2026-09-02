import { useEffect, useState } from 'react'
import { Toast } from '@/user/components/Toast'

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

  // 플래시 소비와 타이머를 분리 — 한 effect 에 묶으면 StrictMode(dev)가 effect 를
  // 두 번 돌릴 때 첫 실행이 플래시를 지우고 cleanup 이 타이머를 취소한 뒤,
  // 두 번째 실행은 플래시가 없어 타이머를 다시 걸지 않아 토스트가 영영 안 사라진다
  useEffect(() => {
    const consumed = consumeCreditUsedFlash()
    if (consumed) setFlash(consumed)
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2000)
    return () => window.clearTimeout(timer)
  }, [flash])

  return (
    // 답안 바(data-answer-bar) 바로 위 — 바 높이(객관식 5개 + 넘어가기)를 실제로 재서 겹치지 않는다
    <Toast
      show={!!flash}
      anchorSelector="[data-answer-bar]"
      bottom="calc(112px + env(safe-area-inset-bottom))"
      className="flex items-center gap-[8px] rounded-[16px] bg-[#40464c] p-[16px] backdrop-blur-[8px]"
    >
      {flash && (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-[8px]">
            <ToastCoinIcon />
            <p className="min-w-0 flex-1 text-[16px] font-semibold leading-[1.4] text-white">
              크레딧 {flash.used}개를 사용했어
            </p>
          </div>
          <p className="shrink-0 text-[14px] font-bold leading-[1.4] text-[#e5e7ea]">
            남은 크레딧 {flash.remaining}
          </p>
        </>
      )}
    </Toast>
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

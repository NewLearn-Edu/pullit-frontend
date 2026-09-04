import { useEffect, useState } from 'react'
import { CreditCoin } from '@/user/components/CreditBadge/CreditBadge'
import { useUserStore } from '@/user/stores/userStore'

/** 한국은 서머타임이 없어 UTC+9 고정 — 클라이언트 폴백 계산용 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const RESET_HOUR_MS = 4 * 60 * 60 * 1000
const DEFAULT_AMOUNT = 3

/** 서버 값이 없을 때(구버전 서버) 다음 04:00 KST 를 기기 시계로 계산 */
function fallbackNextRefillMs(nowMs: number): number {
  const kst = nowMs + KST_OFFSET_MS
  const dayIndex = Math.floor((kst - RESET_HOUR_MS) / DAY_MS)
  return (dayIndex + 1) * DAY_MS + RESET_HOUR_MS - KST_OFFSET_MS
}

const pad = (n: number) => String(n).padStart(2, '0')
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/**
 * 크레딧 충전 안내 팝업 (2026-09-04) — 홈 크레딧 배지를 누르면 뜬다.
 * 매일 04:00(KST) 무료 +3 까지 남은 시간을 초 단위로 세고, 0 이 되면 잔액을 다시 받아 배지를 갱신한다.
 * 기준 시각은 서버가 준 nextDailyCreditAtMs(epoch) — 기기 시계·시간대가 틀려도 서버 기준으로 센다.
 * 모바일 바텀시트 · 패드/웹 중앙 다이얼로그 (ScoreInfoSheet 와 같은 조판)
 */
export function CreditRefillPopup({ onClose }: { onClose: () => void }) {
  const me = useUserStore((s) => s.me)
  const loadMe = useUserStore((s) => s.loadMe)
  const amount = me?.dailyCreditAmount ?? DEFAULT_AMOUNT

  // 서버 시각과 기기 시각의 차이는 남은 시간 표시에만 영향 — 서버 ms 를 그대로 쓴다
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const targetMs = me?.nextDailyCreditAtMs ?? fallbackNextRefillMs(nowMs)
  const remaining = targetMs - nowMs

  // 충전 시각을 지나면 잔액·다음 시각을 서버에서 다시 받는다 (지급은 /me 조회 때 서버가 넣는다)
  const [refreshedFor, setRefreshedFor] = useState<number | null>(null)
  useEffect(() => {
    if (remaining > 0 || refreshedFor === targetMs) return
    setRefreshedFor(targetMs)
    void loadMe(true)
  }, [remaining, targetMs, refreshedFor, loadMe])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-refill-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-[20px] max-md:items-end max-md:p-0"
    >
      <style>{`
        @keyframes pi-refill-fade { from { opacity: 0 } }
        @keyframes pi-refill-pop { from { opacity: 0; transform: scale(0.94) translateY(10px) } }
        @keyframes pi-refill-rise { from { transform: translateY(100%) } }
      `}</style>
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 animate-[pi-refill-fade_200ms_ease] bg-[rgba(21,17,18,0.38)]"
      />

      <div className="relative w-full max-w-[400px] animate-[pi-refill-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[24px] bg-white p-[20px] shadow-[0px_-16px_25px_rgba(0,0,0,0.12)] max-md:max-w-none max-md:animate-[pi-refill-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[32px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="mb-[16px] hidden justify-center max-md:flex">
          <span className="h-[5px] w-[42px] rounded-full bg-[#d6d8db]" />
        </div>

        <h2 id="credit-refill-title" className="text-[20px] font-semibold leading-[1.4] text-[#121417]">
          크레딧 충전까지
        </h2>

        {/* 남은 시간 — 초 단위 카운트다운 */}
        <div className="mt-[16px] flex items-center justify-center gap-[10px] rounded-[16px] bg-[#f8f8f8] py-[24px]">
          <CreditCoin />
          <span className="text-[36px] font-bold leading-none tabular-nums text-[#121417]">
            {remaining > 0 ? formatRemaining(remaining) : '충전 중…'}
          </span>
        </div>

        <ul className="mt-[16px] list-disc pl-[20px] text-[14px] font-medium leading-[1.6] text-[#5e6368]">
          <li>오전 4시 00분에 {amount}개 충전</li>
          <li>지금 잔액 {me?.creditBalance ?? 0}개 · 문제 세트 1개 = 3개</li>
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-[20px] flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90"
        >
          확인
        </button>
      </div>
    </div>
  )
}

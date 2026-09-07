import { useEffect, useState } from 'react'
import { CreditCoin } from '@/user/components/CreditBadge/CreditBadge'
import { InviteShareSheet } from '@/user/components/InviteShareSheet/InviteShareSheet'
import { Toast } from '@/user/components/Toast'
import { useInviteUrl } from '@/user/hooks/useInviteUrl'
import { GuestSignupPopup } from '@/user/components/GuestSignupPopup'
import { SET_CREDIT_COST } from '@/user/stores/trialProgressStore'
import { useUserStore } from '@/user/stores/userStore'

/** 한국은 서머타임이 없어 UTC+9 고정 — 클라이언트 폴백 계산용 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const RESET_HOUR_MS = 4 * 60 * 60 * 1000
const DEFAULT_AMOUNT = 3
/** 초대한 친구가 가입하면 초대자에게 주는 크레딧 (백엔드 InviteReward 와 동일) */
const INVITE_REWARD = 5

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
 *
 * 하단은 [닫기] [초대하기] — 초대하기는 마이페이지·크레딧 내역과 같은 초대 공유 시트(카카오톡 / 링크복사)를
 * 이 팝업 위에 띄운다 (2026-09-07). 게스트는 매일 충전·초대 대상이 아니라 가입 유도 팝업(GuestSignupPopup)으로 대체.
 */
export function CreditRefillPopup({ onClose }: { onClose: () => void }) {
  const me = useUserStore((s) => s.me)
  const loadMe = useUserStore((s) => s.loadMe)
  const amount = me?.dailyCreditAmount ?? DEFAULT_AMOUNT

  // 친구 초대 — 코드가 실린 링크가 준비됐을 때만 시트를 연다 (코드 없는 링크 금지 · useInviteUrl)
  const isMember = me?.type === 'USER'
  const invite = useInviteUrl(isMember)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState(false)
  useEffect(() => {
    if (!inviteError) return
    const t = window.setTimeout(() => setInviteError(false), 2400)
    return () => window.clearTimeout(t)
  }, [inviteError])
  const openInvite = async () => {
    const url = await invite.ensure()
    if (url) setShareUrl(url)
    else setInviteError(true)
  }

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

  // 게스트 — 배지를 눌러도 크레딧 부족 팝업과 같은 가입 유도 한 장 (2026-09-07)
  if (!isMember) return <GuestSignupPopup required={SET_CREDIT_COST} onClose={onClose} />

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

      <div className="relative w-full max-w-[400px] animate-[pi-refill-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[24px] bg-white px-[20px] pb-[20px] pt-[40px] shadow-[0px_-16px_25px_rgba(0,0,0,0.12)] max-md:max-w-none max-md:animate-[pi-refill-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[32px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="mb-[16px] hidden justify-center max-md:flex">
          <span className="h-[5px] w-[42px] rounded-full bg-[#d6d8db]" />
        </div>

        <h2 id="credit-refill-title" className="text-center text-[20px] font-semibold leading-[1.4] text-[#121417]">
          크레딧 충전까지
        </h2>

        {/* 남은 시간 — 초 단위 카운트다운 */}
        <div className="mt-[16px] flex items-center justify-center gap-[10px] rounded-[16px] bg-[#f8f8f8] py-[24px]">
          <CreditCoin />
          <span className="text-[36px] font-bold leading-none tabular-nums text-[#121417]">
            {remaining > 0 ? formatRemaining(remaining) : '충전 중…'}
          </span>
        </div>

        {/* 안내 2줄 — 제목·타이머와 같이 가운데 정렬 (불릿 없이) */}
        <ul className="mt-[16px] text-center text-[14px] font-medium leading-[1.6] text-[#5e6368]">
          <li>오전 4시 00분에 {amount}개 충전</li>
          <li>초대한 친구가 가입하면 {INVITE_REWARD}개 충전</li>
        </ul>

        <div className="mt-[20px] flex gap-[8px]">
          <button
            type="button"
            onClick={onClose}
            className="flex h-[52px] flex-1 items-center justify-center rounded-[12px] border border-[#e5e7ea] bg-white text-[16px] font-bold text-[#121417] transition-colors hover:bg-[#f8f8f8]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={openInvite}
            disabled={invite.loading}
            className="flex h-[52px] flex-1 items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            초대하기
          </button>
        </div>
      </div>

      {/* 초대 공유 시트 — 팝업 위에 겹쳐 뜬다. 닫으면 이 팝업으로 돌아온다 */}
      {shareUrl && <InviteShareSheet url={shareUrl} onClose={() => setShareUrl(null)} />}
      <Toast
        show={inviteError}
        role="alert"
        className="flex items-center gap-[8px] rounded-[14px] bg-[#23272b] px-[16px] py-[14px] text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
      >
        초대 링크를 불러오지 못했어. 다시 눌러줘
      </Toast>
    </div>
  )
}

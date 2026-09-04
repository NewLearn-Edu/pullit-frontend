import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { PageHeader } from '@/user/components/PageHeader'
import { Toast } from '@/user/components/Toast'
import { withdrawAccount } from '@/user/api/authApi'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { WITHDRAWAL_REASONS, type WithdrawalReason } from '@/user/data/withdrawalReasons'
import { clearLocalTraces } from '@/user/utils/localTraces'
import { isStandaloneApp } from '@/user/utils/standalone'

/**
 * 회원 탈퇴 화면 (/my/withdraw · 2026-09-04) — 마이페이지 "그래도 탈퇴하기" 다음 단계.
 *
 * 흐름: 안내 → 탈퇴 사유 선택(필수, 바텀시트 · 웹은 중앙 다이얼로그) → "기타"면 상세 입력(선택)
 * → 탈퇴하기 → 서버 소프트 삭제(사유 저장) → 로컬 흔적 정리 → 웹앱은 /login, 웹은 랜딩.
 * 안내 문구는 실제 정책(30일 유예 · 재로그인 복구)을 그대로 말한다.
 */
export default function WithdrawPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const clearSession = useUserStore((s) => s.clear)

  // 게스트는 탈퇴 개념 없음(7일 미접속 자동 삭제) — 마이페이지로
  useEffect(() => {
    if (me?.type === 'GUEST') navigate('/my', { replace: true })
  }, [me, navigate])

  const [reason, setReason] = useState<WithdrawalReason | null>(null)
  const [detail, setDetail] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(() => setError(null), 2400)
    return () => window.clearTimeout(t)
  }, [error])

  const reasonLabel = WITHDRAWAL_REASONS.find((r) => r.code === reason)?.label ?? null
  const canSubmit = reason != null && !submitting

  const submit = async () => {
    if (!canSubmit || !reason) return
    setSubmitting(true)
    try {
      await withdrawAccount(reason, reason === 'OTHER' ? detail : undefined)
      clearLocalTraces()
      clearSession()
      // 전체 리로드 — zustand 메모리 상태가 스토리지를 다시 쓰지 않게. 웹앱은 회원 전용이라 로그인으로
      window.location.replace(isStandaloneApp() ? '/login' : '/')
    } catch {
      setSubmitting(false)
      setError('탈퇴에 실패했어. 잠시 후 다시 시도해줘')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PageHeader backTo="/my" />

      <main className="flex w-full flex-1 flex-col items-center px-[20px] pb-[140px]">
        <div className="flex w-full max-w-[620px] flex-col gap-[20px] pt-[8px]">
          <h1 className="break-keep text-[22px] font-bold leading-[1.4] text-[#121417]">
            풀잇을 탈퇴하기 전에
            <br />
            확인해주세요
          </h1>

          <p className="flex items-start gap-[6px] text-[13px] font-medium leading-[1.5] text-[#80858b]">
            <span className="mt-[2px] flex size-[16px] shrink-0 items-center justify-center rounded-full bg-[#d6d8db] text-[10px] font-bold text-white">
              !
            </span>
            <span className="break-keep">
              탈퇴하면 30일 뒤 계정과 풀이 기록·크레딧이 완전히 삭제돼. 그 전에 같은 계정으로 다시 로그인하면
              그대로 복구할 수 있어.
            </span>
          </p>

          {/* 탈퇴 사유 — 선택 필수 */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            className={clsx(
              'flex h-[56px] w-full items-center justify-between rounded-[12px] border px-[16px] text-left text-[15px] font-medium transition-colors',
              reason ? 'border-[#121417] text-[#121417]' : 'border-[#d6d8db] text-[#a6abb1]',
            )}
          >
            <span>{reasonLabel ?? '탈퇴 사유를 선택해주세요'}</span>
            <ChevronDownIcon />
          </button>

          {reason === 'OTHER' && (
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 200))}
              placeholder="어떤 점이 아쉬웠는지 알려주면 더 나아지는 데 큰 도움이 돼 (선택)"
              rows={4}
              className="w-full resize-none rounded-[12px] border border-[#d6d8db] px-[16px] py-[14px] text-[15px] leading-[1.5] text-[#121417] outline-none placeholder:text-[#a6abb1] focus:border-[#121417]"
            />
          )}
        </div>
      </main>

      {/* 하단 고정 CTA — 사유를 고르기 전엔 비활성 */}
      <div className="fixed inset-x-0 bottom-0 flex justify-center bg-white px-[20px] pb-[max(20px,env(safe-area-inset-bottom))] pt-[12px]">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={clsx(
            'h-[56px] w-full max-w-[620px] rounded-[12px] text-[16px] font-bold transition-colors',
            canSubmit ? 'bg-[#23272b] text-white hover:opacity-90' : 'bg-[#f0f1f3] text-[#a6abb1]',
          )}
        >
          {submitting ? '탈퇴 처리 중…' : '탈퇴하기'}
        </button>
      </div>

      {/* 사유 선택 — 모바일 바텀시트 · 웹(xl)은 중앙 다이얼로그 */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 xl:items-center xl:p-[20px]"
          onClick={() => setPickerOpen(false)}
        >
          <div
            role="dialog"
            aria-label="탈퇴 사유 선택"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[620px] animate-[withdraw-sheet-up_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-t-[24px] bg-white px-[20px] pb-[max(20px,env(safe-area-inset-bottom))] pt-[24px] xl:max-w-[420px] xl:rounded-[24px] xl:pb-[20px]"
          >
            <h2 className="mb-[8px] text-[18px] font-bold text-[#121417]">탈퇴 사유를 선택해주세요</h2>
            <ul role="listbox" className="flex flex-col">
              {WITHDRAWAL_REASONS.map((r) => {
                const selected = r.code === reason
                return (
                  <li key={r.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setReason(r.code)
                        setPickerOpen(false)
                      }}
                      className="flex h-[52px] w-full items-center justify-between text-left text-[15px] font-medium text-[#121417]"
                    >
                      <span>{r.label}</span>
                      {selected && <CheckIcon />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <style>{`@keyframes withdraw-sheet-up { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        </div>
      )}

      <Toast
        show={!!error}
        role="alert"
        bottom="calc(96px + env(safe-area-inset-bottom))"
        className="flex items-center gap-[8px] rounded-[14px] bg-[#23272b] px-[16px] py-[14px] text-[14px] font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
      >
        {error}
      </Toast>
    </div>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <span className="flex size-[22px] items-center justify-center rounded-full bg-[#ff385c]" aria-hidden>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="m2.5 6.2 2.4 2.3 4.6-4.8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

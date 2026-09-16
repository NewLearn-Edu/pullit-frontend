import { useState } from 'react'
import { updateSchool } from '@/user/api/schoolApi'
import { useUserStore } from '@/user/stores/userStore'
import { SchoolPicker, type SchoolChoice } from './SchoolPicker'

/** "나중에" 를 누른 뒤 다시 묻기까지 — 7일. 브라우저별 편의값이라 localStorage (학교 유무 자체는 서버 /me 가 진실원) */
export const SCHOOL_PROMPT_SNOOZE_KEY = 'pullit_school_prompt_snoozed_until'
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export function isSchoolPromptSnoozed(): boolean {
  try {
    return Number(localStorage.getItem(SCHOOL_PROMPT_SNOOZE_KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}
function snoozeSchoolPrompt() {
  try {
    localStorage.setItem(SCHOOL_PROMPT_SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
  } catch {
    /* noop */
  }
}

/**
 * 학교 입력 안내 팝업 (2026-09-14 · AI-314) — 학교 정보가 없는 기존 회원에게 홈 진입 시 1회.
 * 모바일 바텀시트 · 패드/웹 중앙 다이얼로그 (CreditRefillPopup 과 같은 조판).
 * [나중에] → 7일 뒤 다시 · [저장] → PATCH /me/school → /me 재조회 → 닫힘
 */
export function SchoolPromptPopup({ onClose }: { onClose: () => void }) {
  const loadMe = useUserStore((s) => s.loadMe)
  const [choice, setChoice] = useState<SchoolChoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const later = () => {
    snoozeSchoolPrompt()
    onClose()
  }
  const save = async () => {
    if (!choice || saving) return
    setSaving(true)
    setError(null)
    try {
      await updateSchool(choice.school ? { schoolId: choice.school.id } : { noneReason: choice.noneReason })
      await loadMe(true)
      onClose()
    } catch {
      setError('저장에 실패했어. 잠시 후 다시 시도해줘')
      setSaving(false)
    }
  }

  return (
    // 이어풀기 팝업(PI-POPUP-RESUME)과 같은 조판 — 전 기기 중앙 다이얼로그. 예전엔 폰에서만 바텀시트라 둘이 달라 보였다 (2026-09-16)
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.2)] px-[20px]"
    >
      <style>{`@keyframes pi-school-pop { from { opacity: 0; transform: scale(0.94) translateY(10px) } }`}</style>
      <div className="flex w-[335px] max-w-full animate-[pi-school-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] flex-col items-center gap-[16px] rounded-[24px] bg-white px-[20px] py-[34px] shadow-[0px_0px_7px_rgba(0,0,0,0.21)] md:w-[460px] md:gap-[20px] md:px-[32px] md:py-[40px]" /* 패드·PC 는 넓게 (2026-09-16) */>
        <h2 id="school-prompt-title" className="text-[18px] font-bold leading-[1.4] text-[#121417]">
          어느 학교에 다녀?
        </h2>
        <div className="flex w-full flex-col items-center gap-[24px]">
          <p className="text-center text-[16px] font-medium leading-[1.4] text-[#121417]">
            같은 학교 친구들과 비교하는 기능을
            <br />
            준비하고 있어. 미리 알려줄래?
          </p>

          <div className="w-full">
            <SchoolPicker value={choice} onChange={setChoice} />
            {error && <p className="mt-[8px] text-center text-[13px] text-[#ff385c]">{error}</p>}
          </div>

          <div className="flex w-full gap-[8px]">
            <button
              type="button"
              onClick={later}
              className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#f8f8f8] text-[16px] font-bold text-[#121417]"
            >
              나중에
            </button>
            <button
              type="button"
              disabled={!choice || saving}
              onClick={save}
              className="flex h-[56px] min-w-0 flex-1 items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:bg-[#e3e5e8] disabled:text-[#a6abb1]"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-prompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-[20px] max-md:items-end max-md:p-0"
    >
      <style>{`
        @keyframes pi-school-fade { from { opacity: 0 } }
        @keyframes pi-school-pop { from { opacity: 0; transform: scale(0.94) translateY(10px) } }
        @keyframes pi-school-rise { from { transform: translateY(100%) } }
      `}</style>
      <button type="button" aria-label="닫기" onClick={later} className="absolute inset-0 animate-[pi-school-fade_200ms_ease] bg-[rgba(21,17,18,0.38)]" />

      <div className="relative w-full max-w-[440px] animate-[pi-school-pop_260ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[24px] bg-white px-[20px] pb-[20px] pt-[32px] shadow-[0px_-16px_25px_rgba(0,0,0,0.12)] max-md:max-w-none max-md:animate-[pi-school-rise_300ms_cubic-bezier(0.22,0.9,0.3,1)] max-md:rounded-b-none max-md:rounded-t-[32px] max-md:pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="mb-[16px] hidden justify-center max-md:flex">
          <span className="h-[5px] w-[42px] rounded-full bg-[#d6d8db]" />
        </div>

        <h2 id="school-prompt-title" className="text-center text-[20px] font-semibold leading-[1.4] text-[#121417]">
          어느 학교에 다녀?
        </h2>
        <p className="mt-[8px] text-center text-[14px] leading-[1.6] text-[#5e6368]">
          학교를 알려주면 같은 학교 친구들과
          <br />
          비교한 결과를 보여줄 수 있어
        </p>

        <div className="mt-[20px]">
          <SchoolPicker value={choice} onChange={setChoice} />
        </div>
        {error && <p className="mt-[8px] text-center text-[13px] text-[#ff385c]">{error}</p>}

        <div className="mt-[20px] flex gap-[8px]">
          <button type="button" onClick={later} className="h-[54px] flex-1 rounded-[12px] bg-[#f2f4f6] text-[15px] font-semibold text-[#5e6368] transition-colors hover:bg-[#e8ebee]">
            나중에
          </button>
          <button
            type="button"
            disabled={!choice || saving}
            onClick={save}
            className="h-[54px] flex-[1.4] rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:bg-[#e3e5e8] disabled:text-[#a6abb1]"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

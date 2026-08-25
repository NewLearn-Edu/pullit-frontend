import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { clsx } from 'clsx'
import { PageHeader } from '@/user/components/PageHeader'
import { updateNickname } from '@/user/api/authApi'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'

/** 닉네임 허용 문자 — 완성형 한글·영문·숫자 (자모 단독·공백·특수문자 불가, 서버와 동일) */
const NICKNAME_CHARS = /^[가-힣a-zA-Z0-9]*$/
const NICKNAME_MIN = 2
const NICKNAME_MAX = 10
/** 재변경 잠금 기간 — 서버 UserService.NICKNAME_LOCK_DAYS 와 동일하게 유지 */
const LOCK_DAYS = 90

/**
 * 프로필 편집 (/my/profile · 토스 프로필 편집 참고 2026-08-25)
 * 아바타 + 닉네임 단일 폼. 닉네임은 90일에 한 번만 변경 가능 (서버 검증이 진실원).
 */
export default function ProfileEditPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const loadMe = useUserStore((s) => s.loadMe)

  // 세션 필요 + 게스트는 프로필 없음 — 마이페이지로 되돌림
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true })
    else if (me?.type === 'GUEST') navigate('/my', { replace: true })
  }, [sessionStatus, me, navigate])

  const currentNickname = me?.nickname ?? ''
  const [value, setValue] = useState<string | null>(null) // null = 아직 미입력 (me 로드 전)
  const nickname = value ?? currentNickname

  // 90일 잠금 — 마지막 변경 + 90일이 아직 안 지났으면 입력 자체를 잠근다
  const lockedDaysLeft = useMemo(() => {
    if (!me?.nicknameChangedAt) return 0
    const unlockAt = new Date(me.nicknameChangedAt)
    unlockAt.setDate(unlockAt.getDate() + LOCK_DAYS)
    const msLeft = unlockAt.getTime() - Date.now()
    return msLeft > 0 ? Math.ceil(msLeft / 86_400_000) : 0
  }, [me?.nicknameChangedAt])
  const locked = lockedDaysLeft > 0

  const hasInvalidChar = !NICKNAME_CHARS.test(nickname)
  const changed = nickname !== currentNickname
  const canSave =
    !locked &&
    changed &&
    !hasInvalidChar &&
    nickname.length >= NICKNAME_MIN &&
    nickname.length <= NICKNAME_MAX

  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setServerError(null)
    try {
      await updateNickname(nickname)
      await loadMe(true) // 새 닉네임·nicknameChangedAt 반영
      navigate('/my', { replace: true })
    } catch (e) {
      // 서버 메시지가 곧 UX 카피 (중복·잠금·형식) — 그대로 노출
      const message = isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : null
      setServerError(message ?? '저장에 실패했어요. 잠시 후 다시 시도해주세요')
      setSaving(false)
    }
  }

  // 표시 우선순위: 문자 오류(빨강) > 서버 오류(빨강) > 잠금 안내 > 기본 안내
  const error = hasInvalidChar ? '사용할 수 없는 문자가 포함되어 있어요.' : serverError
  const helper = locked
    ? `닉네임은 ${lockedDaysLeft}일 뒤에 다시 바꿀 수 있어요.`
    : '지금 바꾸면 90일 동안 다시 바꿀 수 없어요.'

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PageHeader backTo="history" center={<span className="text-[17px] font-bold text-[#121417]">프로필 편집</span>} />

      <main className="mx-auto flex w-full max-w-[620px] flex-1 flex-col items-center px-[20px] pb-[120px]">
        {/* 아바타 + 편집 배지 — 이미지 변경은 준비 전 */}
        <div className="relative mt-[32px]">
          <span className="flex size-[88px] items-center justify-center rounded-full bg-[#fff1f2] text-[44px]">
            🦊
          </span>
          <span
            aria-hidden
            className="absolute -bottom-[2px] -right-[2px] flex size-[28px] items-center justify-center rounded-full border border-[#e5e7ea] bg-white"
          >
            <PencilIcon />
          </span>
        </div>

        {/* 닉네임 필드 */}
        <div className="mt-[36px] flex w-full flex-col gap-[8px]">
          <label
            htmlFor="nickname"
            className={clsx('text-[13px] font-semibold', error ? 'text-danger' : 'text-[#5e6368]')}
          >
            닉네임
          </label>
          <div
            className={clsx(
              'flex h-[52px] items-center gap-[8px] rounded-[14px] px-[16px] transition-colors',
              error ? 'bg-[#fff1f2]' : 'bg-[#f2f4f6]',
              locked && 'opacity-60',
            )}
          >
            <input
              id="nickname"
              value={nickname}
              maxLength={NICKNAME_MAX}
              disabled={locked}
              placeholder="닉네임 입력 (2~10자)"
              onChange={(e) => {
                setServerError(null)
                setValue(e.target.value)
              }}
              className={clsx(
                'min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none placeholder:text-[#a6abb1]',
                error ? 'text-danger' : 'text-[#121417]',
              )}
            />
            {!locked && nickname.length > 0 && (
              <button
                type="button"
                aria-label="지우기"
                onClick={() => {
                  setServerError(null)
                  setValue('')
                }}
                className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-[#c6cacf] text-white"
              >
                <ClearIcon />
              </button>
            )}
          </div>
          <p className={clsx('text-[13px]', error ? 'font-medium text-danger' : 'text-[#80858b]')}>
            {error ?? helper}
          </p>
        </div>
      </main>

      {/* 저장 — 하단 고정 (모든 구간 공통, 620px 컬럼 정렬) */}
      <footer className="fixed inset-x-0 bottom-0 flex min-w-[350px] justify-center bg-white px-[20px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-[12px]">
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={save}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:bg-[#e3e5e8] disabled:text-[#a6abb1]"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </footer>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.9 2.6a1.5 1.5 0 0 1 2.1 0l1.4 1.4a1.5 1.5 0 0 1 0 2.1L6.3 13.2l-3.6.9.9-3.6 6.3-7.9z"
        fill="#5e6368"
      />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

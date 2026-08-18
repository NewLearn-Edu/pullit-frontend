import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import {
  completeProfile,
  confirmPhoneCode,
  loginWithApple,
  logout,
  requestPhoneCode,
  startGoogleLogin,
  startKakaoLogin,
  startNaverLogin,
  type PhoneVerifyResult,
} from '@/user/api/authApi'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { finishLogin } from '@/user/services/finishLogin'
import { useUserStore } from '@/user/stores/userStore'
import { consumePostLoginRedirect } from '@/user/utils/postLoginRedirect'
import OnboardingHeader from '@/user/components/OnboardingHeader'

/**
 * 가입 추가 정보 입력 (/signup/info) — 소셜 로그인 직후 프로필 완성 단계.
 *
 * 연령 게이트(A안): 생년월일로 만 14세 미만을 확인한다.
 * "만 14세 이상입니다" 체크박스보다 강한 확인 절차 — 중2(만 13세) 타깃과 겹치는
 * 서비스 특성상 자기선언만으로는 방어력이 약하다는 판단 (2026-08-06 정책 확정).
 * 14세 미만이면 서버가 소셜에서 받은 정보를 즉시 파기하고 403 을 반환하며,
 * 이 화면은 안내 후 게스트 체험으로 유도한다. 보호자 동의 플로우는 정식 서비스 전 과제.
 */
export default function SignupInfoPage() {
  const navigate = useNavigate()
  const me = useUserStore((s) => s.me)
  const loadMe = useUserStore((s) => s.loadMe)
  const clearSession = useUserStore((s) => s.clear)

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  // 전화번호 SMS 인증 상태
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [cooldown, setCooldown] = useState(0) // 재발송 남은 초
  const [expireLeft, setExpireLeft] = useState(0) // 인증번호 유효 남은 초 (서버 3분과 동일)
  // 안내/오류 메시지 — tone 이 error 면 해당 field 인풋에 빨간 테두리 + 빨간 문구
  const [phoneMsg, setPhoneMsg] = useState<{ text: string; tone: 'info' | 'error'; field: 'phone' | 'code' } | null>(null)
  // 인증은 통과했지만 이미 다른 계정이 쓰는 번호 — 기존 소셜 로그인으로 유도
  const [dupProvider, setDupProvider] = useState<Pick<PhoneVerifyResult, 'provider' | 'providerName'> | null>(null)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false) // 만 14세 미만 차단됨

  // 회원이 아니면 올 수 없는 화면 (게스트·비로그인은 로그인으로)
  useEffect(() => {
    loadMe().then((loaded) => {
      if (!loaded || loaded.type !== 'USER') navigate('/login', { replace: true })
      else if (loaded.phoneNumber && loaded.birthDate) navigate('/home', { replace: true })
      else if (loaded.name) setName((prev) => prev || loaded.name!) // 소셜 이름 프리필 (수정 가능)
    })
  }, [loadMe, navigate])

  /** 숫자만 남기고 010-0000-0000 형태로 자동 하이픈. 번호가 바뀌면 인증 무효 */
  const handlePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    const parts = [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)].filter(Boolean)
    setPhone(parts.join('-'))
    setPhoneVerified(false)
    setCodeSent(false)
    setCode('')
    setExpireLeft(0)
    setPhoneMsg(null)
    setDupProvider(null)
  }

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // 인증번호 유효시간 카운트다운 (3:00 → 0:00)
  useEffect(() => {
    if (expireLeft <= 0 || phoneVerified) return
    const t = setTimeout(() => setExpireLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [expireLeft, phoneVerified])

  const expired = codeSent && !phoneVerified && expireLeft <= 0
  const expireLabel = `${Math.floor(expireLeft / 60)}:${String(expireLeft % 60).padStart(2, '0')}`

  const sendCode = async () => {
    setPhoneMsg(null)
    setDupProvider(null)
    try {
      await requestPhoneCode(phone)
      setCodeSent(true)
      setCode('')
      setCooldown(60)
      setExpireLeft(180) // 서버 PhoneVerification.EXPIRES_MINUTES(3분)와 동일하게 유지
      setPhoneMsg({ text: '인증번호를 보냈어요. 3분 안에 입력해주세요.', tone: 'info', field: 'phone' })
    } catch (e) {
      const errCode = isAxiosError(e) ? e.response?.data?.errorCode : null
      setPhoneMsg({
        text: errCode === 'U012' ? '잠시 후 다시 요청해주세요.' : '발송에 실패했어요. 번호를 확인해주세요.',
        tone: 'error',
        field: 'phone',
      })
    }
  }

  const verifyCode = async () => {
    setPhoneMsg(null)
    try {
      const result = await confirmPhoneCode(phone, code)
      if (result.duplicated) {
        // 번호 소유는 증명됐지만 이미 다른 계정의 번호 — 기존 계정 로그인으로 유도
        setCodeSent(false)
        setDupProvider({ provider: result.provider, providerName: result.providerName })
        setPhoneMsg({
          text: result.providerName
            ? `이미 ${result.providerName} 계정으로 가입된 번호예요.`
            : '이미 가입된 번호예요. 기존 계정으로 로그인해주세요.',
          tone: 'error',
          field: 'phone',
        })
        return
      }
      setPhoneVerified(true)
    } catch (e) {
      const errCode = isAxiosError(e) ? e.response?.data?.errorCode : null
      setPhoneMsg({
        text:
          errCode === 'U014' ? '인증번호가 만료됐어요. 다시 받아주세요.'
          : errCode === 'U015' ? '시도 횟수를 초과했어요. 인증번호를 다시 받아주세요.'
          : '인증번호가 일치하지 않아요.',
        tone: 'error',
        field: 'code',
      })
    }
  }

  /** 기존 가입 소셜로 바로 로그인 — OAuth 는 소셜 식별자 기준이라 자동으로 그 계정에 로그인된다 */
  const continueWithExisting = async () => {
    if (!dupProvider) return
    if (dupProvider.provider === 'KAKAO') startKakaoLogin()
    else if (dupProvider.provider === 'NAVER') startNaverLogin()
    else if (dupProvider.provider === 'GOOGLE') startGoogleLogin()
    else if (dupProvider.provider === 'APPLE') {
      try {
        await loginWithApple()
        const to = await finishLogin()
        navigate(to, { replace: true })
      } catch (e) {
        if ((e as { error?: string })?.error === 'popup_closed_by_user') return
        setPhoneMsg({ text: 'Apple 로그인에 실패했어요. 다시 시도해주세요.', tone: 'error', field: 'phone' })
      }
    } else navigate('/login', { replace: true })
  }

  const phoneHasError = phoneMsg?.tone === 'error' && phoneMsg.field === 'phone'
  const codeHasError = phoneMsg?.tone === 'error' && phoneMsg.field === 'code'

  const nameValid = name.trim().length >= 2
  const phoneValid = /^01[0-9]-\d{3,4}-\d{4}$/.test(phone)
  const birthValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate)
  const canSubmit = nameValid && birthValid && phoneVerified && agreeTerms && agreePrivacy && !pending

  const allChecked = agreeTerms && agreePrivacy
  const toggleAll = () => {
    const next = !allChecked
    setAgreeTerms(next)
    setAgreePrivacy(next)
  }

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    setError(null)
    try {
      await completeProfile({ name: name.trim(), birthDate, phoneNumber: phone, agreeTerms, agreePrivacy })
      await loadMe(true) // phoneNumber 채워진 상태 반영
      flushAttemptQueue()
      navigate(consumePostLoginRedirect() ?? '/home', { replace: true })
    } catch (e) {
      const errCode = isAxiosError(e) ? e.response?.data?.errorCode : null
      if (errCode === 'U010') {
        // 만 14세 미만 — 서버가 계정을 이미 파기했으므로 프론트도 세션 정리
        setBlocked(true)
        await logout().catch(() => {})
        clearSession()
      } else if (errCode === 'U017') {
        setError('이미 가입된 전화번호예요. 기존 계정으로 로그인해주세요.')
      } else {
        setError('저장에 실패했어요. 입력 내용을 확인하고 다시 시도해주세요.')
      }
    } finally {
      setPending(false)
    }
  }

  // ── 만 14세 미만 안내 화면 ──────────────────────────────────────────
  if (blocked) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <OnboardingHeader onClose={() => navigate('/', { replace: true })} />
        <main className="flex w-full flex-1 flex-col items-center justify-center px-[40px] max-md:px-lg">
          <div className="flex w-full max-w-[620px] flex-col items-center gap-md text-center">
            <h1 className="break-keep text-[24px] font-bold text-[#121417] max-md:text-[22px]">
              만 14세 미만은 보호자 동의가 필요해요
            </h1>
            <p className="break-keep text-[16px] text-[#5e6368] max-md:text-[15px]">
              보호자 동의 가입은 준비 중이에요.
              <br />
              지금은 가입 없이 문제 풀이와 약점 진단을 이용할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => navigate('/trial', { replace: true })}
              className="mt-lg flex h-[56px] w-full max-w-[400px] items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90"
            >
              비회원으로 계속하기
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── 추가 정보 입력 폼 ───────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <OnboardingHeader
        onClose={async () => {
          // 프로필 미완성 회원은 홈 이용이 막히므로, 닫기 = 로그아웃 후 랜딩으로
          await logout().catch(() => {})
          clearSession()
          navigate('/', { replace: true })
        }}
      />

      <main className="flex w-full flex-1 flex-col items-center px-[40px] py-[40px] max-md:px-lg max-md:py-xl">
        <div className="flex w-full max-w-[620px] flex-col gap-md">
          <h1 className="break-keep text-[24px] font-bold text-[#121417] max-md:text-[22px]">
            거의 다 왔어!
          </h1>
          <p className="break-keep text-[16px] text-[#5e6368] max-md:text-[15px]">
            {me?.name ? `${me.name}님, ` : ''}학습 알림을 위해 몇 가지만 더 알려줘
          </p>

          <div className="mt-lg flex flex-col gap-lg">
            <label className="flex flex-col gap-sm">
              <span className="text-[14px] font-semibold text-[#23272b]">이름</span>
              <input
                type="text"
                autoComplete="name"
                placeholder="이름을 입력해주세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-[56px] rounded-[12px] border border-[#ebedf0] px-[16px] text-[16px] text-[#121417] outline-none placeholder:text-[#a6abb1] focus:border-[#a6abb1]"
              />
            </label>

            <label className="flex flex-col gap-sm">
              <span className="text-[14px] font-semibold text-[#23272b]">생년월일</span>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="h-[56px] rounded-[12px] border border-[#ebedf0] px-[16px] text-[16px] text-[#121417] outline-none focus:border-[#a6abb1]"
              />
            </label>

            <div className="flex flex-col gap-sm">
              <span className="text-[14px] font-semibold text-[#23272b]">휴대폰 번호</span>
              <div className="flex gap-sm">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9-]*"
                  autoComplete="tel-national"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={(e) => handlePhone(e.target.value)}
                  disabled={phoneVerified}
                  className={`h-[56px] min-w-0 flex-1 rounded-[12px] border px-[16px] text-[16px] text-[#121417] outline-none placeholder:text-[#a6abb1] disabled:bg-[#f7f8f9] disabled:text-[#80858b] ${
                    phoneHasError ? 'border-danger focus:border-danger' : 'border-[#ebedf0] focus:border-[#a6abb1]'
                  }`}
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={!phoneValid || phoneVerified || cooldown > 0}
                  className="h-[56px] shrink-0 rounded-[12px] border border-[#23272b] px-[18px] text-[15px] font-semibold text-[#23272b] disabled:border-[#ebedf0] disabled:text-[#a6abb1]"
                >
                  {phoneVerified
                    ? '인증 완료'
                    : cooldown > 0
                      ? `재발송 ${cooldown}초`
                      : codeSent
                        ? '다시 받기'
                        : '인증번호 받기'}
                </button>
              </div>

              {/* 인증번호 입력 — 발송 후에만 노출, 인증 완료 시 숨김 */}
              {codeSent && !phoneVerified && (
                <div className="flex gap-sm">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="인증번호 6자리"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        if (codeHasError) setPhoneMsg(null) // 다시 입력하기 시작하면 오류 표시 해제
                      }}
                      disabled={expired}
                      className={`h-[56px] w-full rounded-[12px] border px-[16px] pr-[64px] text-[16px] tracking-[4px] text-[#121417] outline-none placeholder:tracking-normal placeholder:text-[#a6abb1] disabled:bg-[#f7f8f9] disabled:text-[#a6abb1] ${
                        codeHasError ? 'border-danger focus:border-danger' : 'border-[#ebedf0] focus:border-[#a6abb1]'
                      }`}
                    />
                    <span
                      className={`absolute right-[16px] top-1/2 -translate-y-1/2 text-[14px] font-semibold tabular-nums ${expired ? 'text-[#a6abb1]' : 'text-danger'}`}
                    >
                      {expired ? '만료' : expireLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={code.length !== 6 || expired}
                    className="h-[56px] shrink-0 rounded-[12px] bg-[#23272b] px-[24px] text-[15px] font-semibold text-white disabled:opacity-30"
                  >
                    확인
                  </button>
                </div>
              )}

              {phoneVerified && (
                <p className="text-[13px] font-semibold text-success">전화번호 인증이 완료됐어요.</p>
              )}
              {expired && (
                <p className="text-[13px] text-danger">인증번호가 만료됐어요. 다시 받아주세요.</p>
              )}
              {phoneMsg && !phoneVerified && !expired && (
                <p className={`text-[13px] ${phoneMsg.tone === 'error' ? 'text-danger' : 'text-[#80858b]'}`}>
                  {phoneMsg.text}
                </p>
              )}

              {/* 이미 가입된 번호 — 기존 소셜 계정으로 바로 로그인 */}
              {dupProvider && !phoneVerified && (
                <button
                  type="button"
                  onClick={continueWithExisting}
                  className="mt-xs flex h-[44px] w-fit items-center rounded-[10px] border border-[#ebedf0] px-[16px] text-[14px] font-semibold text-[#23272b] transition-colors hover:bg-[#f7f8f9]"
                >
                  {dupProvider.providerName ? `${dupProvider.providerName}로 계속하기` : '로그인하러 가기'}
                </button>
              )}
            </div>
          </div>

          {/* 약관 동의 */}
          <div className="mt-lg flex flex-col rounded-[12px] border border-[#ebedf0]">
            <label className="flex cursor-pointer items-center gap-md border-b border-[#f0f1f3] p-[16px]">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-[18px] accent-[#23272b]" />
              <span className="text-[15px] font-bold text-[#121417]">전체 동의</span>
            </label>
            <label className="flex cursor-pointer items-center gap-md px-[16px] pb-sm pt-[12px]">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="size-[18px] accent-[#23272b]"
              />
              <span className="text-[14px] text-[#5e6368]">[필수] 이용약관 동의</span>
            </label>
            <label className="flex cursor-pointer items-center gap-md px-[16px] pb-[16px] pt-sm">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="size-[18px] accent-[#23272b]"
              />
              <span className="text-[14px] text-[#5e6368]">[필수] 개인정보 수집·이용 동의</span>
            </label>
          </div>

          {error && <p className="text-[14px] text-danger">{error}</p>}
        </div>
      </main>

      <footer className="flex w-full shrink-0 items-start justify-center px-[40px] pb-[48px] pt-[16px] max-md:px-lg max-md:pb-[calc(32px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {pending ? '저장 중…' : '시작하기'}
        </button>
      </footer>
    </div>
  )
}

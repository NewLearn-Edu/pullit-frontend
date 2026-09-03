import { useEffect, useRef, useState } from 'react'
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
  GRADE_LABEL,
  type Grade,
  type PhoneVerifyResult,
} from '@/user/api/authApi'
import { clearInviteCode, readInviteCode } from '@/user/services/referral'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { finishLogin, resolvePostAuthDestination } from '@/user/services/finishLogin'
import { useUserStore } from '@/user/stores/userStore'
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
/** 캐스케이드 단계별 타이틀 — 현재 단계에 맞춰 상단 카피가 바뀐다 (토스 패턴) */
const STEP_TITLES = [
  { title: '이름을 알려줄래?', sub: '가입에 필요한 것들을 하나씩 물어볼게' },
  { title: '생년월일을 알려줘', sub: '만 14세 이상부터 가입할 수 있어' },
  { title: '지금 어디에 해당해?', sub: '딱 맞는 문제를 추천하는 데 필요해' },
  { title: '휴대폰 번호를 인증해줘', sub: '학습 알림을 받을 번호가 필요해' },
  { title: '마지막 단계야!', sub: '서비스 이용에 꼭 필요한 동의만 추렸어' },
] as const

/**
 * 학년 선택 2단계 — 그룹(중학생·고등학생·기타) 탭을 누르면 탭이 왼쪽으로
 * 작아지며 오른쪽에 세부 칩이 슬라이드 인 (2026-08-30 UX).
 * 중1 은 뺀다: 사실상 전원 만 14세 미만이라 연령 게이트에서 가입이 차단되는
 * 선택지. 보호자 동의 플로우가 생기면 되살린다 (enum 은 유지).
 */
const GRADE_GROUPS = [
  { key: 'middle', label: '중학생', options: ['MIDDLE_2', 'MIDDLE_3'] },
  { key: 'high', label: '고등학생', options: ['HIGH_1', 'HIGH_2', 'HIGH_3'] },
  { key: 'etc', label: '기타', options: ['RETAKE', 'PARENT', 'TEACHER', 'GENERAL'] },
] as const satisfies readonly { key: string; label: string; options: readonly Grade[] }[]

type GradeGroupKey = (typeof GRADE_GROUPS)[number]['key']

/** 토스식 동의 리스트 체크 — 체크박스 대신 가벼운 ✓ 글리프 (on: 진회색 · off: 연회색) */
function CheckMark({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 10.5 8.2 14.5 16 6"
        stroke={on ? '#121417' : '#c6cacf'}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 작성 중 폼 보존 — 정책 보기 등으로 화면을 떠났다 돌아와도 입력이 남게
 * sessionStorage 에 실시간 저장한다 (탭 닫으면 소멸). 가입 완료·계정 파기·닫기(로그아웃)
 * 시점에 지운다. 전화번호 인증 여부는 제출 시 서버가 재검증하므로 복원해도 안전하다.
 */
const SIGNUP_FORM_KEY = 'pullit_signup_form'

interface SavedSignupForm {
  name: string
  birthY: string
  birthM: string
  birthD: string
  grade: Grade | null
  phone: string
  phoneVerified: boolean
  /** 인증 완료 시각(ms) — 서버 유효창(30분)이 있어 복원 시 오래된 인증은 무효 처리 */
  phoneVerifiedAt: number | null
  agreeAge: boolean
  agreeTerms: boolean
  agreePrivacy: boolean
  agreeMarketing: boolean
  revealed: number
}

function loadSavedForm(): Partial<SavedSignupForm> {
  try {
    return JSON.parse(sessionStorage.getItem(SIGNUP_FORM_KEY) ?? '{}') as Partial<SavedSignupForm>
  } catch {
    return {}
  }
}

export function clearSavedSignupForm() {
  try {
    sessionStorage.removeItem(SIGNUP_FORM_KEY)
  } catch {
    /* noop */
  }
}

export default function SignupInfoPage() {
  const navigate = useNavigate()
  const loadMe = useUserStore((s) => s.loadMe)
  const clearSession = useUserStore((s) => s.clear)

  // 떠났다 돌아온 경우 복원 — useState 지연 초기화라 첫 렌더에서만 읽는다
  const [saved] = useState(loadSavedForm)

  const [name, setName] = useState(saved.name ?? '')
  // 가입 소셜 — 애플이면 이름 칸을 잠근다 (Apple 정책: SSO 제공 이름 사용). loadMe 로 채운다
  const [provider, setProvider] = useState<'NAVER' | 'KAKAO' | 'GOOGLE' | 'APPLE' | null>(null)
  const [birthDate, setBirthDate] = useState('')
  // 생년월일 3분할 입력 (토스 패턴) — 숫자 키패드만 뜨고, 자릿수가 차면 다음 칸으로 자동 이동
  const [birthY, setBirthY] = useState(saved.birthY ?? '')
  const [birthM, setBirthM] = useState(saved.birthM ?? '')
  const [birthD, setBirthD] = useState(saved.birthD ?? '')
  const birthYRef = useRef<HTMLInputElement>(null)
  const birthMRef = useRef<HTMLInputElement>(null)
  const birthDRef = useRef<HTMLInputElement>(null)
  const [grade, setGrade] = useState<Grade | null>(saved.grade ?? null)
  // 칩 마운트 지연 — 탭 축소 중 투명 칩이 자리를 차지해 줄바꿈되면
  // 아래 인풋들이 내려갔다 올라오는 점프가 생긴다. 축소가 끝난 뒤 마운트
  const [chipsShown, setChipsShown] = useState(false)
  const [gradeGroup, setGradeGroup] = useState<GradeGroupKey | null>(() =>
    saved.grade
      ? (GRADE_GROUPS.find((gr) => (gr.options as readonly Grade[]).includes(saved.grade!))?.key ?? null)
      : null,
  )
  const [phone, setPhone] = useState(saved.phone ?? '')
  // 전화번호 SMS 인증 상태
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  // 서버는 인증 후 30분까지만 유효 — 복원은 25분(버퍼) 이내 인증만 인정, 지났으면 재인증 유도
  const restoredVerified =
    (saved.phoneVerified ?? false) &&
    saved.phoneVerifiedAt != null &&
    Date.now() - saved.phoneVerifiedAt < 25 * 60_000
  const [phoneVerified, setPhoneVerified] = useState(restoredVerified)
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<number | null>(
    restoredVerified ? (saved.phoneVerifiedAt ?? null) : null,
  )
  const [cooldown, setCooldown] = useState(0) // 재발송 남은 초
  const [expireLeft, setExpireLeft] = useState(0) // 인증번호 유효 남은 초 (서버 1분과 동일)
  // 안내/오류 메시지 — tone 이 error 면 해당 field 인풋에 빨간 테두리 + 빨간 문구
  const [phoneMsg, setPhoneMsg] = useState<{ text: string; tone: 'info' | 'error'; field: 'phone' | 'code' } | null>(null)
  // 인증은 통과했지만 이미 다른 계정이 쓰는 번호 — 기존 소셜 로그인으로 유도
  const [dupProvider, setDupProvider] = useState<Pick<PhoneVerifyResult, 'provider' | 'providerName'> | null>(null)
  const [agreeAge, setAgreeAge] = useState(saved.agreeAge ?? false) // [필수] 만 14세 이상 — 명시적 확인 (서버는 생년월일로 재검증)
  const [agreeTerms, setAgreeTerms] = useState(saved.agreeTerms ?? false)
  const [agreePrivacy, setAgreePrivacy] = useState(saved.agreePrivacy ?? false)
  // [선택] 마케팅 수신 동의 — 기본 해제. "동의하고 시작하기"가 자동으로 켜지 않는다 (명시적 체크만 유효)
  const [agreeMarketing, setAgreeMarketing] = useState(saved.agreeMarketing ?? false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false) // 만 14세 미만 차단됨

  /**
   * 토스식 캐스케이드 — 한 번에 한 단계만 보여주고, 완성되면 다음 인풋이
   * 애니메이션과 함께 "위에서" 나타난다 (이전 단계는 아래로 쌓임).
   * 1 이름 → 2 생년월일 → 3 휴대폰 인증 → 4 약관 동의. 뒤로는 안 접는다(수정 자유).
   */
  const [revealed, setRevealed] = useState(saved.revealed ?? 1)
  const reveal = (step: number) => setRevealed((r) => Math.max(r, step))

  // 작성 내용 실시간 보존 — 정책 보기 등으로 떠났다 돌아와도 이어서 작성
  useEffect(() => {
    try {
      sessionStorage.setItem(
        SIGNUP_FORM_KEY,
        JSON.stringify({
          name, birthY, birthM, birthD, grade, phone, phoneVerified, phoneVerifiedAt,
          agreeAge, agreeTerms, agreePrivacy, agreeMarketing, revealed,
        } satisfies SavedSignupForm),
      )
    } catch {
      /* noop */
    }
  }, [name, birthY, birthM, birthD, grade, phone, phoneVerified, phoneVerifiedAt, agreeAge, agreeTerms, agreePrivacy, agreeMarketing, revealed])

  // 회원이 아니면 올 수 없는 화면 (게스트·비로그인은 로그인으로)
  useEffect(() => {
    loadMe().then((loaded) => {
      if (!loaded || loaded.type !== 'USER') { navigate('/login', { replace: true }); return }
      if (loaded.phoneNumber && loaded.birthDate) { navigate('/home', { replace: true }); return }
      setProvider(loaded.provider) // 애플이면 이름 칸 잠금 근거
      if (loaded.name) {
        setName((prev) => prev || loaded.name!) // 소셜 이름 프리필 (애플은 수정 불가로 잠김)
        if (loaded.name.trim().length >= 2) reveal(2) // 이름이 이미 있으면 생년월일부터
      }
    })
  }, [loadMe, navigate])

  /**
   * 동의 바텀시트 (토스 패턴) — 인증 완료 시 기존 폼은 흐려지고(딤)
   * 동의 패널이 화면 아래에서 올라온다. 딤 영역 탭 = 닫고 폼 수정,
   * 하단 "동의하고 시작하기" 버튼으로 다시 연다.
   */
  const [consentOpen, setConsentOpen] = useState(false)

  // 단계 자동 진행 — "이번 세션에서 인증이 막 완료된" 순간에만 동의 시트를 올린다.
  // 새로고침 복원(restoredVerified)까지 열면 생년월일 에러 등 미완 상태에서도
  // 시트가 떠버린다 — 복원 시엔 닫힌 채 시작하고 하단 버튼으로 연다.
  const prevVerifiedRef = useRef(phoneVerified)
  useEffect(() => {
    const justVerified = phoneVerified && !prevVerifiedRef.current
    prevVerifiedRef.current = phoneVerified
    if (!justVerified) return
    reveal(5)
    // 앞 단계가 전부 유효할 때만 — 인증만 됐고 생년월일이 에러면 시트 대신 폼에 머문다
    if (nameValid && birthValid && !under14 && grade != null) setConsentOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneVerified])

  /**
   * 생년월일 3분할 → YYYY-MM-DD 합성. 범위가 유효할 때만 birthDate 를 세우고
   * (서버 제출 포맷 그대로), 일(day)까지 두 자리가 차면 휴대폰 단계로 자동 진행.
   */
  const birthPartsFilled = birthY.length === 4 && birthM.length > 0 && birthD.length > 0
  useEffect(() => {
    const yearNum = Number(birthY)
    const monthNum = Number(birthM)
    const dayNum = Number(birthD)
    const valid =
      birthY.length === 4 &&
      birthM.length > 0 &&
      birthD.length > 0 &&
      yearNum >= 1900 &&
      yearNum <= new Date().getFullYear() &&
      monthNum >= 1 &&
      monthNum <= 12 &&
      dayNum >= 1 &&
      dayNum <= 31
    const composed = valid ? `${birthY}-${birthM.padStart(2, '0')}-${birthD.padStart(2, '0')}` : ''
    setBirthDate(composed)
    // 만 14세 미만은 여기서 즉시 안내하고 진행을 멈춘다 — 학년·SMS 인증까지 다 마친 뒤
    // 제출에서야 차단당하는 흐름 방지 (서버 게이트는 제출 시 재검증하는 이중 방어)
    if (valid && birthD.length === 2 && koreanAge(composed) >= 14) reveal(3) // 다음: 학년 선택
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthY, birthM, birthD])

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

  // 인증번호 유효시간 카운트다운 (1:00 → 0:00)
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
      setExpireLeft(60) // 서버 PhoneVerification.EXPIRES_MINUTES(1분)와 동일하게 유지
      setPhoneMsg({ text: '인증번호를 보냈어요. 1분 안에 입력해주세요.', tone: 'info', field: 'phone' })
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
      setPhoneVerifiedAt(Date.now())
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

  /** 인풋 보더 — 에러는 빨강, 값이 채워지면 진한 회색, 비어 있으면 연회색 (포커스는 항상 진회색) */
  const borderOf = (filled: boolean, hasError = false) =>
    hasError
      ? 'border-danger focus:border-danger'
      : filled
        ? 'border-[#a6abb1] focus:border-[#a6abb1]'
        : 'border-[#ebedf0] focus:border-[#a6abb1]'

  /**
   * 생년(4자리) 기준 추천 학년 — 한국 학제: 그 해에 (출생연도+13)살이면 중1.
   * 13~18 → 중1~고3, 19 → 재수 후보. 그 밖(성인·학부모 등)은 추천 없음.
   */
  const gradeByAge: Record<number, Grade> = {
    14: 'MIDDLE_2', 15: 'MIDDLE_3',
    16: 'HIGH_1', 17: 'HIGH_2', 18: 'HIGH_3', 19: 'RETAKE',
  }
  const recommendedGrade =
    birthY.length === 4 ? (gradeByAge[new Date().getFullYear() - Number(birthY)] ?? null) : null

  useEffect(() => {
    if (gradeGroup == null) {
      setChipsShown(false)
      return
    }
    const t = setTimeout(() => setChipsShown(true), 280)
    return () => clearTimeout(t)
  }, [gradeGroup])


  /** 만 나이 — 서버 게이트(Period.between)와 같은 규칙. 생일 안 지났으면 -1 */
  const koreanAge = (dateStr: string) => {
    const b = new Date(dateStr)
    const t = new Date()
    let age = t.getFullYear() - b.getFullYear()
    if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--
    return age
  }

  const nameValid = name.trim().length >= 2
  // 애플 가입자는 이름 수정 불가 (Apple 정책 — SSO 가 내려준 이름 사용). 애플이 이름을
  // 안 준 예외(재가입 등, name 빈값)에는 잠그지 않아 사용자가 직접 입력할 수 있게 둔다
  const nameLocked = provider === 'APPLE' && name.trim().length > 0
  // 999 국번은 실존하지 않는 앱스토어 심사용 번호(999-0000-0000) — 서버 검증(DTO @Pattern)과 동일하게 허용
  const phoneValid = /^(01[0-9]|999)-\d{3,4}-\d{4}$/.test(phone)
  const birthValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate)
  const under14 = birthValid && koreanAge(birthDate) < 14
  /** 필수 동의 3종 체크 여부 — 버튼 라벨(시작하기 vs 동의하고 시작하기) 분기용 */
  const requiredAgreed = agreeAge && agreeTerms && agreePrivacy
  /** 동의 단계까지 왔고 제출 가능한 상태 — 동의 자체는 버튼 클릭이 의사표시 (토스 패턴) */
  const readyForConsent =
    nameValid && birthValid && !under14 && grade != null && phoneVerified && !pending

  const submit = async () => {
    if (!readyForConsent) return
    // "동의하고 시작하기" 클릭 자체가 필수 동의 의사표시 — UI 체크도 함께 채운다
    setAgreeAge(true)
    setAgreeTerms(true)
    setAgreePrivacy(true)
    setPending(true)
    setError(null)
    try {
      const { welcomeCreditGranted } = await completeProfile({
        name: name.trim(),
        birthDate,
        grade: grade!, // readyForConsent 가 null 을 걸러준다
        phoneNumber: phone,
        agreeTerms: true,
        agreePrivacy: true,
        agreeMarketing, // 선택 — 유저가 직접 체크한 값 그대로 (버튼이 자동으로 켜지 않음)
        inviteCode: readInviteCode(), // 초대 링크로 들어온 가입이면 초대자에게 +5 (없으면 null)
      })
      await loadMe(true) // phoneNumber 채워진 상태 반영
      flushAttemptQueue()
      clearSavedSignupForm() // 가입 완료 — 보존해둔 작성 내용 폐기
      clearInviteCode() // 초대 처리 완료 — 재사용 방지로 저장한 코드 폐기
      if (welcomeCreditGranted) {
        // 가입 축하 크레딧 지급 — 축하 뷰가 먼저 뜨고, 확인에서 퍼널/홈을 판정한다.
        // state.granted 는 축하 뷰의 1회용 통행권 — URL 직접 진입을 막는다
        navigate('/signup-complete', { replace: true, state: { granted: true } })
        return
      }
      // 맛보기 미완 신규 가입자는 퍼널(/start)부터 — 완료 유저만 복귀 경로/홈
      navigate(await resolvePostAuthDestination(), { replace: true })
    } catch (e) {
      const errCode = isAxiosError(e) ? e.response?.data?.errorCode : null
      if (errCode === 'U010') {
        // 만 14세 미만 — 서버가 계정을 이미 파기했으므로 프론트도 세션·작성 내용 정리
        setBlocked(true)
        clearSavedSignupForm()
        await logout().catch(() => {})
        clearSession()
      } else if (errCode === 'U016') {
        // 인증 유효창(30분) 초과 등 — 인증 상태를 풀고 휴대폰 단계로 되돌린다
        setConsentOpen(false)
        setPhoneVerified(false)
        setPhoneVerifiedAt(null)
        setCodeSent(false)
        setCode('')
        setPhoneMsg({
          text: '전화번호 인증이 만료됐어요. 인증번호를 다시 받아주세요.',
          tone: 'error',
          field: 'phone',
        })
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
          clearSavedSignupForm() // 명시적 이탈 — 다른 계정으로 다시 올 수 있으니 작성 내용 폐기
          await logout().catch(() => {})
          clearSession()
          navigate('/', { replace: true })
        }}
      />

      <main className="flex w-full flex-1 flex-col items-center px-[40px] py-[40px] max-md:px-lg max-md:py-xl">
        <style>{`
          /* 단계 등장 — 높이가 0에서 스윽 펼쳐지며(grid-rows) 내용은 살짝 늦게 안착한다.
             높이를 함께 애니메이션해야 기존 인풋들이 튀지 않고 부드럽게 밀려난다.
             translateZ(0)·backface-hidden 은 사파리 간헐 플리커 방지용 GPU 레이어 승격 */
          @keyframes su-step-expand { from { grid-template-rows: 0fr } to { grid-template-rows: 1fr } }
          @keyframes su-step-in { from { opacity: 0; transform: translateY(-10px) translateZ(0) } to { opacity: 1; transform: translateY(0) translateZ(0) } }
          .su-step {
            display: grid;
            animation: su-step-expand 540ms cubic-bezier(0.33, 1, 0.68, 1) both;
          }
          .su-step-inner {
            overflow: hidden;
            min-height: 0;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            animation: su-step-in 480ms cubic-bezier(0.33, 1, 0.68, 1) 90ms both;
          }
          .su-step-in {
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            animation: su-step-in 480ms cubic-bezier(0.33, 1, 0.68, 1) both;
          }
          /* 학년 그룹 탭 — 한 줄 3등분. 하나를 고르면 그 탭이 왼쪽으로 작아지고
             나머지 둘은 폭 0 으로 접혀 사라지며, 오른쪽에 세부 칩이 순서대로 슬라이드 인 */
          /* flex 전환은 남는 공간 재계산이 프레임마다 얽혀 덜컥거린다 —
             명시적 width(calc↔px 보간)로 단일 속성만 움직여 곡선을 예측 가능하게 */
          .su-cat {
            flex: none;
            width: calc((100% - 16px) / 3);
            min-width: 0;
            margin-right: 8px;
            overflow: hidden;
            white-space: nowrap;
            transition:
              width 420ms cubic-bezier(0.33, 1, 0.68, 1),
              margin 420ms cubic-bezier(0.33, 1, 0.68, 1),
              border-width 420ms cubic-bezier(0.33, 1, 0.68, 1),
              opacity 200ms ease,
              border-color 150ms ease, background-color 150ms ease;
          }
          .su-cat:last-of-type { margin-right: 0 }
          .su-cat-open { width: 96px; margin-right: 8px !important }
          .su-cat-hidden { width: 0; margin-right: 0; opacity: 0; border-width: 0; pointer-events: none }
          @keyframes su-chip-in { from { opacity: 0; transform: translateX(14px) } to { opacity: 1; transform: translateX(0) } }
          .su-subchip { animation: su-chip-in 360ms cubic-bezier(0.33, 1, 0.68, 1) both }
          /* 동의 바텀시트 — 아래에서 위로 상승 · 배경 폼은 흰 딤으로 흐려진다 (토스 패턴) */
          @keyframes su-sheet-rise { from { transform: translateY(100%) translateZ(0) } to { transform: translateY(0) translateZ(0) } }
          @keyframes su-dim-in { from { opacity: 0 } }
          .su-sheet {
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            animation: su-sheet-rise 480ms cubic-bezier(0.33, 1, 0.68, 1) both;
          }
          .su-dim { animation: su-dim-in 320ms ease both }
          @media (prefers-reduced-motion: reduce) {
            .su-step, .su-step-inner, .su-step-in, .su-sheet, .su-dim, .su-subchip { animation: none }
            .su-cat { transition: none }
          }
        `}</style>
        <div className="flex w-full max-w-[620px] flex-col gap-md">
          {/* 단계별 타이틀 — key 교체로 단계가 바뀔 때마다 다시 슬라이드 인.
              동의 단계 헤드라인은 바텀시트가 가지므로 본문 타이틀은 3단계까지 */}
          <div key={`step-title-${Math.min(revealed, 4)}`} className="su-step-in flex flex-col gap-md">
            <h1 className="break-keep text-[24px] font-bold text-[#121417] max-md:text-[22px]">
              {STEP_TITLES[Math.min(revealed, 4) - 1].title}
            </h1>
            <p className="break-keep text-[16px] text-[#5e6368] max-md:text-[15px]">
              {STEP_TITLES[Math.min(revealed, 4) - 1].sub}
            </p>
          </div>

          {/* 토스식 캐스케이드 — DOM 은 논리 순서(이름→…→약관), col-reverse 로 최신 단계가
              시각적으로 맨 위에 온다. 탭 순서·스크린리더는 논리 순서 유지 */}
          <div className="mt-lg flex flex-col-reverse gap-lg">
            <div className="su-step">
            <div className="su-step-inner">
              <label className="flex flex-col gap-sm">
                <span className="text-[14px] font-semibold text-[#23272b]">이름</span>
                <input
                  type="text"
                  autoComplete="name"
                  autoFocus={!nameLocked}
                  readOnly={nameLocked}
                  aria-disabled={nameLocked}
                  placeholder="이름을 입력해주세요"
                  value={name}
                  onChange={(e) => !nameLocked && setName(e.target.value)}
                  onBlur={() => nameValid && reveal(2)}
                  onKeyDown={(e) => e.key === 'Enter' && nameValid && reveal(2)}
                  className={`h-[56px] rounded-[12px] border px-[16px] text-[16px] outline-none transition-colors duration-150 placeholder:text-[#a6abb1] ${
                    nameLocked
                      ? 'cursor-not-allowed border-[#ebedf0] bg-[#f7f8f9] text-[#80858b]'
                      : `text-[#121417] ${borderOf(name.trim().length > 0)}`
                  }`}
                />
                {nameLocked && (
                  <span className="text-[13px] text-[#80858b]">
                    Apple 계정으로 가입해 이름은 수정할 수 없어요
                  </span>
                )}
              </label>
            </div>
            </div>

            {revealed >= 2 && (
            <div className="su-step">
            <div className="su-step-inner flex flex-col gap-sm">
              <span className="text-[14px] font-semibold text-[#23272b]">생년월일</span>
              <div className="flex gap-sm">
                <input
                  ref={birthYRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  maxLength={4}
                  placeholder="년"
                  value={birthY}
                  onChange={(e) => {
                    // 연도는 0 으로 시작할 수 없다 (1900~현재) — 앞자리 0 은 무시
                    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 4)
                    setBirthY(digits)
                    if (digits.length === 4) birthMRef.current?.focus() // 4자리 차면 월로
                  }}
                  className={`h-[56px] min-w-0 flex-1 rounded-[12px] border text-center text-[16px] text-[#121417] outline-none transition-colors duration-150 placeholder:text-[#a6abb1] ${borderOf(birthY.length > 0, (birthPartsFilled && !birthValid) || under14)}`}
                />
                <input
                  ref={birthMRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  placeholder="월"
                  value={birthM}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
                    // 첫 자리 0·1 은 01~09·10~12 가능성이 있어 대기, 2~9 는 그 달로 확정
                    if (digits.length === 1 && !'01'.includes(digits)) {
                      setBirthM(digits.padStart(2, '0'))
                      birthDRef.current?.focus()
                      return
                    }
                    setBirthM(digits)
                    if (digits.length === 2) birthDRef.current?.focus()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && birthM === '') birthYRef.current?.focus()
                  }}
                  // 함수형 업데이트 필수 — onChange 에서 다음 칸 focus 를 동기로 옮기면
                  // blur 가 리렌더 전에 발화해 옛 상태("0")를 "00"으로 패딩해버린다
                  onBlur={() => setBirthM((m) => (m.length === 1 ? m.padStart(2, '0') : m))}
                  className={`h-[56px] min-w-0 flex-1 rounded-[12px] border text-center text-[16px] text-[#121417] outline-none transition-colors duration-150 placeholder:text-[#a6abb1] ${borderOf(birthM.length > 0, (birthPartsFilled && !birthValid) || under14)}`}
                />
                <input
                  ref={birthDRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  placeholder="일"
                  value={birthD}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
                    // 첫 자리 0~3 은 두 자리 날짜(01~31) 가능성이 있어 대기, 4~9 는 그 날로 확정
                    if (digits.length === 1 && !'0123'.includes(digits)) {
                      setBirthD(digits.padStart(2, '0')) // 길이 2 가 되며 합성 effect 가 다음 단계 진행
                      return
                    }
                    setBirthD(digits)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && birthD === '') birthMRef.current?.focus()
                  }}
                  onBlur={() => setBirthD((d) => (d.length === 1 ? d.padStart(2, '0') : d))}
                  className={`h-[56px] min-w-0 flex-1 rounded-[12px] border text-center text-[16px] text-[#121417] outline-none transition-colors duration-150 placeholder:text-[#a6abb1] ${borderOf(birthD.length > 0, (birthPartsFilled && !birthValid) || under14)}`}
                />
              </div>
              {birthPartsFilled && !birthValid && (
                <p className="text-[13px] text-danger">생년월일을 다시 확인해줘</p>
              )}
              {under14 && (
                <p className="text-[13px] text-danger">
                  만 14세 미만은 아직 가입할 수 없어 — 가입 없이 문제 풀이는 이용할 수 있어
                </p>
              )}
            </div>
            </div>
            )}

            {revealed >= 3 && (
            <div className="su-step">
            <div className="su-step-inner flex flex-col gap-sm">
              <span className="text-[14px] font-semibold text-[#23272b]">학년</span>
              <div className="flex items-start">
                {GRADE_GROUPS.map((group) => {
                  const open = gradeGroup === group.key
                  const hidden = gradeGroup != null && !open
                  return (
                    <button
                      key={group.key}
                      type="button"
                      aria-expanded={open}
                      tabIndex={hidden ? -1 : 0}
                      onClick={() => {
                        if (open) {
                          // 열린 탭 재탭 = 그룹 선택으로 복귀
                          setGradeGroup(null)
                          setGrade(null)
                          return
                        }
                        setGradeGroup(group.key)
                        if (grade && !(group.options as readonly Grade[]).includes(grade)) setGrade(null)
                      }}
                      className={`su-cat flex h-[52px] items-center justify-center rounded-[14px] border text-[15px] font-semibold ${
                        open
                          ? 'su-cat-open border-[#a6abb1] text-[#121417]'
                          : hidden
                            ? 'su-cat-hidden border-[#ebedf0] text-[#23272b]'
                            : 'border-[#ebedf0] text-[#23272b] hover:bg-[#f7f8f9]'
                      }`}
                    >
                      {group.label}
                    </button>
                  )
                })}
                {gradeGroup != null && chipsShown && (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-[8px]">
                    {GRADE_GROUPS.find((gr) => gr.key === gradeGroup)!.options.map((g, i) => {
                      const on = grade === g
                      const hinted = !on && grade == null && recommendedGrade === g
                      return (
                        <button
                          key={g}
                          type="button"
                          aria-pressed={on}
                          style={{ animationDelay: `${i * 45}ms` }}
                          onClick={() => {
                            setGrade(g)
                            reveal(4) // 다음: 휴대폰 인증
                          }}
                          className={`su-subchip flex h-[52px] min-w-[64px] items-center justify-center gap-[5px] rounded-[14px] border px-[18px] text-[15px] font-semibold transition-colors duration-150 ${
                            on
                              ? 'border-[#23272b] bg-[#23272b] text-white'
                              : hinted
                                ? 'border-[#a6abb1] bg-white text-[#23272b]'
                                : 'border-[#ebedf0] bg-white text-[#23272b] hover:bg-[#f7f8f9]'
                          }`}
                        >
                          {GRADE_LABEL[g]}
                          {hinted && <span className="text-[12px] font-semibold text-[#80858b]">추천</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            </div>
            )}

            {revealed >= 4 && (
            <div className="su-step">
            <div className="su-step-inner flex flex-col gap-sm">
              <span className="text-[14px] font-semibold text-[#23272b]">휴대폰 번호</span>
              <div className="flex gap-sm">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9\-]*"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={(e) => handlePhone(e.target.value)}
                  disabled={phoneVerified}
                  className={`h-[56px] min-w-0 flex-1 rounded-[12px] border px-[16px] text-[16px] text-[#121417] outline-none transition-colors duration-150 placeholder:text-[#a6abb1] disabled:bg-[#f7f8f9] disabled:text-[#80858b] ${borderOf(phone.length > 0, phoneHasError)}`}
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={!phoneValid || phoneVerified || cooldown > 0}
                  // 고정 폭 — "재발송 59초" 카운트다운 중 초가 줄어도 박스 크기가 안 흔들리게.
                  // 아래 확인 버튼과 같은 폭으로 세로 라인 정렬
                  className="h-[56px] w-[112px] shrink-0 rounded-[12px] border border-[#23272b] text-[15px] font-semibold tabular-nums text-[#23272b] disabled:border-[#ebedf0] disabled:text-[#a6abb1]"
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

              {/* 인증번호 입력 — 발송 후 스윽 내려오며 자동 포커스, 인증 완료 시 숨김 */}
              {codeSent && !phoneVerified && (
                <div className="su-step">
                <div className="su-step-inner flex gap-sm">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="text"
                      autoFocus
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
                      className={`h-[56px] w-full rounded-[12px] border px-[16px] pr-[64px] transition-colors duration-150 text-[16px] tracking-[4px] text-[#121417] outline-none placeholder:tracking-normal placeholder:text-[#a6abb1] disabled:bg-[#f7f8f9] disabled:text-[#a6abb1] ${borderOf(code.length > 0, codeHasError)}`}
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
                    className="h-[56px] w-[112px] shrink-0 rounded-[12px] bg-[#23272b] text-[15px] font-semibold text-white disabled:opacity-30"
                  >
                    확인
                  </button>
                </div>
                </div>
              )}

              {phoneVerified && (
                <p className="text-[13px] text-[#80858b]">전화번호 인증이 완료됐어요.</p>
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
            )}

          </div>

          {error && <p className="text-[14px] text-danger">{error}</p>}
        </div>
      </main>

      {/* 하단 버튼 — 동의 시트가 열려 있는 동안엔 시트 안의 버튼이 대신한다 */}
      {!consentOpen && (
        <footer className="flex w-full shrink-0 items-start justify-center px-[40px] pb-[48px] pt-[16px] max-md:px-lg max-md:pb-[calc(32px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => readyForConsent && setConsentOpen(true)}
            disabled={!readyForConsent || revealed < 5}
            className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            동의하고 시작하기
          </button>
        </footer>
      )}

      {/* 동의 바텀시트 (토스 패턴) — 배경 폼이 흐려지고 아래에서 올라온다.
          justify-center 대신 시트에 mx-auto — 화면이 350px 보다 좁아도 양쪽이 잘리지 않고
          왼쪽 기준 + 가로 스크롤로 열린다 (body 최소폭 동작과 동일) */}
      {consentOpen && (
        <div className="fixed inset-0 z-40 flex items-end overflow-x-auto">
          {/* 흰 딤 — 뒤의 폼을 흐리게. 탭하면 시트를 닫고 폼 수정 가능 */}
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setConsentOpen(false)}
            className="su-dim fixed inset-0 bg-white/75"
          />
          {/* min-w 350 — fixed 요소는 body 의 전역 min-width 를 안 따르므로 직접 건다 (지원 최소 폭 동일) */}
          <div className="su-sheet relative mx-auto w-full min-w-[350px] max-w-[620px] bg-white px-[20px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-[8px]">
            <h2 className="break-keep pt-[16px] text-[22px] font-bold leading-[1.35] text-[#121417]">
              서비스 이용에
              <br />꼭 필요한 동의만 추렸어
            </h2>

            {/* 전체 동의 — 필수 3종 + 선택(마케팅)까지 일괄 토글 */}
            <button
              type="button"
              onClick={() => {
                const next = !(requiredAgreed && agreeMarketing)
                setAgreeAge(next)
                setAgreeTerms(next)
                setAgreePrivacy(next)
                setAgreeMarketing(next)
              }}
              className="mt-[20px] flex w-full items-center gap-[10px] border-b border-[#f0f1f3] pb-[14px] pt-[4px] text-left"
            >
              <CheckMark on={requiredAgreed && agreeMarketing} />
              <span
                className={`text-[16px] font-bold transition-colors duration-150 ${
                  requiredAgreed && agreeMarketing ? 'text-[#121417]' : 'text-[#a6abb1]'
                }`}
              >
                전체 동의
              </span>
            </button>

            {/* 동의 리스트 — 개별 토글 가능. "동의하고 시작하기"는 필수만 자동 간주,
                선택(마케팅)은 명시적 체크만 유효 (정보통신망법 §50) */}
            <div className="mt-[6px] flex flex-col">
              {(
                [
                  // 법적 진술 항목이라 서비스 반말 톤과 별개로 표준 문구(격식체) 사용
                  { checked: agreeAge, toggle: () => setAgreeAge((v) => !v), label: '만 14세 이상입니다', doc: null, required: true },
                  { checked: agreeTerms, toggle: () => setAgreeTerms((v) => !v), label: '이용약관 동의', doc: '/policies/terms', required: true },
                  { checked: agreePrivacy, toggle: () => setAgreePrivacy((v) => !v), label: '개인정보 수집·이용 동의', doc: '/policies/privacy', required: true },
                  { checked: agreeMarketing, toggle: () => setAgreeMarketing((v) => !v), label: '마케팅 정보 수신 동의', doc: '/policies/marketing', required: false },
                ] as const
              ).map((item) => (
                <div
                  key={item.label}
                  // 필수 그룹과 선택 그룹 사이 구분선 + 간격
                  className={`flex items-center ${
                    !item.required ? 'mt-[10px] border-t border-[#f0f1f3] pt-[10px]' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={item.toggle}
                    className="flex min-w-0 flex-1 items-center gap-[10px] py-[10px] text-left"
                  >
                    <CheckMark on={item.checked} />
                    <span
                      className={`text-[15px] transition-colors duration-150 ${
                        item.checked ? 'text-[#121417]' : 'text-[#a6abb1]'
                      }`}
                    >
                      <b className="mr-[6px] font-bold">{item.required ? '필수' : '선택'}</b>
                      {item.label}
                    </span>
                  </button>
                  {item.doc && (
                    // 새 탭 — 가입 진행 상태(입력값·시트)를 잃지 않게 현재 탭을 떠나지 않는다
                    <a
                      href={item.doc}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 px-[8px] py-[10px] text-[13px] text-[#a6abb1] underline underline-offset-2"
                    >
                      보기
                    </a>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!readyForConsent}
              className="mt-[20px] flex h-[56px] w-full items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              {pending ? '저장 중…' : requiredAgreed ? '시작하기' : '동의하고 시작하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

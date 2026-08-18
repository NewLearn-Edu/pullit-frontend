import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrialStore, type Subject } from '@/user/stores/trialStore'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { useMe } from '@/user/hooks/useMe'

/**
 * 마케팅 진입용 시네마틱 인트로 (/start/:subject)
 *
 * 광고 링크 → 이 페이지 → 맛보기 테스트. 검은 화면에 카피가 타자기처럼
 * 한 자씩 찍히며 서비스를 한 문장으로 각인시킨다:
 * "하루 15분, 딱 3문제. 너의 약점만 골라서 준다."
 *
 * 시작을 누르면 15:00 → 14:59 틱과 함께 화면이 밝아지며 맛보기로 전환.
 * 게스트 세션은 버튼 클릭 시점에 확보 (광고 링크 크롤러가 게스트를 양산하지 않게
 * 마운트가 아닌 명시적 상호작용에서) — 틱 연출(~1.6초) 뒤에서 병렬로 처리돼 체감 지연 없음.
 */

interface IntroLine {
  text: string
  /** tailwind 클래스 — 줄별 크기·색 위계 */
  className: string
  /** 이 줄이 찍히기 전 쉼 (ms) */
  pauseBefore: number
}

const TYPE_SPEED_MS = 72
const SUBJECT_LABEL: Record<Subject, string> = { math: '수학', english: '영어' }

function buildLines(subject: Subject): IntroLine[] {
  return [
    {
      text: `${SUBJECT_LABEL[subject]}, 하루 15분.`,
      className: 'text-[26px] font-semibold text-[#c8cbcf] max-md:text-[21px]',
      pauseBefore: 500,
    },
    {
      text: '딱 3문제.',
      className: 'text-[64px] font-extrabold text-white max-md:text-[46px]',
      pauseBefore: 550,
    },
    {
      text: '너의 약점만 골라서 준다.',
      className: 'text-[30px] font-bold text-[#ff385c] max-md:text-[23px]',
      pauseBefore: 650,
    },
    {
      text: '그럼, 시작한다.',
      className: 'text-[24px] font-semibold text-white max-md:text-[19px]',
      pauseBefore: 1100,
    },
  ]
}

export default function TrialIntroPage() {
  const navigate = useNavigate()
  const { subject: subjectParam } = useParams<{ subject: string }>()
  const subject: Subject | null =
    subjectParam === 'math' || subjectParam === 'english' ? subjectParam : null

  const reset = useTrialStore((s) => s.reset)
  const setLastSubject = useTrialStore((s) => s.setLastSubject)
  const ensureSession = useUserStore((s) => s.ensureSession)

  useEffect(() => {
    if (!subject) navigate('/', { replace: true })
  }, [subject, navigate])

  // 회원은 맛보기 퍼널 대상이 아니다 — 광고 링크·직접 진입 모두 홈으로
  // (useMe 는 조회 전용 loadMe 라 게스트를 만들지 않는다 — 크롤러 안전)
  useMe()
  const isMember = useUserStore(selectIsMember)
  useEffect(() => {
    if (isMember) navigate('/home', { replace: true })
  }, [isMember, navigate])

  const lines = useMemo(() => buildLines(subject ?? 'math'), [subject])

  // ── 타자기 진행 상태 — lineIdx 줄까지 진행, 현재 줄은 charCount 글자까지 ──
  const reduceMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [lineIdx, setLineIdx] = useState(reduceMotion ? lines.length : 0)
  const [charCount, setCharCount] = useState(0)
  const typingDone = lineIdx >= lines.length

  useEffect(() => {
    if (typingDone) return
    const line = lines[lineIdx]
    // 줄 시작 전 쉼 → 글자 단위 타이핑 → 다음 줄
    if (charCount === 0) {
      const pause = setTimeout(() => setCharCount(1), line.pauseBefore)
      return () => clearTimeout(pause)
    }
    if (charCount >= line.text.length) {
      setLineIdx((i) => i + 1)
      setCharCount(0)
      return
    }
    const tick = setTimeout(() => setCharCount((c) => c + 1), TYPE_SPEED_MS)
    return () => clearTimeout(tick)
  }, [lines, lineIdx, charCount, typingDone])

  /** 화면 탭 = 연출 건너뛰기 — 광고에서 온 급한 유저를 붙잡지 않는다 */
  const skipTyping = () => {
    if (!typingDone) {
      setLineIdx(lines.length)
      setCharCount(0)
    }
  }

  // ── 시작 — 15:00 틱 연출과 세션 확보를 병렬로 ──
  const [phase, setPhase] = useState<'copy' | 'timer'>('copy')
  const [timerText, setTimerText] = useState('15:00')
  const [leaving, setLeaving] = useState(false) // 화면이 밝아지며 사라지는 중
  const startedRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const handleStart = useCallback(() => {
    if (!subject || startedRef.current) return
    startedRef.current = true

    const session = ensureSession().catch(() => null) // 실패해도 막지 않음 — 로컬 진행
    reset()
    setLastSubject(subject)
    setPhase('timer')

    setTimeout(() => setTimerText('14:59'), 900)
    setTimeout(() => setLeaving(true), 1500)
    setTimeout(async () => {
      await session
      flushAttemptQueue()
      if (aliveRef.current) navigate(`/trial/quiz/${subject}/0`, { replace: true })
    }, 2050)
  }, [subject, ensureSession, reset, setLastSubject, navigate])

  if (!subject) return null

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      onClick={skipTyping}
      className={`flex h-dvh flex-col items-center justify-center overflow-hidden px-[24px] transition-colors duration-500 ${
        leaving ? 'bg-white' : 'bg-black'
      }`}
    >
      <style>{`
        @keyframes intro-caret { 0%, 55% { opacity: 1 } 56%, 100% { opacity: 0 } }
        @keyframes intro-rise { from { opacity: 0; transform: translateY(14px) } }
        @keyframes intro-timer-in { from { opacity: 0; transform: scale(0.92) } }
      `}</style>

      {phase === 'copy' ? (
        <>
          <div className="flex w-full max-w-[720px] flex-col items-center gap-[18px] text-center max-md:gap-[14px]">
            {lines.slice(0, 3).map((line, i) => {
              const visible =
                i < lineIdx ? line.text : i === lineIdx ? line.text.slice(0, charCount) : ''
              if (!visible && i > lineIdx) return null
              return (
                <p key={line.text} className={`break-keep leading-[1.25] ${line.className}`}>
                  {visible}
                  {i === lineIdx && !typingDone && (
                    <span
                      aria-hidden
                      className="ml-[2px] inline-block h-[0.95em] w-[3px] translate-y-[0.12em] animate-[intro-caret_900ms_steps(1)_infinite] bg-[#ff385c]"
                    />
                  )}
                </p>
              )
            })}

            {/* 마지막 줄 — 위 세 줄과 간격을 벌려 호흡 */}
            {(lineIdx >= 3 || typingDone) && (
              <p className={`mt-[36px] break-keep leading-[1.25] max-md:mt-[26px] ${lines[3].className}`}>
                {typingDone ? lines[3].text : lines[3].text.slice(0, charCount)}
                {!typingDone && (
                  <span
                    aria-hidden
                    className="ml-[2px] inline-block h-[0.95em] w-[3px] translate-y-[0.12em] animate-[intro-caret_900ms_steps(1)_infinite] bg-[#ff385c]"
                  />
                )}
              </p>
            )}
          </div>

          {/* 타이핑이 끝나면 시작 버튼 등장 */}
          <div className="mt-[44px] h-[56px] max-md:mt-[34px]">
            {typingDone && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStart()
                }}
                className="h-[56px] w-[280px] animate-[intro-rise_420ms_cubic-bezier(0.22,0.9,0.3,1)] rounded-[14px] bg-[#ff385c] text-[17px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] max-md:w-[240px]"
              >
                시작하기
              </button>
            )}
          </div>
        </>
      ) : (
        /* 15:00 → 14:59 — 시간이 흐르기 시작했다는 신호와 함께 화면이 밝아진다 */
        <div
          className={`flex flex-col items-center gap-[14px] transition-opacity duration-500 ${
            leaving ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <p className="animate-[intro-rise_400ms_ease] text-[15px] font-semibold tracking-[0.2em] text-[#80858b]">
            {SUBJECT_LABEL[subject]} 3문제
          </p>
          <p className="animate-[intro-timer-in_450ms_cubic-bezier(0.22,0.9,0.3,1)] text-[96px] font-extrabold leading-none text-white [font-variant-numeric:tabular-nums] max-md:text-[72px]">
            {timerText}
          </p>
        </div>
      )}
    </div>
  )
}

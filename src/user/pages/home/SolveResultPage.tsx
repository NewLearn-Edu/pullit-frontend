import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { waitForPendingAttempts } from '@/user/services/attemptQueue'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { setLastSolvedFlash, setUnitReopenFlash } from '@/user/pages/home/UnitSheets'
import arrowIcon from '@/assets/score-change-arrow.svg'
import upIcon from '@/assets/score-change-up.svg'
import downIcon from '@/assets/score-change-down.svg'
import type { Subject } from '@/user/stores/trialStore'
import {
  clearUnitScoreSnapshot,
  fetchUnitScoreSnapshot,
  type UnitScoreSnapshot,
} from '@/user/services/unitScoreSnapshot'
import styles from './styles/SolveResultPage.module.scss'

interface ResultState {
  setId: number
  before: UnitScoreSnapshot | null
  returnTo: string
}

/** 마지막 제출이 서버에 반영되기까지의 재조회 — 간격·횟수 */
const POLL_MS = 700
const POLL_MAX = 4

/** 시퀀스 타이밍(ms) — 제목 → 카드 → 이전 점수 → 화살표 → 현재 점수 롤링 → 칩 → 안내·완료 */
const T = {
  title: 0,
  card: 180,
  beforeCount: 420, // 이전 점수 0 → N 카운트 시작
  beforeDur: 650,
  arrow: 950,
  afterMin: 1150, // 현재 점수 롤링은 이 시점 이후 + 서버 값 도착 후
  afterDur: 800,
  chipGap: 80, // 롤링 끝 → 칩 팝
  outroGap: 220, // 칩 팝 → 안내·완료 버튼
}

type Direction = 'up' | 'down' | 'same'

/**
 * 세트 풀이 완료 — 소단원 평균 점수 변동 (Figma 3620-8320 상승 · 2857-21967 하락)
 *
 * 첫 맛보기 진단은 /weakness(약점 결과)로 가지만, 이미 진단한 소단원을 다시 푼 세트(FREE·DAILY)는
 * 이 화면에서 "이전 평균 → 현재 평균"만 보여준다. 세트를 막 끝낸 직후에만 열린다 —
 * 라우터 state(세트 id·이전 점수)가 없으면(새로고침·직접 진입) 진입처로 돌려보낸다.
 *
 * 마지막 문항 제출은 fire-and-forget 이라 도착 직후 조회하면 아직 반영 전일 수 있다 →
 * 누적 배점(totalPoints)이 커질 때까지 짧게 재조회한다.
 *
 * 연출(토스식): 제목·카드가 떠오르고, 이전 점수가 0에서 카운트업, 화살표가 밀려 들어온 뒤
 * 현재 점수가 이전 값에서 굴러가 멈추면 변동 칩이 스프링으로 튀고 카드가 한 번 통통.
 * 그제야 두 번째 줄("평균 점수가 올랐어")과 안내·완료 버튼이 나타난다.
 */
export default function SolveResultPage() {
  const navigate = useNavigate()
  const { subject: subjectParam, unitName: unitNameParam } = useParams<{ subject: Subject; unitName: string }>()
  const subject: Subject = subjectParam === 'english' ? 'english' : 'math'
  const unitName = unitNameParam ? decodeURIComponent(unitNameParam) : ''
  const state = (useLocation().state ?? null) as ResultState | null

  const [after, setAfter] = useState<UnitScoreSnapshot | null>(null)

  // 세트 직후가 아니면(state 없음) 열 수 없다
  useEffect(() => {
    if (!state) navigate('/home', { replace: true })
  }, [state, navigate])

  // 현재 점수 조회 — 이전 스냅샷보다 배점이 늘어날 때까지 재시도
  useEffect(() => {
    if (!state || !unitName) return
    let alive = true
    let tries = 0
    const poll = async () => {
      tries += 1
      try {
        if (tries === 1) await waitForPendingAttempts() // 마지막 문항 제출이 닿기 전 조회 방지
        const snap = await fetchUnitScoreSnapshot(subject, unitName)
        if (!alive) return
        const applied = !state.before || snap.totalPoints > state.before.totalPoints
        if (applied || tries >= POLL_MAX) {
          setAfter(snap)
          clearUnitScoreSnapshot(state.setId)
          return
        }
      } catch {
        if (!alive) return
        if (tries >= POLL_MAX) {
          setAfter(state.before ?? { score: 0, totalPoints: 0 })
          return
        }
      }
      window.setTimeout(poll, POLL_MS)
    }
    poll()
    return () => {
      alive = false
    }
  }, [state, subject, unitName])

  // ── 시퀀스 ────────────────────────────────────────────────────────────────
  const beforeScore = state?.before?.score ?? 0
  const reduced = usePrefersReducedMotion()
  const elapsed = useElapsed()

  // 이전 점수 카운트업 (0 → before)
  const beforeShown = useCountTo(beforeScore, {
    from: 0,
    duration: reduced ? 0 : T.beforeDur,
    start: reduced || elapsed >= T.beforeCount,
  })

  // 현재 점수 롤링 — 서버 값이 오고, 화살표까지 나온 뒤에
  const afterReady = after != null && (reduced || elapsed >= T.afterMin)
  const afterShown = useCountTo(after?.score ?? beforeScore, {
    from: beforeScore,
    duration: reduced ? 0 : T.afterDur,
    start: afterReady,
  })
  const rolling = afterReady && after != null && afterShown !== after.score

  // 롤링이 끝나면 칩 → 안내·완료 순으로
  const [revealed, setRevealed] = useState(false) // 칩 팝 + 카드 통통
  const [headlineOn, setHeadlineOn] = useState(false) // 두 번째 줄 문구
  const [outro, setOutro] = useState(false)
  useEffect(() => {
    if (!afterReady || rolling) return
    const d = (ms: number) => (reduced ? 0 : ms)
    const a = window.setTimeout(() => setRevealed(true), d(T.chipGap))
    const h = window.setTimeout(() => setHeadlineOn(true), d(T.chipGap + 160))
    const b = window.setTimeout(() => setOutro(true), d(T.chipGap + 160 + T.outroGap))
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(h)
      window.clearTimeout(b)
    }
  }, [afterReady, rolling, reduced])

  if (!state) return null

  const before = state.before
  const delta = before && after ? after.score - before.score : null
  const direction: Direction | null = delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'
  const headline =
    direction === 'up' ? '평균 점수가 올랐어' : direction === 'down' ? '평균 점수가 떨어졌어' : '평균 점수는 그대로야'

  // 약점 지도에서 시작한 세트면 돌아가서 방금 푼 소단원을 선택 + 상세 시트 열기 (3699-11683).
  // 홈에서 시작한 세트는 홈으로만 (지도 전용 동작)
  const leave = () => {
    const to = state.returnTo || '/home'
    if (to.startsWith('/weakness-map') && unitName) setUnitReopenFlash(unitName, subject)
    if (unitName) setLastSolvedFlash(unitName, subject) // 홈 복귀 시 이 단원 탭·카드로 초점
    navigate(to, { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[#f0f1f3]">
      <OnboardingHeader onClose={leave} />

      <main className="flex w-full flex-1 flex-col items-center justify-center gap-[40px] px-[20px] pb-[40px] pt-[20px]">
        <h1 className="break-keep text-center text-[24px] font-bold leading-[1.3] text-[#121417]">
          <span className={styles.rise} style={{ '--d': `${T.title}ms` } as React.CSSProperties}>
            {unitName}
          </span>
          <br />
          {/* 두 번째 줄은 점수가 확정된 뒤에만 — 결과를 먼저 말하지 않는다 */}
          <span className={clsx(headlineOn ? styles.rise : 'invisible')}>{headline}</span>
        </h1>

        {/* 이전 평균 → 현재 평균 카드 */}
        <div
          className={clsx(
            'flex w-full max-w-[335px] items-center justify-center gap-[16px] rounded-[16px] bg-white p-[20px]',
            styles.card,
            revealed && styles.cardBump,
          )}
          style={{ '--d': `${T.card}ms` } as React.CSSProperties}
        >
          <div className="flex min-w-0 flex-1 flex-col items-center gap-[8px] text-center">
            <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">이전 평균</p>
            <p className={clsx('text-[24px] font-bold text-[#121417]', styles.num)}>
              {before ? `${beforeShown}점` : '—'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-end gap-[16px] self-stretch">
            <img
              src={arrowIcon}
              alt=""
              aria-hidden
              className={clsx('h-[11px] w-[25px]', styles.arrow)}
              style={{ '--d': `${T.arrow}ms` } as React.CSSProperties}
            />
            {revealed && direction && delta != null ? (
              <DeltaChip direction={direction} delta={delta} />
            ) : (
              <span className="h-[24px]" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-[8px] text-center">
            <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">현재 평균</p>
            <p
              className={clsx(
                'text-[24px] font-bold text-[#121417]',
                styles.num,
                rolling && styles.numRolling,
                !afterReady && styles.numPending,
              )}
            >
              {afterReady ? `${afterShown}점` : '…'}
            </p>
          </div>
        </div>
      </main>

      {/* 계산 안내 — 결과 확정 뒤 */}
      <div className="flex w-full flex-col items-center overflow-hidden px-[20px]">
        <div
          className={clsx(
            'flex w-full max-w-[335px] items-start gap-[8px] rounded-[16px] bg-[#e5e7ea] p-[16px]',
            outro ? styles.rise : 'invisible',
          )}
        >
          <span className="flex size-[16px] shrink-0 items-center justify-center rounded-full bg-[#d6d8db] text-[12px] font-semibold leading-none text-[#5e6368]">
            i
          </span>
          <p className="min-w-0 flex-1 break-keep text-[12px] font-semibold leading-[1.4] text-[#80858b]">
            방금 푼 3문제 결과를 반영해서 소단원 평균 점수를 업데이트했어
          </p>
        </div>
      </div>

      {/* 완료 — 진입처(홈)로.
          overflow-hidden: 떠오르는 애니메이션(translateY 14px)이 화면 바닥을 넘는 순간
          스크롤바가 생겼다 사라지며 화면이 흔들리던 문제 — 초과분을 여기서 잘라낸다 */}
      <div className="flex w-full justify-center overflow-hidden px-[20px] pb-[max(28px,env(safe-area-inset-bottom))] pt-[20px]">
        <button
          type="button"
          onClick={leave}
          className={clsx(
            'flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90',
            outro ? styles.rise : 'invisible',
          )}
          style={{ '--d': '80ms' } as React.CSSProperties}
        >
          완료
        </button>
      </div>
    </div>
  )
}

/** 변동 칩 — 상승 빨강 · 하락 파랑 · 변동 없음 회색. 스프링 팝으로 등장 */
function DeltaChip({ direction, delta }: { direction: Direction; delta: number }) {
  if (direction === 'same') {
    return (
      <span className={clsx('rounded-full bg-[#f0f1f3] px-[6px] py-[4px] text-[12px] font-semibold leading-[1.4] text-[#80858b]', styles.chip)}>
        변동 없음
      </span>
    )
  }
  const up = direction === 'up'
  return (
    <span
      className={clsx(
        'flex items-center gap-[4px] rounded-full px-[6px] py-[4px] text-[12px] font-semibold leading-[1.4]',
        up ? 'bg-[#fff1f2] text-primary' : 'bg-[#eaf1ff] text-[#2a78ff]',
        styles.chip,
      )}
    >
      <img src={up ? upIcon : downIcon} alt="" aria-hidden className="size-[12px]" />
      {Math.abs(delta)}점 {up ? '상승' : '하락'}
    </span>
  )
}

// ── 연출 훅 ──────────────────────────────────────────────────────────────────

/** 마운트 후 경과 시간(ms) — 시퀀스 타이밍 판정용. 마지막 단계(afterMin)까지만 갱신 */
function useElapsed(): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const e = now - started
      setElapsed(e)
      if (e < T.afterMin + 50) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return elapsed
}

/** from → target 을 duration 동안 easeOutCubic 으로 굴린다 (start 가 true 가 되는 순간부터) */
function useCountTo(target: number, { from, duration, start }: { from: number; duration: number; start: boolean }): number {
  const [value, setValue] = useState(from)
  const fromRef = useRef(from)
  useEffect(() => {
    if (!start) return
    if (duration <= 0) {
      setValue(target)
      return
    }
    const begin = fromRef.current
    let raf = 0
    let startAt: number | null = null
    const tick = (now: number) => {
      if (startAt === null) startAt = now
      const t = Math.min(1, (now - startAt) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(begin + (target - begin) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [start, target, duration])
  return value
}

function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  return reduced
}

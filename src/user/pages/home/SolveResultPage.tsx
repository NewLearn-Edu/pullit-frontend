import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import arrowIcon from '@/assets/score-change-arrow.svg'
import upIcon from '@/assets/score-change-up.svg'
import downIcon from '@/assets/score-change-down.svg'
import type { Subject } from '@/user/stores/trialStore'
import {
  clearUnitScoreSnapshot,
  fetchUnitScoreSnapshot,
  type UnitScoreSnapshot,
} from '@/user/services/unitScoreSnapshot'

interface ResultState {
  setId: number
  before: UnitScoreSnapshot | null
  returnTo: string
}

/** 마지막 제출이 서버에 반영되기까지의 재조회 — 간격·횟수 */
const POLL_MS = 700
const POLL_MAX = 4

/**
 * 세트 풀이 완료 — 소단원 평균 점수 변동 (Figma 3620-8320 상승 · 2857-21967 하락)
 *
 * 첫 맛보기 진단은 /weakness(약점 결과)로 가지만, 이미 진단한 소단원을 다시 푼 세트(FREE·DAILY)는
 * 이 화면에서 "이전 평균 → 현재 평균"만 보여준다. 세트를 막 끝낸 직후에만 열린다 —
 * 라우터 state(세트 id·이전 점수)가 없으면(새로고침·직접 진입) 진입처로 돌려보낸다.
 *
 * 마지막 문항 제출은 fire-and-forget 이라 도착 직후 조회하면 아직 반영 전일 수 있다 →
 * 누적 배점(totalPoints)이 커질 때까지 짧게 재조회한다.
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

  if (!state) return null

  const before = state.before
  const delta = before && after ? after.score - before.score : null
  const direction: 'up' | 'down' | 'same' | null =
    delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'
  const headline =
    direction === 'up'
      ? '평균 점수가 올랐어'
      : direction === 'down'
        ? '평균 점수가 떨어졌어'
        : direction === 'same'
          ? '평균 점수는 그대로야'
          : '평균 점수를 계산하고 있어'

  const leave = () => navigate(state.returnTo || '/home', { replace: true })

  return (
    <div className="flex min-h-dvh flex-col bg-[#f0f1f3]">
      <OnboardingHeader showLogo onClose={leave} />

      <main className="flex w-full flex-1 flex-col items-center justify-center gap-[40px] px-[20px] pb-[40px] pt-[20px]">
        <h1 className="break-keep text-center text-[24px] font-bold leading-[1.3] text-[#121417]">
          {unitName}
          <br />
          {headline}
        </h1>

        {/* 이전 평균 → 현재 평균 카드 */}
        <div className="flex w-full max-w-[335px] items-center justify-center gap-[16px] rounded-[16px] bg-white p-[20px]">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-[8px] text-center">
            <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">이전 평균</p>
            <p className="text-[24px] font-bold text-[#121417]">{before ? `${before.score}점` : '—'}</p>
          </div>

          <div className="flex flex-col items-center justify-end gap-[16px] self-stretch">
            <img src={arrowIcon} alt="" aria-hidden className="h-[11px] w-[25px]" />
            <DeltaChip direction={direction} delta={delta} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-[8px] text-center">
            <p className="text-[14px] font-medium leading-[1.4] text-[#80858b]">현재 평균</p>
            <p className={clsx('text-[24px] font-bold text-[#121417]', !after && 'animate-pulse text-[#a6abb1]')}>
              {after ? `${after.score}점` : '…'}
            </p>
          </div>
        </div>
      </main>

      {/* 계산 안내 */}
      <div className="flex w-full flex-col items-center px-[20px]">
        <div className="flex w-full max-w-[335px] items-start gap-[8px] rounded-[16px] bg-[#e5e7ea] p-[16px]">
          <span className="flex size-[16px] shrink-0 items-center justify-center rounded-full bg-[#d6d8db] text-[12px] font-semibold leading-none text-[#5e6368]">
            i
          </span>
          <p className="min-w-0 flex-1 break-keep text-[12px] font-semibold leading-[1.4] text-[#80858b]">
            방금 푼 3문제 결과를 반영해서 소단원 평균 점수를 업데이트했어
          </p>
        </div>
      </div>

      {/* 완료 — 진입처(홈)로 */}
      <div className="flex w-full justify-center px-[20px] pb-[max(28px,env(safe-area-inset-bottom))] pt-[20px]">
        <button
          type="button"
          onClick={leave}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90"
        >
          완료
        </button>
      </div>
    </div>
  )
}

/** 변동 칩 — 상승 빨강 · 하락 파랑 · 변동 없음 회색 · 계산 중엔 비움 */
function DeltaChip({ direction, delta }: { direction: 'up' | 'down' | 'same' | null; delta: number | null }) {
  if (direction == null || delta == null) return <span className="h-[24px]" />
  if (direction === 'same') {
    return (
      <span className="rounded-full bg-[#f0f1f3] px-[6px] py-[4px] text-[12px] font-semibold leading-[1.4] text-[#80858b]">
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
      )}
    >
      <img src={up ? upIcon : downIcon} alt="" aria-hidden className="size-[12px]" />
      {Math.abs(delta)}점 {up ? '상승' : '하락'}
    </span>
  )
}

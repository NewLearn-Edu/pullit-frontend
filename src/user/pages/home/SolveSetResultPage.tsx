import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBlockBackNavigation } from '@/user/hooks/useBlockBackNavigation'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { useSolveStore } from '@/user/stores/solveStore'
import { useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { type Subject } from '@/user/stores/trialStore'
import { formatShort, formatSummary, GradeMark } from '@/user/pages/trial/WeaknessResultPage'

/** 선지 번호 → 원문자 (①~⑤) · 단답형은 값 그대로 */
const circled = (n: number | null | undefined, short: boolean) =>
  n == null ? '—' : short ? String(n) : String.fromCodePoint(0x245f + n)

/**
 * 세트 풀이 결과 (/solve/result/:subject · Figma 3620-8224)
 *
 * 맛보기 진단 결과(/weakness)와 같은 조판이지만, 진단 이후 다시 푼 세트(FREE·DAILY)의
 * "이번 세트" 결과만 보여준다 — 점수 카드 + 정답 수·풀이 시간 + 문항별 결과(해설 버튼).
 * 완료 → 소단원 평균 점수 변동 화면(/solve-result · 3620-8320).
 *
 * 데이터는 풀이 세션(solveStore)에서 — 마지막 제출의 서버 채점이 아직 안 왔으면(pending)
 * 그 행은 대기 표시로 두고 응답이 오면 채워진다. 세션이 없으면(새로고침) 홈으로.
 */
export default function SolveSetResultPage() {
  const navigate = useNavigate()
  // 결과 화면에서 뒤로가기 차단 — 풀이 화면으로 되돌아가 재제출되는 길을 막는다. 나가기는 화면 버튼으로만
  useBlockBackNavigation()
  const { subject: subjectParam } = useParams<{ subject: Subject }>()
  const subject: Subject = subjectParam === 'english' ? 'english' : 'math'

  const session = useSolveStore((s) => s.session)
  const results = useSolveStore((s) => s.results)
  const diagnosis = useTrialProgressStore((s) => (session?.unitName ? s.diagnosed[session.unitName] : undefined))

  useEffect(() => {
    if (!session || !session.setId || !session.unitName) navigate('/home', { replace: true })
  }, [session, navigate])

  const rows = useMemo(() => {
    if (!session) return []
    return session.problems.map((problem, i) => {
      const r = results[problem.id]
      const short = problem.choices.length === 0
      const seconds = Math.round((r?.elapsedMs ?? 0) / 1000)
      const pending = !r || r.pending
      const correct = r?.correct ?? false
      const overTime = seconds > problem.tRecSec
      return {
        index: i,
        problem,
        pending,
        correct,
        overTime,
        short,
        myAnswer: circled(r?.selectedChoice, short),
        correctAnswer: circled(r?.answerNo, short),
        seconds,
        recSec: problem.tRecSec,
        earned: r?.earnedPoints ?? 0,
        points: problem.points,
      }
    })
  }, [session, results])

  if (!session || !session.setId || !session.unitName) return null

  const graded = rows.filter((r) => !r.pending)
  const totalPoints = rows.reduce((n, r) => n + r.points, 0)
  const earned = graded.reduce((n, r) => n + r.earned, 0)
  const allGraded = graded.length === rows.length
  const score = totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0
  const correctCount = graded.filter((r) => r.correct).length
  const totalSec = rows.reduce((n, r) => n + r.seconds, 0)

  const goScoreChange = () =>
    navigate(`/solve-result/${subject}/${encodeURIComponent(session.unitName!)}`, {
      replace: true,
      state: {
        setId: session.setId,
        before: session.scoreBefore ?? null,
        returnTo: session.returnTo || '/home',
      },
    })

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-[#fff1f2] to-white">
      <OnboardingHeader onClose={goScoreChange} />

      <main className="flex w-full flex-1 flex-col items-center">
        {/* 점수 요약 카드 */}
        <div className="flex w-full justify-center px-[40px] py-[20px] max-md:px-lg">
          <div className="flex w-full max-w-[620px] flex-col items-center overflow-hidden rounded-[16px] border border-[#f8f8f8] bg-white pt-[20px] shadow-[0px_4px_20px_0px_rgba(113,20,39,0.08)]">
            <div className="flex flex-col items-center gap-[8px] px-[20px] pb-[16px]">
              {diagnosis?.weak && (
                <span className="rounded-full border border-primary bg-[#fff1f2] px-[6px] py-[4px] text-[12px] font-semibold leading-[1.4] text-primary">
                  약점
                </span>
              )}
              <p className="text-[22px] font-semibold leading-[1.4] text-[#121417]">{session.unitName}</p>
              <p className={clsx('text-[#121417]', !allGraded && 'animate-pulse text-[#a6abb1]')}>
                <span className="text-[32px] font-bold leading-none">{allGraded ? score : '…'}</span>
                <span className="text-[22px] font-semibold leading-[1.4]">점</span>
              </p>
            </div>
            <div className="flex w-full items-center border-t border-[#e5e7ea] bg-[#f8f8f8] p-[16px]">
              <div className="flex flex-1 flex-col items-center gap-[8px] text-center">
                <p className="text-[12px] font-semibold text-[#80858b]">정답 수</p>
                <p className="text-[20px] font-semibold tabular-nums text-[#121417]">
                  {allGraded ? correctCount : '—'}/{rows.length}문제
                </p>
              </div>
              <div className="h-[32px] w-px bg-[#e5e7ea]" />
              <div className="flex flex-1 flex-col items-center gap-[8px] text-center">
                <p className="text-[12px] font-semibold text-[#80858b]">풀이 시간</p>
                <p className="text-[20px] font-semibold tabular-nums text-[#121417]">{formatSummary(totalSec)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 문항별 결과 */}
        <section className="flex w-full flex-1 flex-col items-center gap-lg bg-white px-[40px] py-[20px] pb-[120px] max-md:px-lg">
          <h2 className="w-full max-w-[620px] text-[18px] font-bold text-[#23272b]">문항별 결과</h2>

          <div className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-[12px] border border-[#e5e7ea]">
            <div className="flex w-full items-center gap-[8px] border-b border-[#e5e7ea] bg-[#f8f8f8] px-[12px]">
              <div className="flex w-[52px] shrink-0 items-center justify-center py-[16px]">
                <p className="text-[12px] font-semibold text-[#80858b]">문항</p>
              </div>
              {['답안', '풀이 시간', '획득 점수'].map((label) => (
                <div key={label} className="flex min-w-0 flex-1 items-center justify-center py-[16px]">
                  <p className="whitespace-nowrap text-[12px] font-semibold text-[#80858b]">{label}</p>
                </div>
              ))}
              <div className="flex w-[45px] shrink-0 items-center justify-end py-[16px]">
                <p className="text-[12px] font-semibold text-[#80858b]">결과</p>
              </div>
            </div>

            {rows.map((row, i) => {
              const wrong = !row.pending && !row.correct
              return (
                <div
                  key={row.problem.id}
                  className="flex w-full items-center gap-[8px] border-b border-[#e5e7ea] bg-white p-[12px] last:border-b-0"
                >
                  <div className="relative flex size-[52px] shrink-0 items-center justify-center">
                    <p className="text-[16px] font-bold text-[#121417]">{i + 1}번</p>
                    {!row.pending && (
                      <GradeMark
                        kind={row.correct ? (row.overTime ? 'triangle' : 'circle') : 'slash'}
                        delayMs={200 + i * 250}
                      />
                    )}
                  </div>

                  <div className={clsx('flex min-w-0 flex-1 flex-col items-center justify-center', wrong ? 'text-primary' : 'text-[#121417]')}>
                    <p className="whitespace-nowrap text-[14px] font-semibold">내 답 {row.myAnswer}</p>
                    <p className={clsx('whitespace-nowrap text-[12px] font-semibold', !wrong && 'text-[#a6abb1]')}>
                      정답 {row.pending ? '…' : row.correctAnswer}
                    </p>
                  </div>

                  <div className={clsx('flex min-w-0 flex-1 flex-col items-center justify-center', row.overTime ? 'text-primary' : 'text-[#121417]')}>
                    <p className="whitespace-nowrap text-[14px] font-semibold tabular-nums">{formatShort(row.seconds)}</p>
                    <p className={clsx('whitespace-nowrap text-[12px] font-semibold tabular-nums', !row.overTime && 'text-[#a6abb1]')}>
                      권장 {formatShort(row.recSec)}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                    <p className="whitespace-nowrap text-[14px] font-semibold tabular-nums text-[#121417]">
                      {row.pending ? '…' : `${Number.isInteger(row.earned) ? row.earned : row.earned.toFixed(1)}점`}
                    </p>
                    <p className="whitespace-nowrap text-[12px] font-semibold tabular-nums text-[#a6abb1]">배점 {row.points}점</p>
                  </div>

                  <button
                    type="button"
                    disabled={row.pending}
                    onClick={() => navigate(`/solve/review/${subject}/${row.index}`)}
                    className="shrink-0 rounded-[10px] bg-[#f0f1f3] px-[12px] py-[8px] text-[12px] font-semibold text-[#5e6368] disabled:opacity-40"
                  >
                    해설
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      {/* 완료 — 점수 변동 화면으로 */}
      <div className="fixed inset-x-0 bottom-0 flex justify-center bg-white px-[20px] pb-[max(28px,env(safe-area-inset-bottom))] pt-[20px]">
        <button
          type="button"
          onClick={goScoreChange}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] text-[16px] font-bold text-white transition-opacity hover:opacity-90"
        >
          완료
        </button>
      </div>
    </div>
  )
}

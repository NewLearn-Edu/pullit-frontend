import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { getProblemsByEnglishType, getProblemsBySkillNode, type Problem } from '@/user/data/mockProblems'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { fetchSkillScores, type SkillScore } from '@/user/api/attemptApi'
import { useTasteStore, type QuizItemResult } from '@/user/stores/tasteStore'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import markStyles from './styles/WeaknessResultPage.module.scss'

/** m:ss (풀이 시간 셀) */
function formatShort(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "2분 48초" (요약 카드) */
function formatSummary(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

/** 1~5 → ①~⑤ (U+2460) · 무응답은 '-' */
function circled(choice: number | null): string {
  if (choice == null || choice < 1 || choice > 5) return '-'
  return String.fromCodePoint(0x2460 + choice - 1)
}

/** 서버 skill_node("지수와 로그") ↔ 표기명("지수·로그") 느슨 매칭 */
const normalize = (s: string) => s.replace(/[·\s]/g, '').replace(/와|과/g, '')

/**
 * 채점 마크 — 정답 동그라미 · 오답 빗금이 펜으로 긋듯 그려진다.
 * delayMs 로 문항 순서대로 스태거 (선생님이 위에서부터 채점하는 느낌)
 */
function GradeMark({ correct, delayMs }: { correct: boolean; delayMs: number }) {
  const style = { '--delay': `${delayMs}ms` } as React.CSSProperties
  return correct ? (
    <svg viewBox="0 0 51 51" className={markStyles.mark} style={style} role="img" aria-label="정답">
      <circle cx="25.5" cy="25.5" r="24.5" className={markStyles.correctCircle} />
    </svg>
  ) : (
    <svg viewBox="0 0 51 51" className={markStyles.mark} style={style} role="img" aria-label="오답">
      <line x1="43" y1="8" x2="8" y2="43" className={markStyles.wrongLine} />
    </svg>
  )
}

interface Row {
  result: QuizItemResult
  problem: Problem | undefined
  subject: 'math' | 'english'
  /** 해설 리뷰 라우팅용 — 과목 내 문제 인덱스 */
  reviewIdx: number
}

/**
 * 학습 결과 — 일반 (Figma 2641-10993 · 단원 평가/자유 문제 채점 결과)
 * 헤더의 점수·약점은 서버 누적 단원 점수(skill-scores) — 세션 결과는 폴백.
 * 오답 재풀이(RETRY) 결과 화면은 점수 없이 별도 변형 예정 (2661-4588).
 */
export default function WeaknessResultPage() {
  const navigate = useNavigate()
  const isMember = useUserStore(selectIsMember)
  const {
    mathSkillNodeId,
    englishTypeId,
    mathResults,
    englishResults,
    lastSubject,
    hasCompletedSession,
  } = useTasteStore()

  // persist rehydrate 전에 판정하면 정상 완주자도 튕긴다
  const hydrated = useTasteStore.persist?.hasHydrated?.() ?? true

  // 채점하기 → 결과 직행 플로우 — 전송 실패분 회수를 여기서 수행
  useEffect(() => {
    flushAttemptQueue()
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!hasCompletedSession()) {
      navigate('/taste', { replace: true })
    }
  }, [hydrated, hasCompletedSession, navigate])

  const subject = lastSubject ?? 'math'

  const mathProblems = useMemo(
    () => (mathSkillNodeId ? getProblemsBySkillNode(mathSkillNodeId) : []),
    [mathSkillNodeId],
  )
  const englishProblems = useMemo(
    () => (englishTypeId ? getProblemsByEnglishType(englishTypeId) : []),
    [englishTypeId],
  )

  const rows: Row[] = useMemo(
    () => [
      ...mathResults.map((result) => ({
        result,
        problem: mathProblems.find((p) => p.id === result.problemId),
        subject: 'math' as const,
        reviewIdx: mathProblems.findIndex((p) => p.id === result.problemId),
      })),
      ...englishResults.map((result) => ({
        result,
        problem: englishProblems.find((p) => p.id === result.problemId),
        subject: 'english' as const,
        reviewIdx: englishProblems.findIndex((p) => p.id === result.problemId),
      })),
    ],
    [mathResults, englishResults, mathProblems, englishProblems],
  )

  /** 이번에 푼 단원 표기명 */
  const unitName =
    subject === 'english'
      ? '빈칸' // POC 고정 (en-blank)
      : MOCK_SKILL_NODES.find((n) => n.id === mathSkillNodeId)?.name ?? '수학'

  // 누적 단원 점수 (서버) — 맞춘 배점/푼 배점 ×100 · RETRY 제외 (2026-08-10 정책)
  const [skillScore, setSkillScore] = useState<SkillScore | null>(null)
  useEffect(() => {
    let alive = true
    fetchSkillScores(subject)
      .then((list) => {
        if (!alive) return
        setSkillScore(
          list.find((s) => normalize(s.skillNode) === normalize(unitName)) ?? null,
        )
      })
      .catch(() => {}) // 실패 시 세션 결과 폴백
    return () => {
      alive = false
    }
  }, [subject, unitName])

  // 세션 결과 기반 폴백 점수 (같은 공식)
  const local = useMemo(() => {
    const total = rows.reduce((s, r) => s + (r.problem?.points ?? 0), 0)
    const earned = rows.reduce(
      (s, r) => s + ((r.result.serverCorrect ?? r.result.correct) ? r.problem?.points ?? 0 : 0),
      0,
    )
    return total === 0 ? 0 : Math.round((earned * 100) / total)
  }, [rows])

  const score = skillScore?.score ?? local
  const weak = skillScore?.weak ?? score < 70

  const correctCount = rows.filter(({ result }) => result.serverCorrect ?? result.correct).length
  const totalSec = Math.round(rows.reduce((s, { result }) => s + result.elapsedMs, 0) / 1000)

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <OnboardingHeader onClose={() => navigate('/home')} />

      <main className="flex w-full flex-1 flex-col items-center gap-[28px] px-[40px] py-[24px] pb-[120px] max-md:gap-xl max-md:px-lg">
        {/* 단원명 + 약점 뱃지 + 누적 점수 */}
        <div className="flex w-full max-w-[620px] items-center justify-between gap-md">
          <div className="flex min-w-0 items-center gap-sm">
            <h1 className="truncate text-[24px] font-bold text-[#171211] max-md:text-[22px]">
              {unitName}
            </h1>
            {weak && (
              <span className="shrink-0 rounded-full bg-[#fff1f2] px-[10px] py-[4px] text-[12px] font-semibold text-primary">
                약점
              </span>
            )}
          </div>
          <p className="shrink-0 text-[32px] font-bold text-[#121417] max-md:text-[28px]">
            {score}점
          </p>
        </div>

        {/* 정답 수 · 풀이 시간 */}
        <div className="flex w-full max-w-[620px] gap-md">
          <div className="flex flex-1 flex-col gap-md rounded-[12px] bg-[#f8f8f8] p-[20px] max-md:p-lg">
            <p className="text-[12px] font-medium text-[#80858b]">정답 수</p>
            <p className="text-[24px] font-bold text-[#121417] max-md:text-[22px]">
              {correctCount}/{rows.length}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-md rounded-[12px] bg-[#f8f8f8] p-[20px] max-md:p-lg">
            <p className="text-[12px] font-medium text-[#80858b]">풀이 시간</p>
            <p className="text-[24px] font-bold text-[#121417] max-md:text-[22px]">
              {formatSummary(totalSec)}
            </p>
          </div>
        </div>

        {/* 문항별 결과 */}
        <section className="flex w-full max-w-[620px] flex-col gap-lg">
          <h2 className="text-[18px] font-semibold text-[#23272b]">문항별 결과</h2>

          <div className="flex w-full flex-col overflow-hidden rounded-[12px] border border-[#f0f1f3]">
            <div className="flex w-full items-center bg-[#f8f8f8]">
              {['문항', '답안', '풀이 시간', '배점', '결과'].map((label) => (
                <div key={label} className="flex flex-1 items-center justify-center p-md">
                  <p className="whitespace-nowrap text-[13px] text-[#80858b]">{label}</p>
                </div>
              ))}
            </div>

            {rows.map(({ result, problem, subject: rowSubject, reviewIdx }, i) => {
              const elapsedSec = Math.round(result.elapsedMs / 1000)
              const recSec = problem?.tRecSec ?? 0
              const overTime = recSec > 0 && elapsedSec > recSec
              const isCorrect = result.serverCorrect ?? result.correct
              // 배점 표기 — 정답은 감점 반영 획득 점수, 오답은 원 배점
              const points = isCorrect ? result.earnedPoints : problem?.points ?? 0
              const shortAnswer = problem?.choices.length === 0

              return (
                <div
                  key={`${result.problemId}-${i}`}
                  className="flex w-full items-center border-t border-[#f0f1f3]"
                >
                  <div className="relative flex min-w-0 flex-1 items-center justify-center self-stretch px-sm py-lg">
                    <p className="whitespace-nowrap text-[16px] font-bold text-[#121417]">
                      {i + 1}번
                    </p>
                    <GradeMark correct={isCorrect} delayMs={300 + i * 350} />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center self-stretch px-sm py-lg">
                    <p className="whitespace-nowrap text-[14px] text-[#121417]">
                      내답{' '}
                      <span className="font-semibold">
                        {shortAnswer ? result.selectedChoice ?? '-' : circled(result.selectedChoice)}
                      </span>
                    </p>
                    <p
                      className={clsx(
                        'whitespace-nowrap text-[13px]',
                        isCorrect ? 'text-[#80858b]' : 'text-primary',
                      )}
                    >
                      정답{' '}
                      {problem
                        ? shortAnswer
                          ? problem.answer
                          : circled(problem.answer)
                        : '-'}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center self-stretch px-sm py-lg">
                    <p
                      className={clsx(
                        'whitespace-nowrap text-[16px] font-semibold',
                        overTime ? 'text-primary' : 'text-[#121417]',
                      )}
                    >
                      {formatShort(elapsedSec)}
                    </p>
                    {recSec > 0 && (
                      <p className="whitespace-nowrap text-[12px] text-[#a6abb1]">
                        권장 {formatShort(recSec)}
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 items-center justify-center self-stretch px-sm py-lg">
                    <p className="whitespace-nowrap text-[15px] font-bold text-[#121417]">
                      {Number.isInteger(points) ? points : points.toFixed(1)}점
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-1 items-center justify-center self-stretch px-sm py-lg">
                    {problem && reviewIdx >= 0 ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/taste/review/${rowSubject}/${reviewIdx}`)}
                        className="whitespace-nowrap rounded-[8px] border border-[#e5e7ea] bg-[#f8f8f8] px-[12px] py-[7px] text-[13px] font-semibold text-[#40464c] transition-colors hover:bg-[#f0f1f3]"
                      >
                        해설
                      </button>
                    ) : (
                      <span className="text-[13px] text-[#a6abb1]">-</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 flex min-w-[350px] justify-center bg-white px-[40px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-[12px] max-md:px-lg">
        <button
          type="button"
          onClick={() => navigate(isMember ? '/home' : '/signup')}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] px-xl text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          완료
        </button>
      </footer>
    </div>
  )
}

import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { getProblemsByEnglishType, getProblemsBySkillNode, type Problem } from '@/user/data/mockProblems'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
import { flushAttemptQueue } from '@/user/services/attemptQueue'
import { useTasteStore, type QuizItemResult } from '@/user/stores/tasteStore'
import { selectIsMember, useUserStore } from '@/user/stores/userStore'
import markCorrect from '@/assets/result/mark-correct.svg'
import markWrong from '@/assets/result/mark-wrong.svg'

/** 0:48 형태 (분 자릿수 고정 안 함) — 표 안 개별 문항용 */
function formatShort(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 02:48 형태 (분 두 자리) — 상단 합계용 */
function formatLong(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 1~5 → ①~⑤ (U+2460) · 무응답은 '-' */
function circled(choice: number | null): string {
  if (choice == null || choice < 1 || choice > 5) return '-'
  return String.fromCodePoint(0x2460 + choice - 1)
}

interface Row {
  result: QuizItemResult
  problem: Problem | undefined
  subject: 'math' | 'english'
  /** 해설 리뷰 라우팅용 — 과목 내 문제 인덱스 */
  reviewIdx: number
}

export default function WeaknessResultPage() {
  const navigate = useNavigate()
  const isMember = useUserStore(selectIsMember)
  const {
    mathSkillNodeId,
    englishTypeId,
    mathResults,
    englishResults,
    hasCompletedSession,
    totalEarnedPoints,
  } = useTasteStore()

  // persist rehydrate 전에 판정하면 정상 완주자도 튕긴다
  const hydrated = useTasteStore.persist?.hasHydrated?.() ?? true

  // 채점하기 → 결과 직행 플로우 변경으로, 전송 실패분 회수를 여기서 수행 (기존 완료 페이지 역할)
  useEffect(() => {
    flushAttemptQueue()
  }, [])

  useEffect(() => {
    // 완주하지 않은 접근은 시작 페이지로 (완료 페이지와 동일 가드 · 실제로 푼 과목만 검사)
    if (!hydrated) return
    if (!hasCompletedSession()) {
      navigate('/taste', { replace: true })
    }
  }, [hydrated, hasCompletedSession, navigate])

  const mathProblems = useMemo(
    () => (mathSkillNodeId ? getProblemsBySkillNode(mathSkillNodeId) : []),
    [mathSkillNodeId],
  )
  const englishProblems = useMemo(
    () => (englishTypeId ? getProblemsByEnglishType(englishTypeId) : []),
    [englishTypeId],
  )

  // 표는 수학 → 영어 순으로 이어 붙여 1번부터 통짜 번호를 매긴다
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

  /** 약점 = 정답률이 낮은 쪽 영역 (동률이면 수학) */
  const weaknessName = useMemo(() => {
    const rate = (list: QuizItemResult[]) =>
      list.length === 0 ? 1 : list.filter((r) => r.correct).length / list.length
    const mathName =
      MOCK_SKILL_NODES.find((n) => n.id === mathSkillNodeId)?.name ?? '수학'
    // POC 는 영어 유형이 빈칸(en-blank)으로 고정 — 유형 선택이 열리면 englishAbilities 데이터로 대체
    const englishName = englishTypeId === 'en-blank' ? '빈칸' : '영어'
    return rate(mathResults) <= rate(englishResults) ? mathName : englishName
  }, [mathResults, englishResults, mathSkillNodeId, englishTypeId])

  const totalSec = Math.round(
    rows.reduce((sum, { result }) => sum + result.elapsedMs, 0) / 1000,
  )

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <OnboardingHeader onClose={() => navigate('/home')} />

      <main className="flex w-full flex-1 flex-col items-center gap-[40px] px-[40px] py-[40px] max-md:gap-xl max-md:px-lg max-md:py-xl">
        <div className="flex w-full max-w-[620px] flex-col gap-lg">
          <h1 className="break-keep text-[24px] font-bold text-[#171211] max-md:text-[22px]">
            너 {weaknessName} 약점이야
          </h1>

          <div className="flex w-full gap-[40px] max-md:gap-md">
            <div className="flex flex-1 flex-col gap-lg rounded-[8px] bg-[#f5f5f5] p-[20px] max-md:p-lg">
              <p className="text-[12px] font-medium text-[#80858b]">진단 점수</p>
              <p className="text-[24px] font-bold text-[#121417] max-md:text-[22px]">
                {totalEarnedPoints().toFixed(1)}점
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-lg rounded-[8px] bg-[#f5f5f5] p-[20px] max-md:p-lg">
              <p className="text-[12px] font-medium text-[#80858b]">푼 시간</p>
              <p className="text-[24px] font-bold text-[#121417] max-md:text-[22px]">
                {formatLong(totalSec)}
              </p>
            </div>
          </div>
        </div>

        <section className="flex w-full max-w-[620px] flex-col gap-lg">
          <h2 className="text-[18px] font-semibold text-[#23272b]">문항별 결과</h2>

          <div className="flex w-full flex-col">
            <div className="flex w-full items-center">
              {['문항', '풀이 시간', '답안', '해설'].map((label) => (
                <div
                  key={label}
                  className="flex flex-1 items-center justify-center border-b border-[#f0f1f3] p-md"
                >
                  <p className="whitespace-nowrap text-[14px] text-[#80858b]">{label}</p>
                </div>
              ))}
            </div>

            {rows.map(({ result, problem, subject, reviewIdx }, i) => {
              const elapsedSec = Math.round(result.elapsedMs / 1000)
              const recSec = problem?.tRecSec ?? 0
              const overTime = recSec > 0 && elapsedSec > recSec
              // 서버 채점이 도착했으면 그것이 진실원 (로컬 채점은 목 데이터 기준)
              const isCorrect = result.serverCorrect ?? result.correct

              return (
                <div key={`${result.problemId}-${i}`} className="flex w-full items-center">
                  <div className="relative flex min-w-0 flex-1 items-center justify-center self-stretch border-b border-[#f0f1f3] px-md py-lg">
                    <p className="whitespace-nowrap text-[16px] font-bold text-[#121417]">
                      {i + 1}번
                    </p>
                    {/* 채점 표시 — 정답은 동그라미, 오답은 대각선 사선 */}
                    {isCorrect ? (
                      <img
                        src={markCorrect}
                        alt="정답"
                        className="pointer-events-none absolute left-1/2 top-1/2 size-[51px] -translate-x-1/2 -translate-y-1/2"
                      />
                    ) : (
                      <span className="pointer-events-none absolute left-1/2 top-1/2 flex size-[36px] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                        <img
                          src={markWrong}
                          alt="오답"
                          className="w-[50.912px] rotate-[135deg]"
                        />
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center self-stretch border-b border-[#f0f1f3] px-md py-lg">
                    <p
                      className={clsx(
                        'whitespace-nowrap text-[22px] font-semibold max-md:text-[20px]',
                        overTime ? 'text-primary' : 'text-[#121417]',
                      )}
                    >
                      {formatShort(elapsedSec)}
                    </p>
                    {recSec > 0 && (
                      <p className="whitespace-nowrap text-[14px] text-[#a6abb1]">
                        권장 {formatShort(recSec)}
                      </p>
                    )}
                  </div>

                  {/* 주관식(보기 없음)은 번호 대신 값 그대로 표시 */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center self-stretch border-b border-[#f0f1f3] px-md py-lg">
                    <p className="whitespace-nowrap text-[16px] text-[#121417]">
                      내답{' '}
                      {problem?.choices.length === 0
                        ? result.selectedChoice ?? '-'
                        : circled(result.selectedChoice)}
                    </p>
                    <p
                      className={clsx(
                        'whitespace-nowrap text-[16px]',
                        isCorrect ? 'text-[#121417]' : 'text-primary',
                      )}
                    >
                      정답{' '}
                      {problem
                        ? problem.choices.length === 0
                          ? problem.answer
                          : circled(problem.answer)
                        : '-'}
                    </p>
                  </div>

                  {/* 해설 — 문제 왼쪽 · 해설 오른쪽 리뷰 화면으로 이동 */}
                  <div className="flex min-w-0 flex-1 items-center justify-center self-stretch border-b border-[#f0f1f3] px-md py-lg">
                    {problem && reviewIdx >= 0 ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/taste/review/${subject}/${reviewIdx}`)}
                        className="whitespace-nowrap rounded-[8px] border border-[#e5e7ea] px-[12px] py-[8px] text-[14px] font-semibold text-[#23272b] transition-colors hover:bg-[#f8f8f8]"
                      >
                        해설보기
                      </button>
                    ) : (
                      <span className="text-[14px] text-[#a6abb1]">-</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="flex w-full shrink-0 items-start justify-center px-[40px] pb-[48px] pt-[40px] max-md:px-lg max-md:pb-[calc(32px+env(safe-area-inset-bottom))] max-md:pt-xl">
        <button
          type="button"
          onClick={() => navigate(isMember ? '/home' : '/signup')}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] px-xl text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          {isMember ? '홈으로' : '완료'}
        </button>
      </footer>
    </div>
  )
}

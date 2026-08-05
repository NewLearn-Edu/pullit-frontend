import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import OnboardingHeader from '@/user/components/OnboardingHeader'
import { MOCK_ENGLISH_TYPES } from '@/user/data/mockEnglishTypes'
import { getProblemsByEnglishType, getProblemsBySkillNode, type Problem } from '@/user/data/mockProblems'
import { MOCK_SKILL_NODES } from '@/user/data/mockSkillNodes'
import { useTasteStore, type QuizItemResult } from '@/user/stores/tasteStore'
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
}

export default function WeaknessResultPage() {
  const navigate = useNavigate()
  const {
    mathSkillNodeId,
    englishTypeId,
    mathResults,
    englishResults,
    isMathComplete,
    isEnglishComplete,
    totalEarnedPoints,
  } = useTasteStore()

  useEffect(() => {
    // 완주하지 않은 접근은 시작 페이지로 (완료 페이지와 동일 가드)
    if (!isMathComplete() || !isEnglishComplete()) {
      navigate('/taste', { replace: true })
    }
  }, [isMathComplete, isEnglishComplete, navigate])

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
      })),
      ...englishResults.map((result) => ({
        result,
        problem: englishProblems.find((p) => p.id === result.problemId),
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
    const englishName =
      MOCK_ENGLISH_TYPES.find((t) => t.id === englishTypeId)?.name ?? '영어'
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
              {['문항', '풀이 시간', '답안'].map((label) => (
                <div
                  key={label}
                  className="flex flex-1 items-center justify-center border-b border-[#f0f1f3] p-md"
                >
                  <p className="whitespace-nowrap text-[14px] text-[#80858b]">{label}</p>
                </div>
              ))}
            </div>

            {rows.map(({ result, problem }, i) => {
              const elapsedSec = Math.round(result.elapsedMs / 1000)
              const recSec = problem?.tRecSec ?? 0
              const overTime = recSec > 0 && elapsedSec > recSec

              return (
                <div key={`${result.problemId}-${i}`} className="flex w-full items-center">
                  <div className="relative flex min-w-0 flex-1 items-center justify-center self-stretch border-b border-[#f0f1f3] px-md py-lg">
                    <p className="whitespace-nowrap text-[16px] font-bold text-[#121417]">
                      {i + 1}번
                    </p>
                    {/* 채점 표시 — 정답은 동그라미, 오답은 대각선 사선 */}
                    {result.correct ? (
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

                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center self-stretch border-b border-[#f0f1f3] px-md py-lg">
                    <p className="whitespace-nowrap text-[16px] text-[#121417]">
                      내답 {circled(result.selectedChoice)}
                    </p>
                    <p
                      className={clsx(
                        'whitespace-nowrap text-[16px]',
                        result.correct ? 'text-[#121417]' : 'text-primary',
                      )}
                    >
                      정답 {circled(problem?.answer ?? null)}
                    </p>
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
          onClick={() => navigate('/signup')}
          className="flex h-[56px] w-full max-w-[620px] items-center justify-center rounded-[12px] bg-[#23272b] px-xl text-[16px] font-bold text-white transition-opacity hover:opacity-90 active:opacity-85"
        >
          완료
        </button>
      </footer>
    </div>
  )
}

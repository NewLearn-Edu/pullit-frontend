import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/user/components/PageHeader'
import { useTrialProgressStore } from '@/user/stores/trialProgressStore'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/trialStore'
import { formatShort, formatSummary, GradeMark } from '@/user/pages/trial/WeaknessResultPage'

/**
 * 진단 결과 재열람 (/unit-result/:subject/:unitName)
 * 홈 소단원 리스트에서 진단 완료 행을 누르면 들어온다.
 * WeaknessResultPage 와 같은 조판이지만 세션이 아니라 박제된 진단 결과
 * (trialProgressStore.diagnosed[unitName]) 로 그린다 — 채점 마크만 다시 그려지는 정적 화면.
 *
 * 문항별 결과(items)는 저장 이후 진단분에만 있다. 없으면(데모 시드 등) 요약만 보여준다.
 */
export default function UnitResultPage() {
  const navigate = useNavigate()
  // subject 는 URL 문맥용 — diagnosed 는 unitName(=skill_node) 하나로 키가 잡힌다
  const { unitName: unitNameParam } = useParams<{ subject: Subject; unitName: string }>()
  const unitName = unitNameParam ? decodeURIComponent(unitNameParam) : ''

  const sessionStatus = useUserStore((s) => s.status)
  const diagnosis = useTrialProgressStore((s) => s.diagnosed[unitName])

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  // 진단 기록이 없는 단원 — 홈으로 (주소 직접 입력 등)
  useEffect(() => {
    if (!diagnosis) navigate('/home', { replace: true })
  }, [diagnosis, navigate])

  if (!diagnosis) return null

  const items = diagnosis.items ?? []
  const totalSec = items.length > 0 ? items.reduce((s, it) => s + it.seconds, 0) : null

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PageHeader backTo="history" />

      <main className="flex w-full flex-1 flex-col items-center gap-[28px] px-[40px] py-[24px] pb-[60px] max-md:gap-xl max-md:px-lg">
        {/* 단원명 + 약점 뱃지 + 점수 */}
        <div className="flex w-full max-w-[620px] flex-col gap-[6px]">
          <div className="flex w-full items-center justify-between gap-md">
            <div className="flex min-w-0 items-center gap-sm">
              <h1 className="truncate text-[24px] font-bold text-[#171211] max-md:text-[22px]">
                {unitName}
              </h1>
              {diagnosis.weak && (
                <span className="shrink-0 rounded-full bg-primary px-[12px] py-[5px] text-[13px] font-bold text-white">
                  약점
                </span>
              )}
            </div>
            <p className="shrink-0 text-[32px] font-bold tabular-nums text-[#121417] max-md:text-[28px]">
              {diagnosis.score}점
            </p>
          </div>
          <p className="text-[13px] font-medium text-[#a6abb1]">진단일 {diagnosis.date}</p>
        </div>

        {/* 정답 수 · 풀이 시간 */}
        <div className="flex w-full max-w-[620px] gap-md">
          <div className="flex flex-1 flex-col gap-md rounded-[12px] bg-[#f8f8f8] p-[20px] max-md:p-lg">
            <p className="text-[12px] font-medium text-[#80858b]">정답 수</p>
            <p className="text-[24px] font-bold tabular-nums text-[#121417] max-md:text-[22px]">
              {diagnosis.correct}
              {items.length > 0 && `/${items.length}`}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-md rounded-[12px] bg-[#f8f8f8] p-[20px] max-md:p-lg">
            <p className="text-[12px] font-medium text-[#80858b]">풀이 시간</p>
            <p className="text-[24px] font-bold tabular-nums text-[#121417] max-md:text-[22px]">
              {totalSec != null ? formatSummary(totalSec) : `${diagnosis.minutes}분`}
            </p>
          </div>
        </div>

        {/* 문항별 결과 — 박제된 진단분에만 존재 */}
        {items.length > 0 && (
          <section className="flex w-full max-w-[620px] flex-col gap-lg">
            <h2 className="text-[18px] font-semibold text-[#23272b]">문항별 결과</h2>

            <div className="flex w-full flex-col overflow-hidden rounded-[12px] border border-[#f0f1f3]">
              <div className="flex w-full items-center bg-[#f8f8f8]">
                {['문항', '답안', '풀이 시간', '점수'].map((label) => (
                  <div key={label} className="flex flex-1 items-center justify-center p-md">
                    <p className="whitespace-nowrap text-[13px] text-[#80858b]">{label}</p>
                  </div>
                ))}
              </div>

              {items.map((item, i) => (
                <div
                  key={i}
                  className="flex min-h-[76px] w-full items-center border-t border-[#f0f1f3] py-md"
                >
                  <div className="relative flex min-w-0 flex-1 items-center justify-center self-stretch px-sm">
                    <p className="whitespace-nowrap text-[16px] font-bold text-[#121417]">
                      {i + 1}번
                    </p>
                    <GradeMark
                      kind={item.correct ? (item.overTime ? 'triangle' : 'circle') : 'slash'}
                      delayMs={200 + i * 250}
                    />
                  </div>

                  {/* 답안 — 내 답만 크게 · 정답 보조줄은 틀렸을 때만 */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                    <p className="whitespace-nowrap text-[16px] font-medium text-[#121417]">
                      {item.short ? (
                        item.myAnswer
                      ) : (
                        <span className="text-[20px] leading-none">{item.myAnswer}</span>
                      )}
                    </p>
                    {!item.correct && (
                      <p className="flex items-center gap-[4px] whitespace-nowrap text-[15px] font-medium text-primary">
                        정답
                        {item.short ? (
                          <span className="font-semibold">{item.correctAnswer}</span>
                        ) : (
                          <span className="text-[20px] leading-none">{item.correctAnswer}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* 풀이 시간 — 권장 보조줄은 초과했을 때만 */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                    <p className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-[#121417]">
                      {formatShort(item.seconds)}
                    </p>
                    {item.overTime && (
                      <p className="whitespace-nowrap text-[15px] font-medium tabular-nums text-primary">
                        권장 {formatShort(item.recSec)}
                      </p>
                    )}
                  </div>

                  {/* 점수 — 배점 보조줄은 만점이 아닐 때만 */}
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                    <p className="whitespace-nowrap text-[15px] font-bold tabular-nums text-[#121417]">
                      {Number.isInteger(item.earned) ? item.earned : item.earned.toFixed(1)}점
                    </p>
                    {item.earned < item.points && (
                      <p className="whitespace-nowrap text-[12px] tabular-nums text-[#a6abb1]">
                        배점 {item.points}점
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {items.length === 0 && (
          <p className="w-full max-w-[620px] text-[14px] text-[#a6abb1]">
            이 진단은 문항별 기록이 저장되기 전에 진행돼서 요약만 볼 수 있어
          </p>
        )}
      </main>
    </div>
  )
}

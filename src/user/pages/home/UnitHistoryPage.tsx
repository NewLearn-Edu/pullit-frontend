import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/user/components/PageHeader'
import { RecentStudyCard, historyToCard } from '@/user/components/RecentStudyCard'
import { fetchUnitSetHistory, type UnitSetHistory } from '@/user/api/problemSetApi'
import { CURRICULUM } from '@/user/data/curriculum'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/trialStore'

/**
 * 단원 최근 학습 전체보기 (/unit-history/:subject/:unitCode · Figma 3808-8044 "전체보기")
 * 홈 단원 상세 시트의 "최근 학습"은 3개까지만 보이고, 여기서 이 단원에서 완료한 세트 전부를
 * 최근 순으로 같은 카드로 나열한다. 데이터는 GET /api/problem-sets/history (세트별 문항 결과·세트 점수).
 */
export default function UnitHistoryPage() {
  const navigate = useNavigate()
  const { subject: subjectParam, unitCode: unitCodeParam } = useParams<{ subject: Subject; unitCode: string }>()
  const subject: Subject = subjectParam === 'english' ? 'english' : 'math'
  const unitCode = unitCodeParam ? decodeURIComponent(unitCodeParam) : ''
  const unitName =
    CURRICULUM[subject].flatMap((c) => c.units).find((u) => u.unitCode === unitCode)?.name ?? unitCode

  const sessionStatus = useUserStore((s) => s.status)
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  const [rows, setRows] = useState<UnitSetHistory[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!unitCode) return
    let alive = true
    fetchUnitSetHistory(unitCode)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [unitCode])

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PageHeader
        backTo="history"
        center={<h1 className="text-[16px] font-semibold text-[#121417]">최근 학습</h1>}
      />

      <main className="flex w-full flex-1 flex-col items-center px-[40px] py-[24px] pb-[60px] max-md:px-lg">
        <div className="flex w-full max-w-[620px] flex-col gap-[16px]">
          <div className="flex w-full items-center justify-between px-[8px]">
            <h2 className="text-[18px] font-bold leading-[1.4] text-[#121417]">{unitName}</h2>
            {rows && rows.length > 0 && (
              <span className="text-[12px] font-semibold text-[#80858b]">총 {rows.length}회</span>
            )}
          </div>

          {failed ? (
            <p className="py-[40px] text-center text-[14px] text-[#80858b]">학습 기록을 불러오지 못했어. 잠시 후 다시 시도해줘</p>
          ) : rows == null ? null : rows.length === 0 ? (
            <p className="py-[40px] text-center text-[14px] text-[#80858b]">아직 이 단원에서 완료한 학습이 없어</p>
          ) : (
            <div className="flex w-full flex-col gap-[8px]">
              {rows.map((h) => (
                <RecentStudyCard key={h.setId} {...historyToCard(h)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

import { StatCard } from './StatCard'
import { ENGLISH_PROBLEMS, MATH_PROBLEMS } from '../data/mockAdmin'

/** 문제 섹션(목록·업로드) 공통 KPI — 전체 / 수학 / 영어 */
export function ProblemKpi() {
  const mathPending = MATH_PROBLEMS.filter((p) => p.status === 'pending').length
  const engPending = ENGLISH_PROBLEMS.filter((p) => p.status === 'pending').length
  return (
    <div className="kpi-section">
      <h2 className="section-title">전체 문제 현황</h2>
      <div className="kpi-problems">
        <StatCard
          label="전체 문제"
          value={(MATH_PROBLEMS.length + ENGLISH_PROBLEMS.length).toLocaleString()}
          delta={`검수 대기 ${mathPending + engPending}건`}
          tone="up"
        />
        <StatCard
          label="수학 문제"
          value={MATH_PROBLEMS.length.toLocaleString()}
          delta={`검수 대기 ${mathPending}건`}
          tone="up"
        />
        <StatCard
          label="영어 문제"
          value={ENGLISH_PROBLEMS.length.toLocaleString()}
          delta={`검수 대기 ${engPending}건`}
          tone="up"
        />
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { StatCard } from './StatCard'
import { fetchProblemStats, type ApiSubject, type ProblemStats } from '../api/adminApi'

/** 문제 섹션(목록·업로드) 공통 KPI — 전체 / 수학 / 영어 */
export function ProblemKpi() {
  const { pathname } = useLocation()
  const [stats, setStats] = useState<ProblemStats | null>(null)

  // 업로드 직후 목록으로 이동하면 값이 바뀌므로 문제 섹션 내 경로 이동마다 재조회 (count 쿼리라 가볍다)
  useEffect(() => {
    let alive = true
    fetchProblemStats()
      .then((data) => alive && setStats(data))
      .catch(() => alive && setStats(null))
    return () => {
      alive = false
    }
  }, [pathname])

  const subjectOf = (subject: ApiSubject) => stats?.subjects.find((s) => s.subject === subject)
  const count = (value: number | undefined) => (value == null ? '—' : value.toLocaleString())
  const delta = (value: number | undefined) => (value == null ? '—' : `비공개 ${value}건`)

  const math = subjectOf('MATH')
  const english = subjectOf('ENGLISH')

  return (
    <div className="kpi-section">
      <h2 className="section-title">전체 문제 현황</h2>
      <div className="kpi-problems">
        <StatCard
          label="전체 문제"
          value={count(stats?.totalCount)}
          delta={delta(stats?.inactiveCount)}
          tone="up"
        />
        <StatCard
          label="수학 문제"
          value={count(math?.count)}
          delta={delta(math?.inactiveCount)}
          tone="up"
        />
        <StatCard
          label="영어 문제"
          value={count(english?.count)}
          delta={delta(english?.inactiveCount)}
          tone="up"
        />
      </div>
    </div>
  )
}

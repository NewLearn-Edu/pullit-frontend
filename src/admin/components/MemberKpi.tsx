import { useEffect, useState } from 'react'
import { fetchAdminUsers, type AdminUser } from '../api/adminApi'
import { StatCard } from './StatCard'

/**
 * 회원 현황 KPI — 전체 회원 · 게스트 · 오늘 가입 (2026-09-07).
 * 문제 섹션 "전체 문제 현황"과 같은 규격(kpi-section · 표시 전용). 회원 섹션의 모든 페이지 상단에 둔다.
 * 목록을 이미 가진 화면(전체 회원)은 users 를 넘겨 재조회를 피하고, 없으면 스스로 조회한다.
 */
export function MemberKpi({ users: given }: { users?: AdminUser[] | null }) {
  const [fetched, setFetched] = useState<AdminUser[] | null>(null)
  useEffect(() => {
    if (given !== undefined) return
    let alive = true
    fetchAdminUsers()
      .then((list) => alive && setFetched(list))
      .catch(() => alive && setFetched(null))
    return () => {
      alive = false
    }
  }, [given])

  const users = given !== undefined ? given : fetched
  const ready = users != null
  const list = users ?? []

  const todayKey = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const memberCount = list.filter((u) => (u.type ?? 'USER') === 'USER').length
  const guestCount = list.length - memberCount
  const withdrawnCount = list.filter((u) => u.status === 'DELETED').length
  const joinedToday = list.filter((u) => u.createdAt?.slice(0, 10) === todayKey).length
  const joinedWeek = list.filter((u) => (u.createdAt?.slice(0, 10) ?? '') >= weekAgo).length
  const activeWeek = list.filter((u) => (u.lastActiveAt?.slice(0, 10) ?? '') >= weekAgo).length
  const n = (v: number) => (ready ? v.toLocaleString() : '—')

  return (
    <div className="kpi-section">
      <h2 className="section-title">전체 회원 현황</h2>
      <div className="kpi-problems">
        <StatCard label="전체 회원" value={n(memberCount)} delta={ready ? `탈퇴 유예 ${withdrawnCount}건` : '—'} tone="up" />
        <StatCard label="게스트" value={n(guestCount)} delta="맛보기만 하고 미가입" tone="flat" />
        <StatCard
          label="오늘 가입"
          value={n(joinedToday)}
          delta={ready ? `최근 7일 ${joinedWeek}명 · 7일 내 활동 ${activeWeek}명` : '—'}
          tone="good"
        />
      </div>
    </div>
  )
}

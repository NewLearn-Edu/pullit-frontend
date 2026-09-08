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
  // 풀잇 관계자(is_staff) 는 모든 집계에서 제외 — 팀원·테스트 계정이 회원 수를 부풀리지 않게 (2026-09-08)
  const staffCount = (users ?? []).filter((u) => u.staff).length
  const list = (users ?? []).filter((u) => !u.staff)

  const todayKey = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  // 상태 모델(2026-09-08): 회원 = USER 이면서 PENDING 아님 · 가입 중 = PENDING(게스트 출신·직가입 합산) · 게스트 = GUEST·GUEST
  // (status 를 안 주는 구서버는 type 으로만 — 그래서 status === 'GUEST' 대신 "GUEST 인데 PENDING 아님")
  const pendingCount = list.filter((u) => u.status === 'PENDING').length
  const memberCount = list.filter((u) => (u.type ?? 'USER') === 'USER' && u.status !== 'PENDING').length
  const guestCount = list.filter((u) => u.type === 'GUEST' && u.status !== 'PENDING').length
  const withdrawnCount = list.filter((u) => u.status === 'DELETED').length
  const joinedToday = list.filter((u) => u.createdAt?.slice(0, 10) === todayKey).length
  const joinedWeek = list.filter((u) => (u.createdAt?.slice(0, 10) ?? '') >= weekAgo).length
  const activeWeek = list.filter((u) => (u.lastActiveAt?.slice(0, 10) ?? '') >= weekAgo).length
  const n = (v: number) => (ready ? v.toLocaleString() : '—')

  return (
    <div className="kpi-section">
      <h2 className="section-title">전체 회원 현황</h2>
      <div className="kpi-problems">
        <StatCard
          label="전체 회원"
          value={n(memberCount)}
          delta={ready ? `가입 중 ${pendingCount}명 · 탈퇴 유예 ${withdrawnCount}건 · 관계자 ${staffCount}명 제외` : '—'}
          tone="up"
        />
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

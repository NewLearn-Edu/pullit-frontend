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

  // 날짜 키는 기기 로컬(KST) 기준 — toISOString 은 UTC 라 09:00 전엔 어제로 잡혀 대시보드(서버 KST 자정)와 어긋났다
  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayKey = localKey(new Date())
  const weekAgo = localKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  // 상태 모델(2026-09-08): 회원 = USER 이면서 PENDING 아님 · 가입 중 = PENDING(게스트 출신·직가입 합산) · 게스트 = GUEST·GUEST
  // (status 를 안 주는 구서버는 type 으로만 — 그래서 status === 'GUEST' 대신 "GUEST 인데 PENDING 아님")
  const pendingCount = list.filter((u) => u.status === 'PENDING').length
  const memberCount = list.filter((u) => (u.type ?? 'USER') === 'USER' && u.status !== 'PENDING').length
  const guestCount = list.filter((u) => u.type === 'GUEST' && u.status !== 'PENDING').length
  const withdrawnCount = list.filter((u) => u.status === 'DELETED').length
  // "가입" = 프로필까지 마친 회원(USER·ACTIVE)의 registered_at — 대시보드 todaySignups 와 같은 정의.
  // 게스트 생성일(created_at)로 세면 맛보기만 한 게스트까지 가입으로 잡혀 홈 대시보드와 숫자가 달랐다 (2026-09-08)
  const isCompletedMember = (u: AdminUser) => (u.type ?? 'USER') === 'USER' && u.status === 'ACTIVE'
  const joinedAt = (u: AdminUser) => (u.registeredAt ?? u.createdAt)?.slice(0, 10) ?? ''
  const joinedToday = list.filter((u) => isCompletedMember(u) && joinedAt(u) === todayKey).length
  const joinedWeek = list.filter((u) => isCompletedMember(u) && joinedAt(u) >= weekAgo).length
  const activeWeek = list.filter((u) => isCompletedMember(u) && (u.lastActiveAt?.slice(0, 10) ?? '') >= weekAgo).length
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

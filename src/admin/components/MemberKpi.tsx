import { useEffect, useState } from 'react'
import { fetchAdminUsers, type AdminUser } from '../api/adminApi'
import { StatCard } from './StatCard'

/**
 * 회원 현황 KPI — 회원(ACTIVE) · 게스트 · 오늘 가입 (2026-09-07 · 기준 통일 2026-09-14).
 * 회원 = 가입 전체 − 관계자 − 탈퇴 유예 − 가입 중. 홈 대시보드 totalMembers(USER·ACTIVE·staff 제외)와 같은 숫자.
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
  const all = users ?? []

  // 날짜 키는 기기 로컬(KST) 기준 — toISOString 은 UTC 라 09:00 전엔 어제로 잡혀 대시보드(서버 KST 자정)와 어긋났다
  const localKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayKey = localKey(new Date())
  const weekAgo = localKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

  // 단일 기준 (2026-09-14) — 리텐션 엑셀·대시보드와 같은 계단:
  //   가입 전체(USER 행) → 관계자 제외 → 탈퇴 유예 제외 → 가입 중(PENDING · 프로필 미완) 제외 → ACTIVE = "회원"
  // 예전엔 "USER 이면서 PENDING 아님" 으로 세서 탈퇴 유예가 회원 수에 섞였고, 홈 대시보드(USER·ACTIVE)와 6명 어긋났다.
  const isUser = (u: AdminUser) => (u.type ?? 'USER') === 'USER'
  const signupAll = all.filter(isUser)
  const staffCount = signupAll.filter((u) => u.staff).length
  const noStaff = signupAll.filter((u) => !u.staff)
  const withdrawnCount = noStaff.filter((u) => u.status === 'DELETED').length
  const noWithdrawn = noStaff.filter((u) => u.status !== 'DELETED')
  const pendingCount = noWithdrawn.filter((u) => u.status === 'PENDING').length
  const members = noWithdrawn.filter((u) => u.status === 'ACTIVE')
  const memberCount = members.length
  // 게스트 = GUEST·GUEST (맛보기만 하고 미가입 · 관계자 제외). status 를 안 주는 구서버 대비 "GUEST 인데 PENDING 아님"
  const guestCount = all.filter((u) => !u.staff && u.type === 'GUEST' && u.status !== 'PENDING').length

  // "가입" = ACTIVE 의 registered_at — 대시보드 todaySignups 와 같은 정의
  const joinedAt = (u: AdminUser) => (u.registeredAt ?? u.createdAt)?.slice(0, 10) ?? ''
  const joinedToday = members.filter((u) => joinedAt(u) === todayKey).length
  const joinedWeek = members.filter((u) => joinedAt(u) >= weekAgo).length
  const activeWeek = members.filter((u) => (u.lastActiveAt?.slice(0, 10) ?? '') >= weekAgo).length
  const n = (v: number) => (ready ? v.toLocaleString() : '—')

  return (
    <div className="kpi-section">
      <h2 className="section-title">전체 회원 현황</h2>
      <div className="kpi-problems">
        <StatCard
          label="회원 (ACTIVE)"
          value={n(memberCount)}
          delta={
            ready
              ? `가입 전체 ${signupAll.length} − 관계자 ${staffCount} − 탈퇴 유예 ${withdrawnCount} − 가입 중 ${pendingCount}`
              : '—'
          }
          tone="up"
        />
        <StatCard label="게스트" value={n(guestCount)} delta="맛보기만 하고 미가입 · 회원에 포함 안 됨" tone="flat" />
        <StatCard
          label="오늘 가입 (ACTIVE)"
          value={n(joinedToday)}
          delta={ready ? `최근 7일 가입 ${joinedWeek}명 · 7일 내 로그인 ${activeWeek}명` : '—'}
          tone="good"
        />
      </div>
    </div>
  )
}

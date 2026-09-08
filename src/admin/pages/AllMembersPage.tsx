import { useEffect, useMemo, useRef, useState } from 'react'
import { GRADE_LABEL, type Grade } from '@/user/api/authApi'
import {
  fetchAdminUsers,
  updateUserRole,
  updateUserStaff,
  type AdminUser,
  type AdminUserStatus,
  type AdminUserType,
  type UserRole,
} from '../api/adminApi'
import { MemberKpi } from '../components/MemberKpi'
import { useToast } from '../components/toast'

const ROLE_LABEL: Record<UserRole, string> = {
  USER: '유저',
  PAID_USER: '유료 회원',
  ADMIN: '관리자',
}

/** 권한별 배지 색 (admin.css .badge 변형) */
const ROLE_BADGE: Record<UserRole, string> = {
  USER: 'badge neutral',
  PAID_USER: 'badge pending',
  ADMIN: 'badge live',
}

const PAGE_SIZE = 30

/**
 * 유형(type)·상태(status) 를 두 컬럼으로 그대로 노출 (2026-09-08 상태 모델 — 조합 4종):
 *   GUEST·GUEST 순수 게스트 · GUEST·PENDING 게스트가 소셜 로그인만 누름 ·
 *   USER·PENDING 바로 소셜 로그인(프로필 미완) · USER·ACTIVE 가입 완료
 */
const TYPE_LABEL: Record<AdminUserType, string> = { USER: '회원', GUEST: '게스트' }
const TYPE_BADGE: Record<AdminUserType, string> = { USER: 'badge live', GUEST: 'badge neutral' }
const STATUS_LABEL: Record<AdminUserStatus, string> = {
  GUEST: '게스트', PENDING: '가입 중', ACTIVE: '활성', SUSPENDED: '정지', DELETED: '탈퇴 유예',
}
const STATUS_BADGE: Record<AdminUserStatus, string> = {
  GUEST: 'badge neutral', PENDING: 'badge pending', ACTIVE: 'badge live', SUSPENDED: 'badge danger', DELETED: 'badge hidden',
}

/**
 * 유형 필터 — type 그대로 + 풀잇 관계자(is_staff) 는 별도 유형으로 뺀다 (회원/게스트 필터엔 안 잡힘).
 * 게스트 출신(맛보기 게스트 → 소셜 로그인) 은 회원/게스트와 겹치는 별도 축
 */
type TypeFilter = 'all' | AdminUserType | 'STAFF' | 'FROM_GUEST'

/**
 * 게스트 출신 — 가입 중이면 type 이 아직 GUEST 라 바로 드러나고,
 * 가입을 마친 회원은 registered_at 이 created_at 보다 늦은 것으로 판별 (직가입은 둘이 같다)
 */
function isFromGuest(u: AdminUser): boolean {
  if (u.type === 'GUEST') return u.status === 'PENDING'
  return !!u.registeredAt && u.registeredAt > u.createdAt
}

type RoleFilter = 'all' | UserRole
/** 상태 필터 — status 그대로 (구서버는 status 를 안 주므로 필터 시 GUEST 는 type 으로 보정) */
type StatusFilter = 'all' | AdminUserStatus

/** 구서버 응답 보정 — status 가 없으면 type 으로 추정 (GUEST → GUEST, 그 외 ACTIVE) */
function statusOf(u: AdminUser): AdminUserStatus {
  return u.status ?? ((u.type ?? 'USER') === 'GUEST' ? 'GUEST' : 'ACTIVE')
}
type SortKey = 'newest' | 'oldest' | 'active'

/** 01012345678 → 010-1234-5678. 형식이 다르면 원본 그대로 노출 */
function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

const fmtDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')
const gradeLabel = (g: string | null | undefined) => (g && g in GRADE_LABEL ? GRADE_LABEL[g as Grade] : '—')

/**
 * 전체 회원 (AI-211 · 2026-09-07 필터·정렬·닉네임 추가)
 * 검색(이름·닉네임·이메일·전화) + 유형·권한·학년·상태 필터 + 정렬 세그 + 페이지네이션(툴바 우측).
 * 기본은 최근 가입순. 필터·검색은 목록이 작아 클라이언트에서 처리한다.
 * 권한 배지 클릭 → 유저/관리자 선택 → 확인 후 변경.
 */
export default function AllMembersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [hoveredRole, setHoveredRole] = useState<UserRole | null>(null)
  const [staffEditingId, setStaffEditingId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const staffDropdownRef = useRef<HTMLDivElement | null>(null)

  // 필터·정렬·페이지
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [gradeFilter, setGradeFilter] = useState<'all' | Grade>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [excludeStaff, setExcludeStaff] = useState(true) // 풀잇 관계자 제외 — 기본 켜짐
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)

  const load = () => {
    setState('loading')
    fetchAdminUsers()
      .then((list) => {
        setUsers(list)
        setState('done')
      })
      .catch(() => setState('error'))
  }
  useEffect(load, [])

  // 드롭다운 밖 클릭 시 닫기
  useEffect(() => {
    if (editingId == null) return
    const handler = (e: Event) => {
      const target = e.target as HTMLElement
      if (dropdownRef.current?.contains(target)) return
      if (target.closest?.('[data-role-badge]')) return
      setEditingId(null)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [editingId])
  useEffect(() => {
    if (staffEditingId == null) return
    const handler = (e: Event) => {
      const target = e.target as HTMLElement
      if (staffDropdownRef.current?.contains(target)) return
      if (target.closest?.('[data-staff-badge]')) return
      setStaffEditingId(null)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [staffEditingId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    const list = users.filter((u) => {
      if (typeFilter === 'STAFF') {
        if (!u.staff) return false
      } else if (excludeStaff && u.staff) return false
      if (typeFilter === 'FROM_GUEST') {
        if (!isFromGuest(u)) return false
      } else if (typeFilter !== 'all' && typeFilter !== 'STAFF' && (u.type ?? 'USER') !== typeFilter) return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (gradeFilter !== 'all' && u.grade !== gradeFilter) return false
      if (statusFilter !== 'all' && statusOf(u) !== statusFilter) return false
      if (!q) return true
      const hay = [u.name, u.nickname, u.email].filter(Boolean).join(' ').toLowerCase()
      if (hay.includes(q)) return true
      return digits.length >= 3 && !!u.phoneNumber && u.phoneNumber.replace(/\D/g, '').includes(digits)
    })
    const byCreated = (a: AdminUser, b: AdminUser) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id)
    if (sort === 'newest') list.sort((a, b) => byCreated(b, a))
    else if (sort === 'oldest') list.sort(byCreated)
    else list.sort((a, b) => (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '') || byCreated(b, a))
    return list
  }, [users, query, typeFilter, roleFilter, gradeFilter, statusFilter, excludeStaff, sort])

  // 필터가 바뀌면 1페이지로
  useEffect(() => {
    setPage(1)
  }, [query, typeFilter, roleFilter, gradeFilter, statusFilter, excludeStaff, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const rangeFrom = filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(current * PAGE_SIZE, filtered.length)

  const handleRoleSelect = async (user: AdminUser, next: UserRole) => {
    setEditingId(null)
    setHoveredRole(null)
    if (next === user.role) return

    const name = user.name ?? user.nickname ?? '회원'
    const ok = window.confirm(
      `'${name}' 의 권한을 ${ROLE_LABEL[user.role]} → ${ROLE_LABEL[next]} 로 변경할까요?`,
    )
    if (!ok) return

    try {
      const updated = await updateUserRole(user.id, next)
      // 권한 API 응답은 목록 항목과 같은 형태 — 목록에만 있는 확장 필드는 기존 값을 유지
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
      toast(`${name} 권한을 ${ROLE_LABEL[next]} 로 변경했어요`)
    } catch {
      toast('권한 변경에 실패했어요. 다시 시도해주세요')
    }
  }

  const handleStaffToggle = async (user: AdminUser) => {
    setStaffEditingId(null)
    const next = !user.staff
    const name = user.name ?? user.nickname ?? '회원'
    const ok = window.confirm(
      next
        ? `'${name}' 을(를) 풀잇 관계자로 지정할까요? 회원·게스트 집계에서 빠집니다.`
        : `'${name}' 의 풀잇 관계자 표시를 해제할까요?`,
    )
    if (!ok) return
    try {
      const updated = await updateUserStaff(user.id, next)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
      toast(next ? `${name} 을(를) 풀잇 관계자로 표시했어요` : `${name} 관계자 표시를 해제했어요`)
    } catch {
      toast('관계자 표시 변경에 실패했어요. 다시 시도해주세요')
    }
  }

  // 헤더 요약 — 풀잇 관계자는 회원·게스트 어느 쪽에도 넣지 않고 따로 센다
  const staffCount = users.filter((u) => u.staff).length
  const memberCount = users.filter((u) => !u.staff && (u.type ?? 'USER') === 'USER').length
  const guestCount = users.length - staffCount - memberCount

  return (
    <section className="view">
      {/* 회원 현황 KPI — 회원 섹션 공통 (MemberKpi). 목록을 넘겨 재조회하지 않는다 */}
      <MemberKpi users={state === 'done' ? users : null} />

      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>전체 회원</h2>
          <p className="page-sub">
            모든 회원을 조회하고 권한을 변경합니다
            {state === 'done' && ` · 회원 ${memberCount.toLocaleString()}명 · 게스트 ${guestCount.toLocaleString()}명 · 관계자 ${staffCount.toLocaleString()}명`}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load}>
          새로고침
        </button>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="toolbar">
          <label className="search-box">
            <input
              type="search"
              placeholder="이름 · 닉네임 · 이메일 · 전화번호"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="회원 검색"
            />
          </label>
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} aria-label="유형">
            <option value="all">전체 유형</option>
            <option value="USER">회원</option>
            <option value="GUEST">게스트</option>
            <option value="STAFF">풀잇 관계자</option>
            <option value="FROM_GUEST">게스트 출신</option>
          </select>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="상태">
            <option value="all">전체 상태</option>
            <option value="GUEST">게스트</option>
            <option value="PENDING">가입 중</option>
            <option value="ACTIVE">활성</option>
            <option value="DELETED">탈퇴 유예</option>
          </select>
          <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} aria-label="권한">
            <option value="all">전체 권한</option>
            <option value="USER">유저</option>
            <option value="PAID_USER">유료 회원</option>
            <option value="ADMIN">관리자</option>
          </select>
          <select className="select" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value as 'all' | Grade)} aria-label="학년">
            <option value="all">전체 학년</option>
            {(Object.keys(GRADE_LABEL) as Grade[]).map((g) => (
              <option key={g} value={g}>{GRADE_LABEL[g]}</option>
            ))}
          </select>
          {/* 풀잇 관계자 제외 — 기본 켜짐. 유형 필터가 "풀잇 관계자" 면 의미가 없어 비활성 */}
          <label className="check-box">
            <input
              type="checkbox"
              checked={typeFilter === 'STAFF' ? false : excludeStaff}
              disabled={typeFilter === 'STAFF'}
              onChange={(e) => setExcludeStaff(e.target.checked)}
            />
            <span className="box" aria-hidden>
              <svg viewBox="0 0 11 9" fill="none"><path d="M1 4.5 4 7.5 10 1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            풀잇 관계자 제외
          </label>
          <div className="seg" role="group" aria-label="정렬">
            <button type="button" className={sort === 'newest' ? 'on' : undefined} onClick={() => setSort('newest')}>최근 가입순</button>
            <button type="button" className={sort === 'oldest' ? 'on' : undefined} onClick={() => setSort('oldest')}>오래된순</button>
            <button type="button" className={sort === 'active' ? 'on' : undefined} onClick={() => setSort('active')}>최근 활동순</button>
          </div>
          <div className="toolbar-pg">
            <span className="info">
              {filtered.length === 0 ? '0건' : `${rangeFrom}–${rangeTo} / ${filtered.length.toLocaleString()}건`}
            </span>
            {pageCount > 1 && (
              <div className="pages">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={current === 1} aria-label="이전">‹</button>
                {pageNumbers(current, pageCount).map((n, i) =>
                  n === 0 ? (
                    <span key={`gap-${i}`} className="info">…</span>
                  ) : (
                    <button type="button" key={n} className={n === current ? 'on' : undefined} onClick={() => setPage(n)}>{n}</button>
                  ),
                )}
                <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={current === pageCount} aria-label="다음">›</button>
              </div>
            )}
          </div>
        </div>

        {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {state === 'error' && (
          <p className="page-sub">목록을 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
        )}
        {state === 'done' && users.length === 0 && <p className="page-sub">회원이 없습니다.</p>}
        {state === 'done' && users.length > 0 && filtered.length === 0 && (
          <p className="page-sub">조건에 맞는 회원이 없습니다. 검색어나 필터를 바꿔보세요.</p>
        )}

        {state === 'done' && pageRows.length > 0 && (
          <div className="table-wrap">
            {/* 넓은 레이아웃(main-inner.wide 1600) 기준 고정 폭 — 배지 컬럼은 108px 이상, 이메일이 남는 폭을 받는다.
                min-width: 창이 좁으면 컬럼을 쥐어짜는 대신 카드 안에서 가로 스크롤 (th 폭은 content-box · +28 패딩) */}
            <table style={{ minWidth: 1608 }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>이름</th>
                  <th style={{ width: 140 }}>닉네임</th>
                  <th style={{ width: 108, textAlign: 'center' }}>유형</th>
                  <th style={{ width: 108, textAlign: 'center' }}>상태</th>
                  <th style={{ width: 84 }}>학년</th>
                  <th>이메일</th>
                  <th style={{ width: 150 }}>전화번호</th>
                  <th style={{ width: 84, textAlign: 'right' }}>크레딧</th>
                  <th style={{ width: 120 }}>가입일</th>
                  <th style={{ width: 120 }}>최근 활동</th>
                  <th style={{ width: 130, textAlign: 'center' }}>권한</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u) => {
                  const withdrawn = u.status === 'DELETED'
                  const type: AdminUserType = (u.type ?? 'USER') === 'GUEST' ? 'GUEST' : 'USER'
                  const status = statusOf(u)
                  return (
                    <tr key={u.id} style={withdrawn ? { opacity: 0.55 } : undefined}>
                      <td className="strong" title={u.name ?? undefined}>
                        {u.name ?? '—'}
                        {withdrawn && <span className="sub">탈퇴 유예</span>}
                      </td>
                      <td title={u.nickname ?? undefined}>{u.nickname ?? '—'}</td>
                      <td style={{ textAlign: 'center', overflow: 'visible', textOverflow: 'clip', position: 'relative' }}>
                        {/* 유형 배지 — 클릭하면 관계자 지정/해제 메뉴 (권한 배지와 같은 팝오버 패턴) */}
                        <button
                          type="button"
                          data-staff-badge
                          className={u.staff ? 'badge danger' : TYPE_BADGE[type]}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => setStaffEditingId(staffEditingId === u.id ? null : u.id)}
                          title="클릭해서 풀잇 관계자 지정/해제"
                        >
                          {u.staff ? '관계자' : TYPE_LABEL[type]}
                        </button>
                        {isFromGuest(u) && <span className="sub">게스트 출신</span>}
                        {staffEditingId === u.id && (
                          <div
                            ref={staffDropdownRef}
                            className="card"
                            style={{
                              position: 'absolute',
                              top: 'calc(50% + 18px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 30,
                              minWidth: 150,
                              padding: 6,
                              boxShadow: 'var(--shadow-menu)',
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ width: '100%', whiteSpace: 'nowrap' }}
                              onClick={() => handleStaffToggle(u)}
                            >
                              {u.staff ? '관계자 해제' : '풀잇 관계자로 지정'}
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', overflow: 'visible', textOverflow: 'clip' }}>
                        <span className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td>{gradeLabel(u.grade)}</td>
                      <td title={u.email ?? undefined}>{u.email ?? '—'}</td>
                      <td className="num">{formatPhone(u.phoneNumber)}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {u.creditBalance != null ? u.creditBalance.toLocaleString() : '—'}
                      </td>
                      <td className="num">{fmtDate(u.createdAt)}</td>
                      <td className="num">{fmtDate(u.lastActiveAt)}</td>
                      <td
                        style={{
                          textAlign: 'center',
                          overflow: 'visible',
                          textOverflow: 'clip',
                          position: 'relative',
                        }}
                      >
                        <button
                          type="button"
                          data-role-badge
                          className={ROLE_BADGE[u.role]}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                          title="클릭해서 권한 변경"
                        >
                          {ROLE_LABEL[u.role]}
                        </button>

                        {editingId === u.id && (
                          <div
                            ref={dropdownRef}
                            className="card"
                            style={{
                              position: 'absolute',
                              top: 'calc(50% + 18px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 30,
                              minWidth: 120,
                              padding: 6,
                              boxShadow: 'var(--shadow-menu)',
                            }}
                          >
                            {(['USER', 'ADMIN'] as const).map((r) => {
                              const hovered = hoveredRole === r
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  style={{
                                    display: 'flex',
                                    width: '100%',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '9px 12px',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    transition: 'background 0.12s, color 0.12s',
                                    background: hovered
                                      ? r === 'ADMIN'
                                        ? 'var(--color-accent-soft)'
                                        : 'var(--hidden-bg)'
                                      : 'none',
                                    color: hovered
                                      ? r === 'ADMIN'
                                        ? 'var(--green-text)'
                                        : 'var(--color-muted)'
                                      : 'var(--color-fg)',
                                  }}
                                  onMouseEnter={() => setHoveredRole(r)}
                                  onMouseLeave={() => setHoveredRole(null)}
                                  onClick={() => handleRoleSelect(u, r)}
                                >
                                  {ROLE_LABEL[r]}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/** 페이지 번호 목록 — 현재 페이지 주변 ±2 와 양끝, 사이는 0(생략 표시) */
function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2].filter((n) => n >= 1 && n <= total))
  const sorted = [...set].sort((a, b) => a - b)
  const out: number[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(0)
    out.push(n)
  })
  return out
}

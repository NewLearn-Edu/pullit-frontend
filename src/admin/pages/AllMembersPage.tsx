import { useEffect, useRef, useState } from 'react'
import {
  fetchAdminUsers,
  updateUserRole,
  type AdminUser,
  type UserRole,
} from '../api/adminApi'
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

/** 01012345678 → 010-1234-5678. 형식이 다르면 원본 그대로 노출 */
function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

/**
 * 전체 회원 (AI-211)
 * 모든 권한의 회원 목록 · 권한 배지 클릭 → 유저/관리자 선택 → 확인 후 변경.
 */
export default function AllMembersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  // 권한 선택 드롭다운이 열려있는 대상 userId (null = 닫힘)
  const [editingId, setEditingId] = useState<number | null>(null)
  // 드롭다운 안에서 hover 중인 항목 (권한별 배지색 하이라이트용)
  const [hoveredRole, setHoveredRole] = useState<UserRole | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAdminUsers()
      .then((list) => {
        setUsers(list)
        setState('done')
      })
      .catch(() => setState('error'))
  }, [])

  // 드롭다운 밖 클릭 시 닫기
  useEffect(() => {
    if (editingId == null) return
    const handler = (e: Event) => {
      const target = e.target as HTMLElement
      // 드롭다운 내부 · 배지 버튼 클릭은 무시 (배지는 자체 토글 처리)
      if (dropdownRef.current?.contains(target)) return
      if (target.closest?.('[data-role-badge]')) return
      setEditingId(null)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [editingId])

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
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      toast(`${name} 권한을 ${ROLE_LABEL[next]} 로 변경했어요`)
    } catch {
      toast('권한 변경에 실패했어요. 다시 시도해주세요')
    }
  }

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>전체 회원</h2>
          <p className="page-sub">모든 권한의 회원을 조회하고 권한을 변경합니다</p>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="cas-head" style={{ marginBottom: 10 }}>
          회원 목록{state === 'done' && ` · ${users.length}명`}
        </div>

        {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {state === 'error' && (
          <p className="page-sub">목록을 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
        )}
        {state === 'done' && users.length === 0 && (
          <p className="page-sub">회원이 없습니다.</p>
        )}

        {state === 'done' && users.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>이름</th>
                  <th>이메일</th>
                  <th style={{ width: 140 }}>전화번호</th>
                  <th style={{ width: 100, textAlign: 'right' }}>크레딧</th>
                  <th style={{ width: 140 }}>가입일</th>
                  <th style={{ width: 130, textAlign: 'center' }}>권한</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="strong">{u.name ?? u.nickname ?? '회원'}</td>
                    <td>{u.email ?? '—'}</td>
                    <td className="num">{formatPhone(u.phoneNumber)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {u.creditBalance != null ? u.creditBalance.toLocaleString() : '—'}
                    </td>
                    <td className="num">{u.createdAt?.slice(0, 10) ?? '—'}</td>
                    <td
                      style={{
                        textAlign: 'center',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        position: 'relative',
                      }}
                    >
                      {/* 배지는 항상 표시 · 클릭 시 아래로 드롭다운 메뉴 */}
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
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
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
                                  // hover 시 해당 권한의 연한 배지색으로
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

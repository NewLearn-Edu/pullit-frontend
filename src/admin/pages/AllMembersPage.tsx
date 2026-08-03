import { useEffect, useState } from 'react'
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

  useEffect(() => {
    fetchAdminUsers()
      .then((list) => {
        setUsers(list)
        setState('done')
      })
      .catch(() => setState('error'))
  }, [])

  const handleRoleSelect = async (user: AdminUser, next: UserRole) => {
    setEditingId(null)
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
                  <th style={{ width: 140 }}>가입일</th>
                  <th style={{ width: 130, textAlign: 'center' }}>권한</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="strong">{u.name ?? u.nickname ?? '회원'}</td>
                    <td>{u.email ?? '—'}</td>
                    <td className="num">{u.createdAt?.slice(0, 10) ?? '—'}</td>
                    <td
                      style={{
                        textAlign: 'center',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        position: 'relative',
                      }}
                    >
                      {editingId === u.id ? (
                        // 클릭 시 유저/관리자 선택 드롭다운
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="badge neutral"
                            style={{ cursor: 'pointer', border: 'none' }}
                            onClick={() => handleRoleSelect(u, 'USER')}
                          >
                            유저
                          </button>
                          <button
                            type="button"
                            className="badge live"
                            style={{ cursor: 'pointer', border: 'none' }}
                            onClick={() => handleRoleSelect(u, 'ADMIN')}
                          >
                            관리자
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={ROLE_BADGE[u.role]}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => setEditingId(u.id)}
                          title="클릭해서 권한 변경"
                        >
                          {ROLE_LABEL[u.role]}
                        </button>
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

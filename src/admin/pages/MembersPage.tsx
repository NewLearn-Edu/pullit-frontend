import { useEffect, useState } from 'react'
import { fetchMe, type MeResult } from '@/user/api/authApi'
import { fetchAdminUsers, type AdminUser } from '../api/adminApi'

/**
 * 관리자 계정 관리 (AI-211)
 * - 상단: 현재 로그인 계정 (GET /api/users/me)
 * - 하단: 관리자 계정 목록 (GET /api/admin/users · users 테이블 role=ADMIN 실데이터)
 */
export default function MembersPage() {
  const [me, setMe] = useState<MeResult | null>(null)
  const [meLoaded, setMeLoaded] = useState(false)

  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [listState, setListState] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    fetchMe().then((result) => {
      setMe(result)
      setMeLoaded(true)
    })
    fetchAdminUsers()
      .then((list) => {
        setAdmins(list)
        setListState('done')
      })
      .catch(() => setListState('error'))
  }, [])

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>관리자 계정</h2>
          <p className="page-sub">어드민 접근 계정을 관리합니다</p>
        </div>
      </div>

      {/* 현재 로그인 계정 · /me 실데이터 */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="cas-head" style={{ marginBottom: 10 }}>현재 로그인 계정</div>
        {!meLoaded ? (
          <p className="page-sub">불러오는 중…</p>
        ) : me ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="avatar">{displayName(me.name, me.nickname).charAt(0)}</span>
            <div>
              <b style={{ display: 'block' }}>{displayName(me.name, me.nickname)}</b>
              <span className="page-sub">
                {me.email ?? '이메일 없음'} · {me.role === 'ADMIN' ? '관리자' : '일반 회원'}
              </span>
            </div>
          </div>
        ) : (
          <p className="page-sub">로그인 정보가 없습니다. /login 에서 로그인하세요.</p>
        )}
      </div>

      {/* 관리자 목록 · users 테이블 실데이터 */}
      <div className="card" style={{ padding: 18 }}>
        <div className="cas-head" style={{ marginBottom: 10 }}>
          계정 목록{listState === 'done' && ` · ${admins.length}명`}
        </div>

        {listState === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {listState === 'error' && (
          <p className="page-sub">목록을 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
        )}
        {listState === 'done' && admins.length === 0 && (
          <p className="page-sub">ADMIN 권한 계정이 없습니다.</p>
        )}

        {listState === 'done' && admins.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>이름</th>
                  <th>이메일</th>
                  <th style={{ width: 140 }}>가입일</th>
                  <th style={{ width: 100 }}>권한</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td className="strong">
                      {displayName(a.name, a.nickname)}
                      {me?.id === a.id && <span className="badge neutral" style={{ marginLeft: 8 }}>나</span>}
                    </td>
                    <td>{a.email ?? '—'}</td>
                    <td className="num">{a.createdAt?.slice(0, 10) ?? '—'}</td>
                    <td>
                      <span className="badge live">관리자</span>
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

/** 표시 이름 · name → nickname → '회원' 폴백 */
function displayName(name: string | null, nickname: string | null): string {
  return name ?? nickname ?? '회원'
}

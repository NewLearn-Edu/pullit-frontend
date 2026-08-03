import { useEffect, useState } from 'react'
import { fetchMe, type MeResult } from '@/user/api/authApi'

// POC 목 데이터 · 관리자 계정 API 연동 시 교체
interface AdminAccount {
  id: number
  name: string
  email: string
  role: '관리자' | '운영자'
}

const MOCK_ADMINS: AdminAccount[] = [
  { id: 1, name: '유이현', email: 'insidesy4@gmail.com', role: '관리자' },
  { id: 2, name: '뉴런소프트', email: 'newlearnsoft@gmail.com', role: '관리자' },
]

/**
 * 관리자 계정 관리 (AI-211)
 * - 상단: 현재 로그인 계정 (GET /api/users/me 실데이터)
 * - 하단: 관리자 계정 목록 (POC 목 데이터)
 */
export default function MembersPage() {
  const [me, setMe] = useState<MeResult | null>(null)
  const [meLoaded, setMeLoaded] = useState(false)

  useEffect(() => {
    fetchMe().then((result) => {
      setMe(result)
      setMeLoaded(true)
    })
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
            <span className="avatar">{displayName(me).charAt(0)}</span>
            <div>
              <b style={{ display: 'block' }}>{displayName(me)}</b>
              <span className="page-sub">
                {me.email ?? '이메일 없음'} · {me.role === 'ADMIN' ? '관리자' : '일반 회원'}
              </span>
            </div>
          </div>
        ) : (
          <p className="page-sub">로그인 정보가 없습니다. /login 에서 로그인하세요.</p>
        )}
      </div>

      {/* 관리자 목록 · 목 데이터 */}
      <div className="card" style={{ padding: 18 }}>
        <div className="cas-head" style={{ marginBottom: 10 }}>계정 목록</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 160 }}>이름</th>
                <th>이메일</th>
                <th style={{ width: 120 }}>권한</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ADMINS.map((a) => (
                <tr key={a.id}>
                  <td className="strong">{a.name}</td>
                  <td>{a.email}</td>
                  <td>
                    <span className="badge live">{a.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/** 표시 이름 · name → nickname → '회원' 폴백 */
function displayName(me: MeResult): string {
  return me.name ?? me.nickname ?? '회원'
}

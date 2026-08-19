import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { fetchPhoneVerifications, type PhoneVerification } from '../api/adminApi'
import { formatPhoneSearch } from '../searchFormat'

const PAGE_SIZE = 20
/** 검증 실패 허용 횟수 — 백엔드 PhoneVerification.MAX_ATTEMPTS 와 동일 */
const MAX_ATTEMPTS = 5

type VerificationStatus = 'verified' | 'waiting' | 'expired' | 'blocked'

/** 인증완료 > 실패초과 > 만료 > 대기 순서로 판정 (백엔드 검증 로직과 동일 우선순위) */
function statusOf(v: PhoneVerification): VerificationStatus {
  if (v.verified) return 'verified'
  if (v.attemptCount >= MAX_ATTEMPTS) return 'blocked'
  if (new Date(v.expiresAt).getTime() < Date.now()) return 'expired'
  return 'waiting'
}

const STATUS_LABEL: Record<VerificationStatus, string> = {
  verified: '인증완료',
  waiting: '대기중',
  expired: '만료',
  blocked: '실패초과',
}

const STATUS_BADGE: Record<VerificationStatus, string> = {
  verified: 'badge live',
  waiting: 'badge pending',
  expired: 'badge neutral',
  blocked: 'badge danger',
}

/** 2026-08-19T14:03:22 → 2026-08-19 14:03 */
function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`
}

/**
 * 인증번호 (전화번호 SMS 인증 이력)
 * phone_verifications 테이블 열람 — SMS 발송이 꺼진 dev 환경에서 코드를 확인해
 * 가입 테스트를 진행하는 용도가 크다. 발급 최신순 · 전화번호 검색.
 */
export default function PhoneVerificationsPage() {
  const [rows, setRows] = useState<PhoneVerification[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [keyword, setKeyword] = useState('')
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    fetchPhoneVerifications({ q: keyword || undefined, page, size: PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setRows(res.content)
        setTotal(res.totalElements)
        setTotalPages(res.totalPages)
        setState('done')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [keyword, page])

  const pageButtons = useMemo(() => {
    const start = Math.max(0, Math.min(page - 2, totalPages - 5))
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)
  }, [page, totalPages])

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>인증번호</h2>
          <p className="page-sub">전화번호 SMS 인증 발급 이력 · 발송이 꺼진 환경에선 여기서 코드를 확인해요</p>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="toolbar">
          <form
            className="search-box"
            style={{ width: 280 }}
            onSubmit={(e) => {
              e.preventDefault()
              setPage(0)
              setKeyword(q.trim())
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(formatPhoneSearch(e.target.value))}
              placeholder="전화번호 검색 (010-1234)"
            />
          </form>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setPage(0)
              setKeyword(q.trim())
            }}
          >
            검색
          </button>
          {keyword && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setQ('')
                setKeyword('')
                setPage(0)
              }}
            >
              초기화
            </button>
          )}
          <div className="spacer" />
          <div className="toolbar-pg">
            <span className="info num">
              {rangeStart}–{rangeEnd} / {total.toLocaleString()}건
            </span>
            <div className="pages">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
              {pageButtons.map((p) => (
                <button
                  key={p}
                  className={clsx('num', p === page && 'on')}
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </button>
              ))}
              <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
            </div>
          </div>
        </div>

        {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {state === 'error' && (
          <p className="page-sub">이력을 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
        )}
        {state === 'done' && rows.length === 0 && (
          <p className="page-sub">{keyword ? '검색 결과가 없습니다.' : '인증 이력이 없습니다.'}</p>
        )}

        {state === 'done' && rows.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th style={{ width: 160 }}>회원</th>
                  <th style={{ width: 150 }}>전화번호</th>
                  <th style={{ width: 100 }}>인증번호</th>
                  <th style={{ width: 120, textAlign: 'center' }}>상태</th>
                  <th style={{ width: 70, textAlign: 'right' }}>시도</th>
                  <th style={{ width: 160 }}>만료</th>
                  <th style={{ width: 160 }}>발급</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const status = statusOf(v)
                  return (
                    <tr key={v.id}>
                      <td className="num" style={{ color: 'var(--color-muted)' }}>{v.id}</td>
                      <td className="strong">{v.userName ?? `#${v.userId}`}</td>
                      <td className="num">{v.phoneNumber}</td>
                      <td className="num" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                        {v.code}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {v.attemptCount}/{MAX_ATTEMPTS}
                      </td>
                      <td className="num">{formatDateTime(v.expiresAt)}</td>
                      <td className="num">{formatDateTime(v.createdAt)}</td>
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

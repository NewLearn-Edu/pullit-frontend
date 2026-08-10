import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  adjustCredit,
  fetchCreditStats,
  fetchCreditTransactions,
  fetchCreditUsers,
  type CreditStats,
  type CreditTransaction,
  type CreditTransactionType,
  type CreditUser,
} from '../api/adminApi'
import { StatCard } from '../components/StatCard'
import { CreditMark } from '../components/CreditMark'
import { useToast } from '../components/toast'

const PAGE_SIZE = 20
const TX_PAGE_SIZE = 10

const TYPE_LABEL: Record<CreditTransactionType, string> = { GRANT: '지급', DEDUCT: '차감' }

/** 01012345678 → 010-1234-5678. 형식이 다르면 원본 그대로 노출 */
function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

function displayName(user: { name: string | null; nickname: string | null }): string {
  return user.name ?? user.nickname ?? '회원'
}

/**
 * 크레딧 관리 — 회원별 잔액 조회 · 수동 지급/차감 · 증감 이력.
 * 잔액(users.credit_balance)과 원장(credit_transactions)은 백엔드가 한 트랜잭션으로 갱신하므로
 * 조정 성공 후 목록·이력·KPI 를 함께 다시 읽는다.
 */
export default function CreditsPage() {
  const toast = useToast()

  const [stats, setStats] = useState<CreditStats | null>(null)
  const [users, setUsers] = useState<CreditUser[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [keyword, setKeyword] = useState('')
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')

  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [txTotal, setTxTotal] = useState(0)
  // 이력 필터 — null 이면 전체, 지정되면 해당 회원 것만
  const [txUser, setTxUser] = useState<CreditUser | null>(null)

  // 조정 모달 대상 (null = 닫힘)
  const [target, setTarget] = useState<CreditUser | null>(null)

  const loadStats = useCallback(() => {
    fetchCreditStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  const loadUsers = useCallback(() => {
    setState('loading')
    fetchCreditUsers({ q: keyword || undefined, page, size: PAGE_SIZE })
      .then((res) => {
        setUsers(res.content)
        setTotal(res.totalElements)
        setTotalPages(res.totalPages)
        setState('done')
      })
      .catch(() => setState('error'))
  }, [keyword, page])

  const loadTransactions = useCallback(() => {
    fetchCreditTransactions({ userId: txUser?.userId, page: 0, size: TX_PAGE_SIZE })
      .then((res) => {
        setTransactions(res.content)
        setTxTotal(res.totalElements)
      })
      .catch(() => setTransactions([]))
  }, [txUser])

  useEffect(loadStats, [loadStats])
  useEffect(loadUsers, [loadUsers])
  useEffect(loadTransactions, [loadTransactions])

  const handleAdjusted = (user: CreditUser, tx: CreditTransaction) => {
    setTarget(null)
    toast(`${displayName(user)} 크레딧 ${TYPE_LABEL[tx.type]} ${tx.amount} · 잔액 ${tx.balanceAfter}`)
    loadStats()
    loadUsers()
    loadTransactions()
  }

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)
  const pageButtons: number[] = []
  const windowStart = Math.max(0, Math.min(page - 2, totalPages - 5))
  for (let i = windowStart; i < Math.min(windowStart + 5, totalPages); i++) pageButtons.push(i)

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>크레딧 관리</h2>
          <p className="page-sub">회원 크레딧을 조회하고 지급·차감합니다</p>
        </div>
      </div>

      <div className="kpi-problems" style={{ marginBottom: 24 }}>
        <StatCard
          label="총 보유 크레딧"
          value={stats ? stats.totalBalance.toLocaleString() : '—'}
          delta={stats ? `전체 회원 ${stats.totalUsers.toLocaleString()}명` : '—'}
          tone="up"
        />
        <StatCard
          label="보유 회원"
          value={stats ? stats.holderCount.toLocaleString() : '—'}
          delta={
            stats && stats.totalUsers > 0
              ? `전체의 ${Math.round((stats.holderCount / stats.totalUsers) * 100)}%`
              : '—'
          }
          tone="good"
        />
        <StatCard
          label="1인 평균"
          value={
            stats && stats.holderCount > 0
              ? Math.round(stats.totalBalance / stats.holderCount).toLocaleString()
              : '0'
          }
          delta="보유 회원 기준"
          tone="flat"
        />
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 · 이메일 · 전화번호 검색"
            />
          </form>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
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
              className="btn btn-ghost btn-sm"
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
              {rangeStart}–{rangeEnd} / {total.toLocaleString()}명
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
          <p className="page-sub">목록을 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
        )}
        {state === 'done' && users.length === 0 && <p className="page-sub">회원이 없습니다.</p>}

        {state === 'done' && users.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>이름</th>
                  <th>이메일</th>
                  <th style={{ width: 140 }}>전화번호</th>
                  <th style={{ width: 110, textAlign: 'right' }}>크레딧</th>
                  <th style={{ width: 190 }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId}>
                    <td className="strong">{displayName(u)}</td>
                    <td>{u.email ?? '—'}</td>
                    <td className="num">{formatPhone(u.phoneNumber)}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      <CreditMark />
                      {u.creditBalance.toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setTarget(u)}
                        >
                          조정
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setTxUser(u)}
                        >
                          이력
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="card-head" style={{ marginBottom: 10 }}>
          <div>
            <div className="card-title">
              {txUser ? `${displayName(txUser)} 크레딧 이력` : '최근 크레딧 이력'}
            </div>
            <div className="card-sub">
              총 {txTotal.toLocaleString()}건 · 최신 {TX_PAGE_SIZE}건 표시
            </div>
          </div>
          {txUser && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTxUser(null)}>
              전체 보기
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <p className="page-sub">이력이 없습니다.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>일시</th>
                  <th style={{ width: 130 }}>회원</th>
                  <th style={{ width: 80, textAlign: 'center' }}>구분</th>
                  <th style={{ width: 90, textAlign: 'right' }}>증감</th>
                  <th style={{ width: 90, textAlign: 'right' }}>잔액</th>
                  <th>사유</th>
                  <th style={{ width: 110 }}>처리자</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.createdAt.slice(0, 16).replace('T', ' ')}</td>
                    <td className="strong">{t.userName ?? '회원'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={clsx('badge', t.type === 'GRANT' ? 'live' : 'hidden')}>
                        {TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {t.type === 'GRANT' ? '+' : '−'}
                      {t.amount.toLocaleString()}
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {t.balanceAfter.toLocaleString()}
                    </td>
                    <td>{t.reason}</td>
                    <td>{t.actorName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {target && (
        <AdjustModal
          user={target}
          onClose={() => setTarget(null)}
          onDone={(tx) => handleAdjusted(target, tx)}
        />
      )}
    </section>
  )
}

/** 지급·차감 모달 — 방향/수량/사유를 받아 POST 한 건 */
function AdjustModal({
  user,
  onClose,
  onDone,
}: {
  user: CreditUser
  onClose: () => void
  onDone: (tx: CreditTransaction) => void
}) {
  const toast = useToast()
  const [type, setType] = useState<CreditTransactionType>('GRANT')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const parsed = Number(amount)
  const valid = Number.isInteger(parsed) && parsed > 0 && reason.trim().length > 0
  // 차감은 보유 잔액을 넘을 수 없다 (서버도 동일 검증 — 여기선 버튼을 미리 막는 용도)
  const overDeduct = type === 'DEDUCT' && parsed > user.creditBalance

  const submit = async () => {
    if (!valid || overDeduct || saving) return
    setSaving(true)
    try {
      const tx = await adjustCredit(user.userId, { type, amount: parsed, reason: reason.trim() })
      onDone(tx)
    } catch {
      toast('크레딧 조정에 실패했어요. 다시 시도해주세요')
      setSaving(false)
    }
  }

  return (
    <div className="cr-overlay" onClick={onClose}>
      <div className="card cr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div>
            <div className="card-title">{displayName(user)} 크레딧 조정</div>
            <div className="card-sub">
              현재 잔액 <CreditMark />
              {user.creditBalance.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={clsx(type === 'GRANT' && 'on')} onClick={() => setType('GRANT')}>
            지급
          </button>
          <button className={clsx(type === 'DEDUCT' && 'on')} onClick={() => setType('DEDUCT')}>
            차감
          </button>
        </div>

        <label className="cr-field">
          <span>수량</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="예: 10"
          />
        </label>
        {overDeduct && (
          <p className="cr-error">보유 잔액({user.creditBalance.toLocaleString()})보다 많이 차감할 수 없어요</p>
        )}

        <label className="cr-field">
          <span>사유</span>
          <input
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 이벤트 보상 지급"
          />
        </label>

        <div className="cr-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!valid || overDeduct || saving}
            onClick={submit}
          >
            {saving ? '처리 중…' : `${TYPE_LABEL[type]}하기`}
          </button>
        </div>
      </div>
    </div>
  )
}

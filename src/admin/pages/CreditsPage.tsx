import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import {
  adjustCredit,
  fetchCreditStats,
  fetchCreditTransactions,
  fetchCreditUsers,
  type CreditStats,
  type CreditTransaction,
  type CreditAdjustType,
  type CreditTransactionType,
  type CreditUser,
} from '../api/adminApi'
import { StatCard } from '../components/StatCard'
import { CreditMark } from '../components/CreditMark'
import { formatPhoneSearch } from '../searchFormat'
import { useToast } from '../components/toast'

const PAGE_SIZE = 20
const TX_PAGE_SIZE = 10

const TYPE_LABEL: Record<CreditTransactionType, string> = {
  ADMIN_GRANT: '지급',
  ADMIN_DEDUCT: '차감',
  USE: '사용',
  REWARD: '적립',
}

/** 잔액을 늘리는 종류 — 부호·배지 색이 이걸로 갈린다 (서버가 amount 를 항상 양수로 준다) */
const INCREASE_TYPES: readonly CreditTransactionType[] = ['ADMIN_GRANT', 'REWARD']
const isIncrease = (type: CreditTransactionType) => INCREASE_TYPES.includes(type)

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
  // 회원별 이력 모달 대상 (null = 닫힘) — 행 클릭·이력 버튼 (2026-09-08). 하단 표는 항상 전체 최근 이력
  const [historyUser, setHistoryUser] = useState<CreditUser | null>(null)

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
    fetchCreditTransactions({ page: 0, size: TX_PAGE_SIZE })
      .then((res) => {
        setTransactions(res.content)
        setTxTotal(res.totalElements)
      })
      .catch(() => setTransactions([]))
  }, [])

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
              onChange={(e) => setQ(formatPhoneSearch(e.target.value))}
              placeholder="이름 · 이메일 · 전화번호 검색"
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
            {/* min-width: 창이 좁아도 컬럼을 쥐어짜지 않고 카드 안에서 가로 스크롤 (th 폭은 content-box · +28 패딩) */}
            <table style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>이름</th>
                  <th>이메일</th>
                  <th style={{ width: 130 }}>전화번호</th>
                  <th style={{ width: 90, textAlign: 'center' }}>크레딧</th>
                  <th style={{ width: 170, textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.userId}
                    style={{ cursor: 'pointer' }}
                    title="클릭해서 크레딧 이력 보기"
                    onClick={() => setHistoryUser(u)}
                  >
                    <td className="strong">{displayName(u)}</td>
                    <td>{u.email ?? '—'}</td>
                    <td className="num">{formatPhone(u.phoneNumber)}</td>
                    <td className="num" style={{ textAlign: 'center' }}>
                      <CreditMark />
                      {u.creditBalance.toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={(e) => { e.stopPropagation(); setTarget(u) }}
                        >
                          조정
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => { e.stopPropagation(); setHistoryUser(u) }}
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
            <div className="card-title">최근 크레딧 이력</div>
            <div className="card-sub">
              총 {txTotal.toLocaleString()}건 · 최신 {TX_PAGE_SIZE}건 표시 · 회원별 전체 이력은 위 목록에서 행을 클릭
            </div>
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="page-sub">이력이 없습니다.</p>
        ) : (
          <div className="table-wrap">
            {/* min-width: 폭 합(≈810) + 사유 최소 220. 창이 좁으면 카드 안에서 가로 스크롤 — 컬럼이 쥐어짜여 말줄임 되지 않게 */}
            <table style={{ minWidth: 1030 }}>
              <thead>
                <tr>
                  {/* th 는 content-box — 지정 폭 + 셀 패딩 28 이 실제 폭. 일시 160→188 ("2026-09-07 18:00" 넉넉히) · 구분 80→108 (배지 80) */}
                  <th style={{ width: 160 }}>일시</th>
                  <th style={{ width: 120 }}>회원</th>
                  <th style={{ width: 80, textAlign: 'center' }}>구분</th>
                  <th style={{ width: 72, textAlign: 'right' }}>증감</th>
                  <th style={{ width: 72, textAlign: 'right' }}>잔액</th>
                  <th>사유</th>
                  <th style={{ width: 100 }}>처리자</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.createdAt.slice(0, 16).replace('T', ' ')}</td>
                    <td className="strong">{t.userName ?? '회원'}</td>
                    <td style={{ textAlign: 'center', overflow: 'visible', textOverflow: 'clip' }}>
                      <span className={clsx('badge', isIncrease(t.type) ? 'live' : 'neutral')}>
                        {TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {isIncrease(t.type) ? '+' : '−'}
                      {t.amount.toLocaleString()}
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {t.balanceAfter.toLocaleString()}
                    </td>
                    <td title={t.reason}>{t.reason}</td>
                    {/* 마지막 셀은 전역 규칙이 우측 정렬 — 헤더(좌)와 맞춘다 */}
                    <td style={{ textAlign: 'left' }}>{t.actorName ?? '—'}</td>
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
      {historyUser && (
        <HistoryModal
          user={historyUser}
          onClose={() => setHistoryUser(null)}
          onAdjust={() => { setHistoryUser(null); setTarget(historyUser) }}
        />
      )}
    </section>
  )
}

const HISTORY_PAGE_SIZE = 20

/**
 * 회원별 크레딧 이력 모달 — 목록 행 클릭·이력 버튼으로 연다 (2026-09-08).
 * 원장(credit_transactions)을 최신순 20건씩 페이지네이션. 회원 컬럼은 한 사람 것이라 뺀다.
 */
function HistoryModal({
  user,
  onClose,
  onAdjust,
}: {
  user: CreditUser
  onClose: () => void
  onAdjust: () => void
}) {
  const [rows, setRows] = useState<CreditTransaction[] | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setRows(null)
    setFailed(false)
    fetchCreditTransactions({ userId: user.userId, page, size: HISTORY_PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setRows(res.content)
        setTotal(res.totalElements)
        setTotalPages(res.totalPages)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [user.userId, page])

  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const rangeStart = total === 0 ? 0 : page * HISTORY_PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * HISTORY_PAGE_SIZE, total)
  const pageButtons: number[] = []
  const windowStart = Math.max(0, Math.min(page - 2, totalPages - 5))
  for (let i = windowStart; i < Math.min(windowStart + 5, totalPages); i++) pageButtons.push(i)

  return createPortal(
    <div className="cr-overlay" onClick={onClose}>
      <div className="card cr-modal cr-modal-wide" role="dialog" aria-label={`${displayName(user)} 크레딧 이력`} onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <div>
            <div className="card-title">{displayName(user)} 크레딧 이력</div>
            <div className="card-sub">
              {user.email ?? '—'} · 현재 잔액 <CreditMark />
              {user.creditBalance.toLocaleString()} · 총 {total.toLocaleString()}건
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={onAdjust}>조정</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button>
          </div>
        </div>

        {failed && <p className="page-sub">이력을 불러오지 못했어요. 다시 열어주세요.</p>}
        {!failed && rows == null && <p className="page-sub">불러오는 중…</p>}
        {!failed && rows != null && rows.length === 0 && <p className="page-sub">이력이 없습니다.</p>}
        {!failed && rows != null && rows.length > 0 && (
          <div className="table-wrap cr-history-wrap">
            <table style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>일시</th>
                  <th style={{ width: 80, textAlign: 'center' }}>구분</th>
                  <th style={{ width: 64, textAlign: 'right' }}>증감</th>
                  <th style={{ width: 64, textAlign: 'right' }}>잔액</th>
                  <th>사유</th>
                  <th style={{ width: 90 }}>처리자</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="num">{t.createdAt.slice(0, 16).replace('T', ' ')}</td>
                    <td style={{ textAlign: 'center', overflow: 'visible', textOverflow: 'clip' }}>
                      <span className={clsx('badge', isIncrease(t.type) ? 'live' : 'neutral')}>
                        {TYPE_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {isIncrease(t.type) ? '+' : '−'}
                      {t.amount.toLocaleString()}
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>{t.balanceAfter.toLocaleString()}</td>
                    <td title={t.reason}>{t.reason}</td>
                    <td style={{ textAlign: 'left' }}>{t.actorName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="toolbar-pg" style={{ marginTop: 14 }}>
            <span className="info num">
              {rangeStart}–{rangeEnd} / {total.toLocaleString()}건
            </span>
            <div className="pages">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
              {pageButtons.map((p) => (
                <button key={p} className={clsx('num', p === page && 'on')} onClick={() => setPage(p)}>
                  {p + 1}
                </button>
              ))}
              <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.querySelector('.admin-root') ?? document.body,
  )
}

/** 조정 모달 — 현재 잔액에서 ±1 스테퍼로 목표값을 잡아 차이만큼 지급/차감 POST 한 건 */
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
  const [value, setValue] = useState(user.creditBalance)
  const [saving, setSaving] = useState(false)

  // 조정량 = 목표값 − 현재 잔액. 방향은 부호가 갖는다 (최소 0 — 잔액 밑으로 차감 불가)
  const delta = value - user.creditBalance
  const type: CreditAdjustType = delta > 0 ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT'

  const submit = async () => {
    if (delta === 0 || saving) return
    setSaving(true)
    try {
      const tx = await adjustCredit(user.userId, {
        type,
        amount: Math.abs(delta),
        reason: `어드민 조정 (${user.creditBalance} → ${value})`,
      })
      onDone(tx)
    } catch {
      toast('크레딧 조정에 실패했어요. 다시 시도해주세요')
      setSaving(false)
    }
  }

  // .view 진입 애니메이션의 transform 이 fixed 기준점을 바꿔 오버레이가 본문 영역만 덮는다.
  // 포털로 밖에 렌더 — 어드민 CSS 변수가 .admin-root 스코프라 대상도 .admin-root
  return createPortal(
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

        <div className="cr-stepper">
          <button
            type="button"
            aria-label="1 감소"
            disabled={value <= 0}
            onClick={() => setValue((v) => Math.max(0, v - 1))}
          >
            −
          </button>
          <span className="cr-value num">{value.toLocaleString()}</span>
          <button type="button" aria-label="1 증가" onClick={() => setValue((v) => v + 1)}>
            +
          </button>
        </div>

        <p className={clsx('cr-delta', delta > 0 && 'grant', delta < 0 && 'deduct', delta === 0 && 'same')}>
          {delta === 0
            ? '현재 잔액과 같아요'
            : `저장 시 ${TYPE_LABEL[type]} ${Math.abs(delta).toLocaleString()}`}
        </p>

        <div className="cr-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={delta === 0 || saving}
            onClick={submit}
          >
            {saving ? '처리 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.querySelector('.admin-root') ?? document.body,
  )
}

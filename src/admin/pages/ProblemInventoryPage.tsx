import { useCallback, useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { fetchAdminProblemInventory, type AdminProblemInventory } from '../api/adminApi'
import { useToast } from '../components/toast'

type SubjectKey = 'MATH' | 'ENGLISH'

/** 세트 1개 = 3문항 — 남은 노출 문항이 이보다 적으면 발급이 막힌다 */
const SET_SIZE = 3

/**
 * 문제 재고 — 소단원별 노출 문항 수와 "더 받을 문제가 없는" 유저 규모.
 *
 * 사다리 세트(자유·추천)는 유저가 이미 제출한 문항을 다시 내지 않는다(2026-09-02).
 * 그래서 문항이 적은 단원은 열심히 푼 유저부터 막히기 시작한다 — 어느 단원에
 * 문제를 먼저 넣어야 하는지 이 표로 고른다.
 */
export default function ProblemInventoryPage() {
  const toast = useToast()

  const [subject, setSubject] = useState<SubjectKey>('MATH')
  const [rows, setRows] = useState<AdminProblemInventory[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (target: SubjectKey) => {
      setLoading(true)
      fetchAdminProblemInventory(target)
        .then((list) => {
          setRows(list)
          setLoading(false)
        })
        .catch(() => {
          setLoading(false)
          toast('문제 재고를 불러오지 못했어요')
        })
    },
    [toast],
  )

  useEffect(() => {
    load(subject)
  }, [subject, load])

  const isMath = subject === 'MATH'
  const exhaustedUnits = rows.filter((r) => r.exhaustedCount > 0 || r.activeCount < SET_SIZE).length
  const totalExhaustedUsers = rows.reduce((sum, r) => sum + r.exhaustedCount, 0)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 className="section-title" style={{ marginBottom: 4 }}>문제 재고</h2>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
            자유·추천 세트는 이미 푼 문제를 다시 내지 않아요. 남은 문항이 {SET_SIZE}개 미만인
            유저는 세트를 받을 수 없으니, 소진 유저가 생긴 단원부터 문제를 추가해주세요.
          </p>
        </div>
        <div className="seg">
          <button type="button" className={clsx(isMath && 'on')} onClick={() => setSubject('MATH')}>
            수학
          </button>
          <button type="button" className={clsx(!isMath && 'on')} onClick={() => setSubject('ENGLISH')}>
            영어
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>불러오는 중…</p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 14px' }}>
              {exhaustedUnits > 0
                ? `보충이 필요한 단원 ${exhaustedUnits}개 · 세트 발급이 막힌 유저 ${totalExhaustedUsers}명`
                : '모든 단원에서 세트 발급이 가능해요'}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>단원</th>
                    <th style={{ width: 88 }}>문항</th>
                    {isMath && (
                      <>
                        {/* 배점별 "남은/노출" — 가장 많이 푼 유저 기준. 남은 0 = 그 배점은 하향 대체로 채워지는 중 (2026-09-14) */}
                        <th style={{ width: 84 }}>2점</th>
                        <th style={{ width: 84 }}>3점</th>
                        <th style={{ width: 84 }}>4점</th>
                      </>
                    )}
                    <th style={{ width: 150 }}>가장 앞선 유저</th>
                    <th style={{ width: 96 }}>남은 문항</th>
                    <th style={{ width: 130 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.unitCode}>
                      <td>
                        <span className="strong">{row.skillNode}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-muted)' }}>
                          {row.unitLarge}
                          {row.unitMid ? ` · ${row.unitMid}` : ''} · {row.unitCode}
                        </span>
                      </td>
                      <td className="num">
                        <span className="strong">{row.activeCount}</span>
                        {row.inactiveCount > 0 && <Sub>대기 {row.inactiveCount}</Sub>}
                      </td>
                      {isMath && (
                        <>
                          <ScoreCell count={row.score2Count} maxSolved={row.score2MaxSolved} />
                          <ScoreCell count={row.score3Count} maxSolved={row.score3MaxSolved} />
                          <ScoreCell count={row.score4Count} maxSolved={row.score4MaxSolved} />
                        </>
                      )}
                      <TopSolverCell row={row} />
                      <RemainingCell row={row} />
                      <td>
                        <InventoryBadge row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/** 칸 아래 작은 보조 줄 */
function Sub({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 11,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: danger ? 'var(--color-primary)' : 'var(--color-muted)',
      }}
    >
      {children}
    </span>
  )
}

/**
 * 배점 칸 — "남은/노출" 한 줄. 남은 = 노출 − 그 배점을 가장 많이 푼 유저의 풀이 수.
 * 남은 0 은 빨강: 앞선 유저에겐 이미 바닥 → 세트가 하향 대체(4→3→2)로 채워지는 중.
 * 노출 0 은 대시로 비워 부족한 배점이 한눈에 보이게
 */
function ScoreCell({ count, maxSolved }: { count: number; maxSolved: number }) {
  if (count === 0) {
    return (
      <td className="num" style={{ color: 'var(--color-muted)' }}>
        —
      </td>
    )
  }
  const remaining = Math.max(0, count - maxSolved)
  // 남은 수는 연하게, 노출 수는 진하게 — 0 만 빨강으로 튀게
  return (
    <td className="num">
      <span style={{ color: remaining === 0 ? 'var(--color-primary)' : 'var(--color-muted)' }}>{remaining}</span>
      <span className="strong">/{count}</span>
    </td>
  )
}

/** 단원에서 가장 많이 푼 유저 — 풀이/노출 + 표시 이름 (관계자 제외) */
function TopSolverCell({ row }: { row: AdminProblemInventory }) {
  if (row.learnerCount === 0 || !row.topSolverName) {
    return (
      <td className="num" style={{ color: 'var(--color-muted)' }}>
        —
      </td>
    )
  }
  return (
    <td className="num">
      <span style={{ color: 'var(--color-muted)' }}>{row.topSolvedCount}</span>
      <span className="strong">/{row.activeCount}</span>
      <span style={{ color: 'var(--color-muted)' }}> 풀음</span>
      <Sub>{row.topSolverName}</Sub>
    </td>
  )
}

/** 가장 앞선 유저에게 남은 문항 — 3문항 = 1세트. 3개 미만이면 그 유저는 이미 발급 불가 */
function RemainingCell({ row }: { row: AdminProblemInventory }) {
  if (row.learnerCount === 0) {
    return (
      <td className="num" style={{ color: 'var(--color-muted)' }}>
        —
      </td>
    )
  }
  const remaining = row.topRemainingCount
  const sets = Math.floor(remaining / SET_SIZE)
  const danger = remaining < SET_SIZE
  return (
    <td className="num">
      <span className="strong" style={danger ? { color: 'var(--color-primary)' } : undefined}>{remaining}개</span>
      <Sub danger={danger}>{sets > 0 ? `${sets}세트` : '발급 불가'}</Sub>
    </td>
  )
}

/**
 * 단원 상태 한 배지 — 문항 부족(3개 미만) › 막힘(세트 못 받는 유저 수) › 임박(1세트 남은 유저 수) › 여유(풀어본 유저 수).
 * 예전의 풀어본·1세트 남음·소진 세 열을 이 배지 하나로 합쳤다 (2026-09-14)
 */
function InventoryBadge({ row }: { row: AdminProblemInventory }) {
  if (row.activeCount < SET_SIZE) return <span className="badge danger ua-badge-fit">문항 부족</span>
  if (row.exhaustedCount > 0) return <span className="badge danger ua-badge-fit">막힘 {row.exhaustedCount}명</span>
  if (row.oneSetLeftCount > 0) return <span className="badge pending ua-badge-fit">임박 {row.oneSetLeftCount}명</span>
  return <span className="badge live ua-badge-fit">여유{row.learnerCount > 0 ? ` · ${row.learnerCount}명` : ''}</span>
}

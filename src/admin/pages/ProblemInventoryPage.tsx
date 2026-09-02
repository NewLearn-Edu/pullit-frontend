import { useCallback, useEffect, useState } from 'react'
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
                    <th style={{ width: 100 }}>노출 문항</th>
                    {isMath && (
                      <>
                        <th style={{ width: 72 }}>2점</th>
                        <th style={{ width: 72 }}>3점</th>
                        <th style={{ width: 72 }}>4점</th>
                      </>
                    )}
                    <th style={{ width: 90 }}>비노출</th>
                    <th style={{ width: 110 }}>풀어본 유저</th>
                    <th style={{ width: 110 }}>1세트 남음</th>
                    <th style={{ width: 90 }}>소진</th>
                    <th style={{ width: 120 }}>상태</th>
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
                      <td className="num strong">{row.activeCount}개</td>
                      {isMath && (
                        <>
                          <ScoreCell count={row.score2Count} />
                          <ScoreCell count={row.score3Count} />
                          <ScoreCell count={row.score4Count} />
                        </>
                      )}
                      <td className="num">{row.inactiveCount > 0 ? `${row.inactiveCount}개` : '—'}</td>
                      <td className="num">{row.learnerCount}명</td>
                      <td className="num">{row.oneSetLeftCount > 0 ? `${row.oneSetLeftCount}명` : '—'}</td>
                      <td className="num">{row.exhaustedCount > 0 ? `${row.exhaustedCount}명` : '—'}</td>
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

/** 배점별 노출 문항 수 — 0 은 대시로 비워 부족한 배점이 한눈에 보이게 */
function ScoreCell({ count }: { count: number }) {
  return (
    <td className="num" style={count === 0 ? { color: 'var(--color-muted)' } : undefined}>
      {count > 0 ? count : '—'}
    </td>
  )
}

/**
 * 단원 상태 — 발급 불가(문항 자체가 3개 미만) › 소진(막힌 유저 있음) › 임박(1세트 남은 유저 있음) › 여유
 */
function InventoryBadge({ row }: { row: AdminProblemInventory }) {
  if (row.activeCount < SET_SIZE) return <span className="badge danger ua-badge-fit">발급 불가</span>
  if (row.exhaustedCount > 0) return <span className="badge danger ua-badge-fit">소진 {row.exhaustedCount}명</span>
  if (row.oneSetLeftCount > 0) return <span className="badge pending ua-badge-fit">임박 {row.oneSetLeftCount}명</span>
  return <span className="badge live ua-badge-fit">여유</span>
}

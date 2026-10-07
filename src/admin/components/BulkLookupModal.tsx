import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { fetchProblems, type ApiSubject, type ProblemListItem } from '../api/adminApi'

/** problem_code 규격 `{과목}_{교육과정}_{대}_{중}_{소}_{4자리}` — 백엔드 ProblemRepositoryImpl.extractProblemCodes 와 같은 규격 */
const PROBLEM_CODE_RE = /(?:math|english)_\d{4}(?:_\d+){3}_\d{4}/gi
/** 한 번에 조회하는 ID 상한 — 백엔드 페이지 크기와 같다 */
const MAX_IDS = 500

function extractCodes(text: string): { ids: string[]; duplicates: number } {
  const all = (text.match(PROBLEM_CODE_RE) ?? []).map((c) => c.toLowerCase())
  const ids = [...new Set(all)]
  return { ids, duplicates: all.length - ids.length }
}

interface Row {
  id: string
  item: ProblemListItem | null
}

interface Props {
  subject: ApiSubject
  subjectLabel: string
  onOpenDetail: (id: string) => void
  onClose: () => void
}

/**
 * ID 일괄 조회 팝업 (2026-10-07) — 엑셀 열을 그대로 붙여넣고 "조회" 하면
 * 붙여넣은 순서대로 ID 마다 ● (있음) / ✕ (없음) 를 보여준다. 현재 탭 과목 기준.
 */
export default function BulkLookupModal({ subject, subjectLabel, onOpenDetail, onClose }: Props) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const { ids, duplicates } = useMemo(() => extractCodes(text), [text])
  const overflow = ids.length > MAX_IDS

  // ESC 닫기 — 위에 문제 미리보기가 떠 있으면 그쪽이 먼저 닫힌다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.pv-modal-overlay')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const lookup = async () => {
    if (ids.length === 0 || overflow || loading) return
    setLoading(true)
    setFailed(false)
    try {
      const page = await fetchProblems({ subject, q: ids.join(' '), page: 0, size: Math.max(ids.length, 1) })
      const found = new Map(page.content.map((it) => [it.id.toLowerCase(), it]))
      setRows(ids.map((id) => ({ id, item: found.get(id) ?? null })))
    } catch {
      setRows(null)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const foundCount = rows?.filter((r) => r.item).length ?? 0
  const missing = rows?.filter((r) => !r.item).map((r) => r.id) ?? []

  const copyMissing = async () => {
    try {
      await navigator.clipboard.writeText(missing.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 클립보드 권한 없음 — 조용히 무시 */
    }
  }

  const clear = () => {
    setText('')
    setRows(null)
    setFailed(false)
  }

  return createPortal(
    <div className="rtu-dim bulk-dim" onClick={onClose}>
      <div role="dialog" aria-label="문제 ID 일괄 조회" className="rtu-modal bulk-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="rtu-head">
          <div className="rtu-head-text">
            <p className="card-title">ID 일괄 조회</p>
            <p className="card-sub">
              엑셀에서 ID 열을 복사해 붙여넣고 조회하세요 · {subjectLabel} 문제 기준 · 한 번에 {MAX_IDS}개까지
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button>
        </div>

        <div className="bulk-body">
          <div className="bulk-input">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'math_2022_1_1_1_0044\nmath_2022_1_1_1_0191\n…'}
              spellCheck={false}
              autoFocus
            />
            <div className="bulk-input-foot">
              <span className={clsx('bulk-count num', overflow && 'over')}>
                ID {ids.length.toLocaleString()}개
                {duplicates > 0 && <span className="sub"> · 중복 {duplicates}개 제외</span>}
                {overflow && <span className="sub"> · {MAX_IDS}개 이하로 줄여주세요</span>}
              </span>
              <div className="bulk-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={text === ''}>지우기</button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={lookup}
                  disabled={ids.length === 0 || overflow || loading}
                >
                  {loading ? '조회 중…' : '조회'}
                </button>
              </div>
            </div>
          </div>

          <div className="bulk-result">
            {failed && <p className="page-sub">조회하지 못했습니다. 백엔드 연결을 확인하세요.</p>}
            {!failed && rows === null && (
              <p className="page-sub bulk-empty">왼쪽에 ID 를 붙여넣고 조회를 누르면 결과가 여기에 나옵니다.</p>
            )}
            {rows !== null && (
              <>
                <div className="bulk-summary">
                  <span className="num">
                    <b>{rows.length.toLocaleString()}</b>개 중{' '}
                    <b className="ok">{foundCount.toLocaleString()}</b>개 있음
                    {missing.length > 0 && (
                      <>
                        {' · '}<b className="no">{missing.length.toLocaleString()}</b>개 없음
                      </>
                    )}
                  </span>
                  {missing.length > 0 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={copyMissing}>
                      {copied ? '복사됨' : '없는 ID 복사'}
                    </button>
                  )}
                </div>
                <div className="table-wrap bulk-table-wrap">
                  <table className="bulk-table">
                    <thead>
                      <tr>
                        <th style={{ width: 56 }}>#</th>
                        <th style={{ width: 64 }}>결과</th>
                        <th style={{ width: 210 }}>ID</th>
                        <th>단원</th>
                        <th style={{ width: 64 }}>점수</th>
                        <th style={{ width: 110 }}>상태</th>
                        <th style={{ width: 92 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.id} className={clsx(!r.item && 'missing')}>
                          <td className="num">{i + 1}</td>
                          <td>
                            {r.item ? (
                              <span className="bulk-mark ok" aria-label="있음">●</span>
                            ) : (
                              <span className="bulk-mark no" aria-label="없음">✕</span>
                            )}
                          </td>
                          <td className="num bulk-id">{r.id}</td>
                          <td className="bulk-unit">
                            {r.item
                              ? [r.item.unitLarge, r.item.unitMid, r.item.skillNode].filter(Boolean).join(' › ')
                              : <span className="sub">등록된 문제가 없어요</span>}
                          </td>
                          <td className="num">{r.item ? `${r.item.score}점` : '–'}</td>
                          <td>
                            {r.item && (
                              <span className={clsx('badge', r.item.status === 'ACTIVE' ? 'live' : 'hidden')}>
                                {r.item.status === 'ACTIVE' ? '게시 중' : '비공개'}
                              </span>
                            )}
                          </td>
                          <td>
                            {r.item && (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenDetail(r.id)}>
                                상세
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.querySelector('.admin-root') ?? document.body,
  )
}

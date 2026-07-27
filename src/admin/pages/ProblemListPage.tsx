import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { KatexText } from '@/shared/components/KatexText'
import { IcoSearch } from '../components/icons'
import {
  DIFF_LABEL,
  ENGLISH_PROBLEMS,
  MATH_PROBLEMS,
  STATUS_LABEL,
  UNITS,
  getPreview,
  normUnit,
} from '../data/mockAdmin'

const SUBJECT_LABEL: Record<string, string> = { math: '수학', english: '영어' }

interface CasSel {
  big: string | null
  mid: string | null
  small: string | null
}

export default function ProblemListPage() {
  const { subject = '' } = useParams()
  const label = SUBJECT_LABEL[subject]

  const [cas, setCas] = useState<CasSel>({ big: null, mid: null, small: null })
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // 과목 전환 시: 선택 해제 + 미리보기 닫힘 (프로토타입 applySubject 와 동일)
  useEffect(() => {
    setSelectedId(null)
  }, [subject])

  const mathRows = useMemo(
    () =>
      MATH_PROBLEMS.filter(
        (p) =>
          (!cas.big || normUnit(p.big) === normUnit(cas.big)) &&
          (!cas.mid || normUnit(p.mid) === normUnit(cas.mid)) &&
          (!cas.small || normUnit(p.small) === normUnit(cas.small)),
      ),
    [cas],
  )

  if (!label) return <Navigate to="/admin/problems/math" replace />
  const isMath = subject === 'math'

  const visible = isMath ? mathRows.length : ENGLISH_PROBLEMS.length
  const pending = (isMath ? mathRows : ENGLISH_PROBLEMS).filter((p) => p.status === 'pending').length

  // 캐스케이더 조작 시에도 선택 해제 (프로토타입: applySubject 가 항상 선택을 리셋)
  const selectCas = (next: CasSel) => {
    setCas(next)
    setSelectedId(null)
  }
  const toggleRow = (id: number) => setSelectedId((prev) => (prev === id ? null : id))

  const preview = selectedId != null ? getPreview(selectedId) : null

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>{label} 문제 목록</h2>
          <p className="page-sub">전체 {visible}문제 · 검수 대기 {pending}건</p>
        </div>
      </div>

      {/* 분류 필터: 대분류 › 중분류 › 소분류 — 수학 전용 */}
      {isMath && <Cascader sel={cas} onChange={selectCas} />}

      <div className={clsx('list-layout', selectedId != null && 'open')}>
        <div className="card">
          <div className="toolbar">
            <div className="search-box">
              <IcoSearch />
              <input type="text" placeholder="문제 제목, ID로 검색" />
            </div>
            <select className="select">
              <option>전체 상태</option>
              <option>게시 중</option>
              <option>검수 대기</option>
              <option>비공개</option>
            </select>
            <select className="select">
              <option>전체 난이도</option>
              <option>쉬움</option>
              <option>보통</option>
              <option>어려움</option>
            </select>
            <div className="spacer" />
            <div className="toolbar-pg">
              <span className="info num">1–{visible} / {visible}건</span>
              <div className="pages">
                <button>‹</button>
                <button className="on num">1</button>
                <button className="num">2</button>
                <button className="num">3</button>
                <button className="num">4</button>
                <span style={{ alignSelf: 'center', color: 'var(--color-muted)' }}>…</span>
                <button className="num">1606</button>
                <button>›</button>
              </div>
            </div>
          </div>

          {isMath ? (
            /* 수학 문제 목록: ID · 대단원 · 중단원 · 소단원 · 점수 · 렌더타입 · 상태 · 풀이 수 · 등록일 */
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>ID</th>
                    <th style={{ width: 160 }}>대단원</th>
                    <th style={{ width: 220 }} className="col-mid">중단원</th>
                    <th style={{ width: 220 }}>소단원</th>
                    <th style={{ width: 70 }}>점수</th>
                    <th style={{ width: 112 }} className="col-render">렌더타입</th>
                    <th style={{ width: 120 }}>상태</th>
                    <th style={{ width: 90, textAlign: 'right' }} className="col-solves">풀이 수</th>
                    <th style={{ width: 120 }} className="col-date">등록일</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {mathRows.map((p) => (
                    <tr
                      key={p.id}
                      className={clsx(selectedId === p.id && 'selected')}
                      onClick={() => toggleRow(p.id)}
                    >
                      <td className="num" style={{ color: 'var(--color-muted)' }}>#{p.id}</td>
                      <td className="strong">{p.big}</td>
                      <td className="col-mid">{p.mid}</td>
                      <td>{p.small}</td>
                      <td className="num">{p.score}점</td>
                      <td className="col-render"><span className="badge neutral">{p.render}</span></td>
                      <td><span className={`badge ${p.status}`}>{STATUS_LABEL[p.status]}</span></td>
                      <td className="num col-solves" style={{ textAlign: 'right' }}>{p.solves.toLocaleString()}</td>
                      <td className="num col-date">{p.date}</td>
                      <td><button className="btn btn-ghost btn-sm">상세</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* 영어 문제 목록 */
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>ID</th>
                    <th>문제</th>
                    <th style={{ width: 90 }}>난이도</th>
                    <th style={{ width: 120 }}>상태</th>
                    <th style={{ width: 90, textAlign: 'right' }} className="col-solves">풀이 수</th>
                    <th style={{ width: 120 }} className="col-date">등록일</th>
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {ENGLISH_PROBLEMS.map((p) => (
                    <tr
                      key={p.id}
                      className={clsx(selectedId === p.id && 'selected')}
                      onClick={() => toggleRow(p.id)}
                    >
                      <td className="num" style={{ color: 'var(--color-muted)' }}>#{p.id}</td>
                      <td className="strong">
                        {p.title}
                        <span className="sub">{p.sub}</span>
                      </td>
                      <td><span className={`diff d${p.diff}`}>{DIFF_LABEL[p.diff]}</span></td>
                      <td><span className={`badge ${p.status}`}>{STATUS_LABEL[p.status]}</span></td>
                      <td className="num col-solves" style={{ textAlign: 'right' }}>{p.solves.toLocaleString()}</td>
                      <td className="num col-date">{p.date}</td>
                      <td><button className="btn btn-ghost btn-sm">상세</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 문제 미리보기 (500px) */}
        <aside className="preview">
          <div className="card">
            <div className="card-head" style={{ marginBottom: 14 }}>
              <div>
                <div className="card-title">문제 미리보기</div>
                <div className="card-sub">
                  {preview
                    ? `#${selectedId} · ${preview.path}`
                    : selectedId != null
                      ? '미리보기가 등록되지 않은 문제예요'
                      : '문제를 선택하세요'}
                </div>
              </div>
            </div>
            {preview && (
              <div className="pv-body">
                <div className="pv-question"><KatexText text={preview.q} /></div>
                {preview.passage && <div className="pv-passage">{preview.passage}</div>}
                <div className="pv-score">[{preview.score}]</div>
                <div className="pv-choices">
                  {preview.choices.map((c, i) => (
                    <span key={i} className="choice">
                      <span className="choice-num">{i + 1}</span>
                      <span><KatexText text={c} /></span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

function Cascader({ sel, onChange }: { sel: CasSel; onChange: (next: CasSel) => void }) {
  const toggleBig = (v: string) =>
    onChange({ big: sel.big === v ? null : v, mid: null, small: null })
  const toggleMid = (v: string) => onChange({ ...sel, mid: sel.mid === v ? null : v, small: null })
  const toggleSmall = (v: string) => onChange({ ...sel, small: sel.small === v ? null : v })

  return (
    <div className="cascader">
      <div className="card cas-col">
        <div className="cas-head">대분류</div>
        <ul className="cas-list">
          <li
            className={clsx(sel.big === null && 'on')}
            onClick={() => onChange({ big: null, mid: null, small: null })}
          >
            전체
          </li>
          {Object.keys(UNITS).map((k) => (
            <li key={k} className={clsx(sel.big === k && 'on')} onClick={() => toggleBig(k)}>
              {k}
            </li>
          ))}
        </ul>
      </div>
      <div className="card cas-col">
        <div className="cas-head">중분류</div>
        <ul className="cas-list">
          {sel.big ? (
            Object.keys(UNITS[sel.big]).map((k) => (
              <li key={k} className={clsx(sel.mid === k && 'on')} onClick={() => toggleMid(k)}>
                {k}
              </li>
            ))
          ) : (
            <li className="cas-empty">대분류를 선택하세요</li>
          )}
        </ul>
      </div>
      <div className="card cas-col">
        <div className="cas-head">소분류</div>
        <ul className="cas-list">
          {sel.big && sel.mid ? (
            UNITS[sel.big][sel.mid].map((k) => (
              <li key={k} className={clsx(sel.small === k && 'on')} onClick={() => toggleSmall(k)}>
                {k}
              </li>
            ))
          ) : (
            <li className="cas-empty">중분류를 선택하세요</li>
          )}
        </ul>
      </div>
    </div>
  )
}

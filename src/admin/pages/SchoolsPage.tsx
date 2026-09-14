import { useEffect, useMemo, useState } from 'react'
import {
  fetchAdminSchool,
  fetchAdminSchools,
  fetchSchoolSyncStatus,
  runSchoolSync,
  type AdminSchool,
  type AdminSchoolDetail,
  type SchoolSyncLog,
  type SchoolSyncStatus,
} from '../api/adminApi'
import { StatCard } from '../components/StatCard'

const GRADE_LABEL: Record<string, string> = { MIDDLE: '중학교', HIGH: '고등학교' }
const HIGH_TYPE_LABEL: Record<string, string> = { GENERAL: '일반고', SPECIAL_PURPOSE: '특목고', AUTONOMOUS: '자율고', SPECIALIZED: '특성화고' }
const FOUNDATION_LABEL: Record<string, string> = { NATIONAL: '국립', PUBLIC: '공립', PRIVATE: '사립', OTHER: '기타' }
const GENDER_LABEL: Record<string, string> = { BOYS: '남', GIRLS: '여', MIXED: '남녀공학' }
const RESULT_LABEL: Record<SchoolSyncLog['result'], string> = { RUNNING: '실행 중', SUCCESS: '성공', SKIPPED_CLOSING: '성공 · 폐교 건너뜀', FAILED: '실패' }
const TRIGGER_LABEL: Record<SchoolSyncLog['triggeredBy'], string> = { BATCH: '주간 배치', ADMIN: '수동' }

const PAGE_SIZE = 30
const fmt = (iso: string | null | undefined) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—')
const durationOf = (l: SchoolSyncLog) =>
  l.finishedAt ? `${Math.max(0, Math.round((new Date(l.finishedAt).getTime() - new Date(l.startedAt).getTime()) / 1000))}초` : '—'

function pageNumbers(current: number, count: number): number[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const set = new Set([1, count, current - 1, current, current + 1].filter((n) => n >= 1 && n <= count))
  const out: number[] = []
  let prev = 0
  for (const n of Array.from(set).sort((a, b) => a - b)) {
    if (n - prev > 1) out.push(0)
    out.push(n)
    prev = n
  }
  return out
}

/**
 * 학교 관리 (2026-09-14 · AI-314) — NEIS 학교기본정보를 우리 DB 에 적재한 결과를 보고, 최신화한다.
 *
 * 불변 규칙: 삭제 버튼 없음 · 동기화는 추가/변경만 하고 응답에서 사라진 학교는 "폐교" 상태로만 바꾼다 ·
 * NEIS 코드는 갱신되지 않고 유저는 우리 id 로 연결된다 (코드가 바뀌면 옛 행 폐교 + 새 행 추가, 사람이 본다).
 * 화면: 동기화 상태 카드 + 최신화 버튼 → 동기화 이력 → 학교 목록(검색·학교급·시도·유형·상태 필터 · 가입 회원 수) → 행 클릭 상세
 */
export default function SchoolsPage() {
  const [status, setStatus] = useState<SchoolSyncStatus | null>(null)
  const [schools, setSchools] = useState<AdminSchool[]>([])
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const load = () => {
    setState('loading')
    Promise.all([fetchSchoolSyncStatus(), fetchAdminSchools()])
      .then(([s, list]) => {
        setStatus(s)
        setSchools(list)
        setState('done')
      })
      .catch(() => setState('error'))
  }
  useEffect(load, [])

  // 최신화 확인 — 네이티브 confirm 대신 인라인 다이얼로그 (토스트·팝업 규칙)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const sync = async () => {
    if (syncing) return
    setConfirmOpen(false)
    setSyncing(true)
    setSyncMessage(null)
    try {
      const s = await runSchoolSync()
      setStatus(s)
      const last = s.last
      setSyncMessage(
        last
          ? `${RESULT_LABEL[last.result]} · 수신 ${last.fetched.toLocaleString()} · 추가 ${last.added} · 변경 ${last.updated} · 폐교 ${last.closed}${last.errorMessage ? ` · ${last.errorMessage}` : ''}`
          : '완료',
      )
      setSchools(await fetchAdminSchools())
    } catch (e) {
      setSyncMessage((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '동기화 요청에 실패했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  // ---- 목록 필터 ----
  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<'all' | 'MIDDLE' | 'HIGH'>('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const [highTypeFilter, setHighTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'CLOSED'>('ACTIVE')
  const [withMembers, setWithMembers] = useState(false)
  const [sort, setSort] = useState<'members' | 'name'>('members')
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [query, gradeFilter, regionFilter, highTypeFilter, statusFilter, withMembers, sort])

  const regions = useMemo(() => Array.from(new Set(schools.map((s) => s.region).filter((r): r is string => !!r))).sort(), [schools])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = schools.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q)) &&
        (gradeFilter === 'all' || s.grade === gradeFilter) &&
        (regionFilter === 'all' || s.region === regionFilter) &&
        (highTypeFilter === 'all' || s.highType === highTypeFilter) &&
        (statusFilter === 'all' || s.status === statusFilter) &&
        (!withMembers || s.userCount > 0),
    )
    return rows.sort((a, b) => (sort === 'members' ? b.userCount - a.userCount || a.name.localeCompare(b.name, 'ko') : a.name.localeCompare(b.name, 'ko')))
  }, [schools, query, gradeFilter, regionFilter, highTypeFilter, statusFilter, withMembers, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const rangeFrom = filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(current * PAGE_SIZE, filtered.length)
  const membersTotal = useMemo(() => schools.reduce((n, s) => n + s.userCount, 0), [schools])

  // ---- 상세 ----
  const [detail, setDetail] = useState<AdminSchoolDetail | null>(null)
  const openDetail = (id: number) => {
    fetchAdminSchool(id).then(setDetail).catch(() => setDetail(null))
  }

  const n = (v: number | undefined) => (state === 'done' && v != null ? v.toLocaleString() : '—')
  const last = status?.last ?? null

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>학교 관리</h2>
          <p className="page-sub">
            NEIS 학교기본정보(중·고) 를 우리 DB 에 적재해 가입·프로필 학교 검색에 씁니다 · 매주 월 04:30 자동 동기화 · 삭제 없음, 사라진 학교는 폐교 표시
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setConfirmOpen(true)} disabled={syncing || status?.running}>
          {syncing || status?.running ? '동기화 중…' : '지금 최신화'}
        </button>
      </div>

      <div className="kpi-problems kpi-funnel">
        <StatCard label="운영 중 학교" value={n(status?.totalActive)} delta={`고 ${n(status?.highActive)} · 중 ${n(status?.middleActive)} · 폐교 ${n(status?.totalClosed)}`} tone="flat" />
        <StatCard label="학교를 고른 회원" value={n(membersTotal)} delta="관계자 포함 · 학교당 회원 수의 합" tone="up" />
        <StatCard label="학교 미입력 회원" value={n(status?.unsetMembers)} delta="ACTIVE · 관계자 제외 · 홈 팝업 대상" tone={status && status.unsetMembers > 0 ? 'good' : 'flat'} />
        <StatCard
          label="마지막 동기화"
          value={last ? fmt(last.finishedAt ?? last.startedAt).slice(5) : '—'}
          delta={last ? `${RESULT_LABEL[last.result]} · ${TRIGGER_LABEL[last.triggeredBy]} · 추가 ${last.added} 변경 ${last.updated} 폐교 ${last.closed}` : '아직 동기화한 적 없음'}
          tone={last?.result === 'FAILED' ? 'up' : 'flat'}
        />
      </div>
      {syncMessage && <p className="page-sub" style={{ marginTop: -24, marginBottom: 24 }}>최신화 결과: {syncMessage}</p>}

      {/* 동기화 이력 */}
      <div className="card">
        <div className="card-head">
          <div>
            <p className="card-title">동기화 이력</p>
            <p className="card-sub">최근 20회 · 주간 배치와 수동 최신화 모두 · 실패하면 사유가 남습니다</p>
          </div>
        </div>
        {state === 'done' && status && status.logs.length === 0 && <p className="page-sub">이력이 없습니다. 오른쪽 위 "지금 최신화" 로 첫 적재를 하세요.</p>}
        {state === 'done' && status && status.logs.length > 0 && (
          <div className="table-wrap">
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>시작</th>
                  <th style={{ width: 80 }}>소요</th>
                  <th style={{ width: 90 }}>주체</th>
                  <th style={{ width: 150 }}>결과</th>
                  <th style={{ width: 90, textAlign: 'right' }}>수신</th>
                  <th style={{ width: 80, textAlign: 'right' }}>추가</th>
                  <th style={{ width: 80, textAlign: 'right' }}>변경</th>
                  <th style={{ width: 80, textAlign: 'right' }}>폐교</th>
                  <th>사유</th>
                </tr>
              </thead>
              <tbody>
                {status.logs.map((l) => (
                  <tr key={l.id}>
                    <td className="num">{fmt(l.startedAt)}</td>
                    <td className="num">{durationOf(l)}</td>
                    <td>{TRIGGER_LABEL[l.triggeredBy]}</td>
                    <td>
                      <span className={l.result === 'FAILED' ? 'badge danger' : l.result === 'SKIPPED_CLOSING' ? 'badge pending' : l.result === 'RUNNING' ? 'badge neutral' : 'badge live'}>
                        {RESULT_LABEL[l.result]}
                      </span>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.fetched.toLocaleString()}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.added.toLocaleString()}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.updated.toLocaleString()}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{l.closed.toLocaleString()}</td>
                    <td className="sub" title={l.errorMessage ?? undefined}>{l.errorMessage ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 학교 목록 */}
      <div className="card" style={{ padding: 18 }}>
        <div className="toolbar">
          <label className="search-box">
            <input type="search" placeholder="학교명 · 주소" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="학교 검색" />
          </label>
          <select className="select" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value as 'all' | 'MIDDLE' | 'HIGH')} aria-label="학교급">
            <option value="all">전체 학교급</option>
            <option value="MIDDLE">중학교</option>
            <option value="HIGH">고등학교</option>
          </select>
          <select className="select" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} aria-label="시도">
            <option value="all">전체 시도</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="select" value={highTypeFilter} onChange={(e) => setHighTypeFilter(e.target.value)} aria-label="고교 유형">
            <option value="all">전체 유형</option>
            {Object.entries(HIGH_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'ACTIVE' | 'CLOSED')} aria-label="상태">
            <option value="ACTIVE">운영 중</option>
            <option value="CLOSED">폐교</option>
            <option value="all">전체 상태</option>
          </select>
          <label className="check-box">
            <input type="checkbox" checked={withMembers} onChange={(e) => setWithMembers(e.target.checked)} />
            <span className="box" aria-hidden>
              <svg viewBox="0 0 11 9" fill="none"><path d="M1 4.5 4 7.5 10 1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            회원 있는 학교만
          </label>
          <div className="seg" role="group" aria-label="정렬">
            <button type="button" className={sort === 'members' ? 'on' : undefined} onClick={() => setSort('members')}>회원 많은순</button>
            <button type="button" className={sort === 'name' ? 'on' : undefined} onClick={() => setSort('name')}>이름순</button>
          </div>
          <div className="toolbar-pg">
            <span className="info">{filtered.length === 0 ? '0건' : `${rangeFrom}–${rangeTo} / ${filtered.length.toLocaleString()}건`}</span>
            {pageCount > 1 && (
              <div className="pages">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={current === 1} aria-label="이전">‹</button>
                {pageNumbers(current, pageCount).map((num, i) =>
                  num === 0 ? <span key={`gap-${i}`} className="info">…</span> : (
                    <button type="button" key={num} className={num === current ? 'on' : undefined} onClick={() => setPage(num)}>{num}</button>
                  ),
                )}
                <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={current === pageCount} aria-label="다음">›</button>
              </div>
            )}
          </div>
        </div>

        {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {state === 'error' && <p className="page-sub">학교 데이터를 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>}
        {state === 'done' && schools.length === 0 && <p className="page-sub">적재된 학교가 없습니다. "지금 최신화" 로 NEIS 에서 받아오세요.</p>}
        {state === 'done' && schools.length > 0 && filtered.length === 0 && <p className="page-sub">조건에 맞는 학교가 없습니다.</p>}
        {state === 'done' && pageRows.length > 0 && (
          <div className="table-wrap">
            <table style={{ minWidth: 1060 }}>
              <thead>
                <tr>
                  <th style={{ width: 200 }}>학교</th>
                  <th style={{ width: 90 }}>학교급</th>
                  <th style={{ width: 110 }}>시도</th>
                  <th>주소</th>
                  <th style={{ width: 90 }}>유형</th>
                  <th style={{ width: 70 }}>설립</th>
                  <th style={{ width: 90 }}>성별</th>
                  <th style={{ width: 108, textAlign: 'center' }}>상태</th>
                  <th style={{ width: 90, textAlign: 'right' }}>회원</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <tr key={s.id} className="visit-row" onClick={() => openDetail(s.id)} title="누르면 이 학교를 고른 회원 목록">
                    <td className="strong" title={`${s.eduOfficeCode}-${s.schoolCode}`}>
                      {s.name}
                      <span className="sub">{s.eduOfficeCode}-{s.schoolCode}</span>
                    </td>
                    <td>{GRADE_LABEL[s.grade]}</td>
                    <td>{s.region ?? '—'}</td>
                    <td title={s.address ?? undefined}>{s.address ?? '—'}</td>
                    <td>{s.highType ? HIGH_TYPE_LABEL[s.highType] : '—'}</td>
                    <td>{s.foundation ? FOUNDATION_LABEL[s.foundation] : '—'}</td>
                    <td>{s.genderType ? GENDER_LABEL[s.genderType] : '—'}</td>
                    <td style={{ textAlign: 'center', overflow: 'visible', textOverflow: 'clip' }}>
                      <span className={s.status === 'ACTIVE' ? 'badge live' : 'badge neutral'}>{s.status === 'ACTIVE' ? '운영 중' : '폐교'}</span>
                    </td>
                    <td className="num strong" style={{ textAlign: 'right' }}>{s.userCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="retention-note">코드 = 교육청코드-NEIS 학교코드. 동기화가 코드를 바꾸지 않고, 유저는 우리 id 로 연결되므로 NEIS 쪽 코드가 바뀌면 옛 행이 폐교로 남고 새 행이 추가됩니다.</p>
      </div>

      {confirmOpen && (
        <div className="visit-modal-dim" onClick={() => setConfirmOpen(false)}>
          <div role="alertdialog" aria-label="학교 최신화 확인" className="visit-modal card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="visit-modal-head">
              <div>
                <p className="card-title">NEIS 에서 학교 정보를 다시 받아올까요?</p>
                <p className="card-sub">추가·변경만 하고 삭제는 하지 않습니다. 응답에서 사라진 학교는 "폐교" 로만 표시됩니다. 보통 10초 안에 끝납니다.</p>
              </div>
            </div>
            <div className="visit-modal-body" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>취소</button>
              <button type="button" className="btn btn-primary" onClick={sync}>최신화</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="visit-modal-dim" onClick={() => setDetail(null)}>
          <div role="dialog" aria-label={`${detail.school.name} 상세`} className="visit-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="visit-modal-head">
              <div>
                <p className="card-title">{detail.school.name}</p>
                <p className="card-sub">
                  {[GRADE_LABEL[detail.school.grade], detail.school.region, detail.school.highType ? HIGH_TYPE_LABEL[detail.school.highType] : null, detail.school.address].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>닫기</button>
            </div>
            <div className="visit-modal-body">
              <p className="page-sub" style={{ marginBottom: 10 }}>
                코드 {detail.school.eduOfficeCode}-{detail.school.schoolCode} · NEIS 갱신 {detail.school.neisUpdatedAt ?? '—'} · 회원 {detail.members.length}명
              </p>
              {detail.members.length === 0 ? (
                <p className="page-sub">이 학교를 고른 회원이 아직 없습니다.</p>
              ) : (
                <div className="table-wrap">
                  <table style={{ minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>ID</th>
                        <th>닉네임</th>
                        <th>이름</th>
                        <th style={{ width: 80 }}>학년</th>
                        <th style={{ width: 100 }}>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.members.map((m) => (
                        <tr key={m.id}>
                          <td className="num">{m.id}</td>
                          <td className="strong">{m.nickname ?? '—'}{m.staff && <span className="sub">관계자</span>}</td>
                          <td>{m.name ?? '—'}</td>
                          <td>{m.grade ?? '—'}</td>
                          <td>{m.status ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

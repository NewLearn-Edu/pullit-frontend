import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fetchAcquisitionFunnelDaily, fetchVisitTimes, type AcquisitionFunnelDailyRow } from '../api/adminApi'
import { StatCard } from '../components/StatCard'

/** 비율 표기 — 분모 0 이면 "—" */
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—')

/**
 * 퍼널 단계 정의 — 표 열 순서와 같다. 경로 단계는 헤더에 엔드포인트를 그대로 쓴다 (pre = 앞부분, label = 뒷부분).
 * 모든 % 의 분모는 "방문" 하나로 통일한다 (2026-09-09). 단계별 이탈(이전 단계 대비)은 셀 툴팁으로만 —
 * 분모가 열마다 달라지면 비교가 안 된다.
 */
const STEPS = [
  { key: 'trials', pre: '', label: '/trial', hint: '시작하기를 눌러 /trial 화면까지 간 방문' },
  { key: 'quiz0', pre: '/trial/quiz/*/', label: '0', hint: '맛보기 1번 문제 화면까지 간 방문' },
  { key: 'quiz1', pre: '/trial/quiz/*/', label: '1', hint: '맛보기 2번 문제 화면까지 간 방문' },
  { key: 'quiz2', pre: '/trial/quiz/*/', label: '2', hint: '맛보기 3번 문제 화면까지 간 방문' },
  { key: 'weakness', pre: '/trial/*/', label: 'weakness', hint: '맛보기 3문제를 끝내고 약점 결과 화면까지 간 방문 (로그인 여부 무관)' },
  { key: 'signup', pre: '', label: '/signup', hint: '가입 화면까지 간 방문' },
  { key: 'signupInfo', pre: '/signup/', label: 'info', hint: '소셜 로그인 후 추가 정보 화면까지 간 방문' },
  { key: 'members', pre: '', label: '회원가입', hint: '이 방문 이후 프로필까지 완료한 회원 · 기존 회원의 재로그인은 제외' },
  { key: 'completed', pre: '', label: '첫 세트 완료', hint: '그 회원 중 첫 학습 세트까지 끝냄' },
] as const

type StepKey = (typeof STEPS)[number]['key']
type FunnelCounts = Record<'visits' | StepKey, number>

/** 정렬 가능한 열 — 숫자 열은 값 내림차순, 퍼널 열은 건수 내림차순(동률이면 방문 대비 % 내림차순) */
type SortKey = 'today' | 'visits' | StepKey

/** 소재별 보기의 한 줄 — 소재(소스×미디엄×캠페인×소재) 합계 + 오늘 방문 */
interface ContentRow extends FunnelCounts {
  key: string
  utmSource: string
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  today: number
}

/** 날짜별 보기의 한 줄 */
interface DateRow extends FunnelCounts {
  date: string
}

const emptyCounts = (): FunnelCounts => ({
  visits: 0, trials: 0, quiz0: 0, quiz1: 0, quiz2: 0, weakness: 0, signup: 0, signupInfo: 0, members: 0, completed: 0,
})
const addCounts = (acc: FunnelCounts, r: FunnelCounts) => {
  acc.visits += r.visits
  for (const s of STEPS) acc[s.key] += r[s.key]
}
const contentKey = (r: Pick<AcquisitionFunnelDailyRow, 'utmSource' | 'utmMedium' | 'utmCampaign' | 'utmContent'>) =>
  `${r.utmSource}:${r.utmMedium ?? ''}:${r.utmCampaign ?? ''}:${r.utmContent ?? ''}`
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const fmtDate = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}`
const weekday = (d: string) => '일월화수목금토'[new Date(`${d}T00:00:00+09:00`).getDay()]

/**
 * 유입 · 퍼널 — visit_events 를 방문일×소재로 쪼갠 행(daily)을 받아 두 가지로 본다 (2026-09-10).
 * - 소재별: 캠페인으로 묶은 표. 캠페인 헤더 행 → 소재 행 → 소계. 소재 행을 누르면 그 소재의 날짜별로 내려간다
 * - 날짜별: 하루 한 줄. 캠페인·소재 셀렉트로 좁힐 수 있다
 * 기간 필터는 두 보기와 KPI 에 함께 걸린다. 합산은 전부 프론트 — 엔드포인트는 하나.
 * 방문 → /trial 진입 → 맛보기 완주 → 회원가입 → 첫 세트 완료 를 한 줄에서 왼쪽→오른쪽으로 읽는다.
 */
export default function VisitStatsPage() {
  const [daily, setDaily] = useState<AcquisitionFunnelDailyRow[]>([])
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [view, setView] = useState<'content' | 'date'>('content')
  // 기간 — 빈 값이면 그 쪽 경계 없음 (전체)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  // 날짜별 보기 필터 — 'all' 또는 캠페인명 / 소재 key
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [contentFilter, setContentFilter] = useState('all')
  // 소재별 보기 정렬 — 항상 내림차순(높은 값 먼저). 기본은 방문 수
  const [sort, setSort] = useState<SortKey>('visits')
  // 방문 시각 팝업 대상 (null = 닫힘)
  const [detail, setDetail] = useState<ContentRow | null>(null)

  const load = () => {
    setState('loading')
    fetchAcquisitionFunnelDaily()
      .then((list) => {
        setDaily(list)
        setState('done')
      })
      .catch(() => setState('error'))
  }
  useEffect(load, [])

  const today = todayKst()

  // 기간 안의 행만
  const inRange = useMemo(
    () => daily.filter((r) => (!from || r.date >= from) && (!to || r.date <= to)),
    [daily, from, to],
  )

  // 소재별 합계 (기간 적용) — 캠페인 묶음의 재료
  const contents = useMemo(() => {
    const map = new Map<string, ContentRow>()
    for (const r of inRange) {
      const key = contentKey(r)
      let row = map.get(key)
      if (!row) {
        row = { key, utmSource: r.utmSource, utmMedium: r.utmMedium, utmCampaign: r.utmCampaign, utmContent: r.utmContent, today: 0, ...emptyCounts() }
        map.set(key, row)
      }
      addCounts(row, r)
      if (r.date === today) row.today += r.visits
    }
    return [...map.values()]
  }, [inRange, today])

  // 캠페인 묶음 — 캠페인 방문 수 내림차순, 안에서는 선택한 열 기준 내림차순
  const groups = useMemo(() => {
    const rate = (n: number, d: number) => (d > 0 ? n / d : -1)
    const byCampaign = new Map<string, ContentRow[]>()
    for (const c of contents) {
      const name = c.utmCampaign ?? '(캠페인 없음)'
      byCampaign.set(name, [...(byCampaign.get(name) ?? []), c])
    }
    return [...byCampaign.entries()]
      .map(([name, rows]) => {
        const subtotal = { today: 0, ...emptyCounts() }
        for (const r of rows) {
          addCounts(subtotal, r)
          subtotal.today += r.today
        }
        rows.sort((a, b) => {
          const diff = b[sort] - a[sort]
          if (diff !== 0 || sort === 'visits' || sort === 'today') return diff || b.visits - a.visits
          return rate(b[sort], b.visits) - rate(a[sort], a.visits) // 퍼널 건수 동률 → 방문 대비 % 높은 쪽 먼저
        })
        return { name, rows, subtotal }
      })
      .sort((a, b) => b.subtotal.visits - a.subtotal.visits)
  }, [contents, sort])

  // 날짜별 보기 — 캠페인·소재 필터 적용 후 날짜로 합산 (최신 날짜 먼저)
  const dateRows = useMemo<DateRow[]>(() => {
    const map = new Map<string, DateRow>()
    for (const r of inRange) {
      if (campaignFilter !== 'all' && (r.utmCampaign ?? '(캠페인 없음)') !== campaignFilter) continue
      if (contentFilter !== 'all' && contentKey(r) !== contentFilter) continue
      let row = map.get(r.date)
      if (!row) {
        row = { date: r.date, ...emptyCounts() }
        map.set(r.date, row)
      }
      addCounts(row, r)
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [inRange, campaignFilter, contentFilter])

  // 셀렉트 옵션 — 캠페인은 기간 안 전체, 소재는 선택한 캠페인 안
  const campaignOptions = useMemo(() => groups.map((g) => g.name), [groups])
  const contentOptions = useMemo(
    () => contents.filter((c) => campaignFilter === 'all' || (c.utmCampaign ?? '(캠페인 없음)') === campaignFilter)
      .sort((a, b) => b.visits - a.visits),
    [contents, campaignFilter],
  )
  const selectedContent = contentFilter === 'all' ? null : contents.find((c) => c.key === contentFilter) ?? null

  // KPI — 보기와 무관하게 기간 전체 (날짜별 필터는 KPI 에 걸지 않는다)
  const total = useMemo(() => {
    const acc = { today: 0, ...emptyCounts() }
    for (const c of contents) {
      addCounts(acc, c)
      acc.today += c.today
    }
    return acc
  }, [contents])
  // 날짜별 보기 합계 행 (필터 적용)
  const dateTotal = useMemo(() => {
    const acc = emptyCounts()
    for (const r of dateRows) addCounts(acc, r)
    return acc
  }, [dateRows])

  const periodLabel = from || to ? `${from ? fmtDate(from) : '처음'} ~ ${to ? fmtDate(to) : '오늘'}` : '전체 기간'

  /** 소재 행 클릭 → 그 소재의 날짜별로 */
  const drillDown = (c: ContentRow) => {
    setCampaignFilter(c.utmCampaign ?? '(캠페인 없음)')
    setContentFilter(c.key)
    setView('date')
  }

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>유입 · 퍼널</h2>
          <p className="page-sub">
            방문이 어디까지 갔는지 소재별·날짜별로 · 모든 %는 방문 대비 · 같은 브라우저는 24시간 1회 집계
          </p>
        </div>
        <div className="funnel-period">
          <input
            type="date"
            className={from ? 'input-date has-value' : 'input-date'}
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="시작일"
          />
          <span className="funnel-period-dash" aria-hidden="true">~</span>
          <input
            type="date"
            className={to ? 'input-date has-value' : 'input-date'}
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            aria-label="종료일"
          />
          {(from || to) && (
            <button type="button" className="btn btn-ghost" onClick={() => { setFrom(''); setTo('') }}>
              전체 기간
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={load}>
            새로고침
          </button>
        </div>
      </div>

      <div className="kpi-problems kpi-funnel" style={{ marginBottom: 24 }}>
        <StatCard
          label="오늘 방문"
          value={state === 'done' ? total.today.toLocaleString() : '—'}
          delta="전 소재 합계"
          tone="up"
        />
        <StatCard
          label={from || to ? '기간 방문' : '누적 방문'}
          value={state === 'done' ? total.visits.toLocaleString() : '—'}
          delta={periodLabel}
          tone="good"
        />
        <StatCard
          label="/trial 진입률"
          value={state === 'done' ? pct(total.trials, total.visits) : '—'}
          delta={state === 'done' ? `방문 ${total.visits.toLocaleString()} 중 ${total.trials.toLocaleString()}` : '방문 대비'}
          tone="flat"
        />
        <StatCard
          label="가입률"
          value={state === 'done' ? pct(total.members, total.visits) : '—'}
          delta={state === 'done' ? `방문 ${total.visits.toLocaleString()} 중 ${total.members.toLocaleString()}` : '방문 대비'}
          tone="flat"
        />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="toolbar">
          <div className="seg" role="group" aria-label="보기">
            <button type="button" className={view === 'content' ? 'on' : undefined} onClick={() => setView('content')}>
              소재별
            </button>
            <button type="button" className={view === 'date' ? 'on' : undefined} onClick={() => setView('date')}>
              날짜별
            </button>
          </div>
          {view === 'date' && (
            <>
              <select
                className="select"
                value={campaignFilter}
                onChange={(e) => { setCampaignFilter(e.target.value); setContentFilter('all') }}
                aria-label="캠페인"
              >
                <option value="all">전체 캠페인</option>
                {campaignOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                className="select"
                value={contentFilter}
                onChange={(e) => setContentFilter(e.target.value)}
                aria-label="소재"
              >
                <option value="all">전체 소재</option>
                {contentOptions.map((c) => (
                  <option key={c.key} value={c.key}>{c.utmContent ?? '(소재 없음)'} · {c.utmSource}</option>
                ))}
              </select>
              {selectedContent && (
                <button type="button" className="btn btn-ghost" onClick={() => setDetail(selectedContent)}>
                  방문 시각 목록
                </button>
              )}
            </>
          )}
          <div className="spacer" />
          <p className="page-sub" style={{ margin: 0 }}>
            {view === 'content'
              ? '캠페인으로 묶음 · 열 이름을 누르면 그 열 기준 정렬 · 소재 행을 누르면 날짜별로'
              : `${periodLabel} · 하루 한 줄 · 열 이름에 마우스를 올리면 단계 설명`}
          </p>
        </div>

        {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {state === 'error' && (
          <p className="page-sub">유입 데이터를 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
        )}
        {state === 'done' && contents.length === 0 && (
          <p className="page-sub">
            {from || to
              ? '이 기간에는 유입 기록이 없습니다.'
              : '아직 유입 기록이 없습니다. utm_source 파라미터를 붙인 링크를 배포하면 여기에 집계됩니다.'}
          </p>
        )}

        {state === 'done' && contents.length > 0 && view === 'content' && (
          <div className="table-wrap">
            <table className="funnel-table by-content">
              <thead>
                <tr>
                  {/* 소스·미디엄·소재 — 폭을 고정하되(fixed layout 에서 auto 열은 0폭이 된다) 줄임표 대신 줄바꿈 (funnel-wrap) */}
                  <th style={{ width: 130 }}>소스</th>
                  <th style={{ width: 110 }}>미디엄</th>
                  <th style={{ width: 250 }}>소재</th>
                  <SortTh k="today" sort={sort} onSort={setSort} width={56}>오늘</SortTh>
                  <SortTh k="visits" sort={sort} onSort={setSort} width={70}>방문</SortTh>
                  {STEPS.map((s) => (
                    <SortTh key={s.key} k={s.key} sort={sort} onSort={setSort} width={s.pre ? 132 : 100} hint={s.hint} pre={s.pre}>
                      {s.label}
                    </SortTh>
                  ))}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.name}>
                  <tr className="funnel-group">
                    <td colSpan={3 + 2 + STEPS.length}>
                      <span className="funnel-group-name">{g.name}</span>
                      <span className="funnel-group-meta">소재 {g.rows.length}개 · 방문 {g.subtotal.visits.toLocaleString()}</span>
                    </td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.key} className="visit-row" onClick={() => drillDown(r)} title="누르면 이 소재의 날짜별 퍼널">
                      <td className="funnel-wrap">{r.utmSource}</td>
                      <td className="funnel-wrap">{r.utmMedium ?? '—'}</td>
                      <td className="strong funnel-wrap">{r.utmContent ?? '—'}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{r.today.toLocaleString()}</td>
                      <td className="num strong" style={{ textAlign: 'right' }}>{r.visits.toLocaleString()}</td>
                      {STEPS.map((s, i) => (
                        <FunnelCell key={s.key} row={r} step={s.key} prev={i === 0 ? 'visits' : STEPS[i - 1].key} />
                      ))}
                    </tr>
                  ))}
                  {g.rows.length > 1 && (
                    <tr className="funnel-subtotal">
                      <td className="strong" colSpan={3}>소계</td>
                      <td className="num" style={{ textAlign: 'right' }}>{g.subtotal.today.toLocaleString()}</td>
                      <td className="num strong" style={{ textAlign: 'right' }}>{g.subtotal.visits.toLocaleString()}</td>
                      {STEPS.map((s, i) => (
                        <FunnelCell key={s.key} row={g.subtotal} step={s.key} prev={i === 0 ? 'visits' : STEPS[i - 1].key} />
                      ))}
                    </tr>
                  )}
                </tbody>
              ))}
              <tfoot>
                <tr className="funnel-total">
                  <td className="strong" colSpan={3}>합계</td>
                  <td className="num" style={{ textAlign: 'right' }}>{total.today.toLocaleString()}</td>
                  <td className="num strong" style={{ textAlign: 'right' }}>{total.visits.toLocaleString()}</td>
                  {STEPS.map((s, i) => (
                    <FunnelCell key={s.key} row={total} step={s.key} prev={i === 0 ? 'visits' : STEPS[i - 1].key} />
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {state === 'done' && contents.length > 0 && view === 'date' && (
          <div className="table-wrap">
            <table className="funnel-table by-date">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>날짜</th>
                  <th style={{ width: 80, textAlign: 'right' }}>방문</th>
                  {STEPS.map((s) => (
                    <th key={s.key} style={{ width: s.pre ? 132 : 100, textAlign: 'right' }} title={s.hint}>
                      {s.pre && <span className="sort-pre">{s.pre}</span>}{s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dateRows.length === 0 && (
                  <tr><td colSpan={2 + STEPS.length} className="page-sub" style={{ padding: 18 }}>이 조건에는 방문이 없습니다.</td></tr>
                )}
                {dateRows.map((r) => (
                  <tr key={r.date} className={r.date === today ? 'funnel-today' : undefined}>
                    <td className="strong num">
                      {r.date} <span className="funnel-weekday">({weekday(r.date)}){r.date === today ? ' 오늘' : ''}</span>
                    </td>
                    <td className="num strong" style={{ textAlign: 'right' }}>{r.visits.toLocaleString()}</td>
                    {STEPS.map((s, i) => (
                      <FunnelCell key={s.key} row={r} step={s.key} prev={i === 0 ? 'visits' : STEPS[i - 1].key} />
                    ))}
                  </tr>
                ))}
              </tbody>
              {dateRows.length > 0 && (
                <tfoot>
                  <tr className="funnel-total">
                    <td className="strong">합계</td>
                    <td className="num strong" style={{ textAlign: 'right' }}>{dateTotal.visits.toLocaleString()}</td>
                    {STEPS.map((s, i) => (
                      <FunnelCell key={s.key} row={dateTotal} step={s.key} prev={i === 0 ? 'visits' : STEPS[i - 1].key} />
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {detail && <VisitDetailModal target={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}

/** 정렬 헤더 — 클릭하면 그 열 기준 내림차순. 현재 정렬 열은 강조 + ↓ 표시. pre 는 엔드포인트 앞부분 */
function SortTh({
  k,
  sort,
  onSort,
  width,
  hint,
  pre,
  children,
}: {
  k: SortKey
  sort: SortKey
  onSort: (k: SortKey) => void
  width: number
  hint?: string
  pre?: string
  children: ReactNode
}) {
  const on = sort === k
  return (
    <th
      style={{ width, textAlign: 'right' }}
      className={on ? 'sort-th on' : 'sort-th'}
      title={hint ? `${hint} · 클릭하면 이 열 기준 정렬` : '클릭하면 이 열 기준 정렬'}
      aria-sort={on ? 'descending' : 'none'}
    >
      <button type="button" onClick={() => onSort(k)}>
        {/* 경로 접두(pre)는 한 줄로 이어 붙인다 — 헤더 줄바꿈 대신 표가 좌우 스크롤 (2026-09-09) */}
        <span className="sort-main">
          {pre && <span className="sort-pre">{pre}</span>}
          {children}
          <span className="sort-arrow" aria-hidden="true">↓</span>
        </span>
      </button>
    </th>
  )
}

/** 퍼널 셀 — 큰 숫자 + 방문 대비 % + 비율 막대. 이전 단계 대비 %는 툴팁으로만 */
function FunnelCell({ row, step, prev }: { row: FunnelCounts; step: StepKey; prev: 'visits' | StepKey }) {
  const n = row[step]
  const title = `방문 대비 ${pct(n, row.visits)} · 이전 단계 대비 ${pct(n, row[prev])}`
  const ratio = row.visits > 0 ? Math.min(1, n / row.visits) : 0
  return (
    <td className="num funnel-cell" style={{ textAlign: 'right' }} title={title}>
      <span className="funnel-n">{n.toLocaleString()}</span>
      <span className="funnel-pct">{pct(n, row.visits)}</span>
      <span className="funnel-bar" aria-hidden="true">
        <i style={{ width: `${ratio * 100}%` }} />
      </span>
    </td>
  )
}

/** 소재 1건의 개별 방문 시각 목록 팝업 — 날짜별로 묶어 최신순 표시 */
function VisitDetailModal({
  target,
  onClose,
}: {
  target: Pick<ContentRow, 'utmSource' | 'utmMedium' | 'utmCampaign' | 'utmContent'>
  onClose: () => void
}) {
  const [times, setTimes] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchVisitTimes(target.utmSource, target.utmMedium, target.utmCampaign, target.utmContent)
      .then((list) => alive && setTimes(list))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [target])

  // "2026-08-20" → 그 날짜의 "14:51" 목록 (응답이 최신순이라 그대로 쌓으면 된다)
  const byDate = useMemo(() => {
    const groups: { date: string; times: string[] }[] = []
    for (const iso of times ?? []) {
      const date = iso.slice(0, 10)
      const time = iso.slice(11, 16)
      const last = groups[groups.length - 1]
      if (last && last.date === date) last.times.push(time)
      else groups.push({ date, times: [time] })
    }
    return groups
  }, [times])

  const title = [target.utmSource, target.utmCampaign, target.utmContent].filter(Boolean).join(' · ')

  return createPortal(
    <div className="visit-modal-dim" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`${title} 방문 상세`}
        className="visit-modal card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="visit-modal-head">
          <div>
            <p className="card-title">{title}</p>
            <p className="card-sub">
              방문 시각 목록 · 최신순{times && times.length >= 500 ? ' (최근 500건)' : ''}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="visit-modal-body">
          {failed && <p className="page-sub">방문 기록을 불러오지 못했습니다.</p>}
          {!failed && times === null && <p className="page-sub">불러오는 중…</p>}
          {times !== null &&
            byDate.map((group) => (
              <div key={group.date} className="visit-day">
                <p className="visit-day-label num">
                  {group.date} <span>{group.times.length}회</span>
                </p>
                <div className="visit-times">
                  {group.times.map((time, i) => (
                    <span key={`${group.date}-${time}-${i}`} className="visit-time num">
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>,
    // 포털 대상도 .admin-root — 어드민 CSS 변수 스코프 유지 (CreditsPage 와 동일)
    document.querySelector('.admin-root') ?? document.body,
  )
}

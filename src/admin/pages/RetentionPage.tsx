import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { fetchRetention, type RetentionMetric, type RetentionResponse } from '../api/adminApi'
import { RetentionUsersModal, type RetentionCell } from '../components/RetentionUsersModal'
import { StatCard } from '../components/StatCard'

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—')
const weekday = (d: string) => '일월화수목금토'[new Date(`${d}T00:00:00+09:00`).getDay()]
const fmtDate = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}`

type Range = 7 | 14 | 30 | 60

/**
 * 리텐션 (2026-09-14) — "가입한 사람이 며칠 뒤에 돌아오나".
 *
 * 기준은 회원 현황 카드·리텐션 엑셀과 같다:
 *   가입 전체 → 관계자 제외 → 탈퇴 제외 → 가입 중 제외 → ACTIVE = 모든 % 의 분모
 *   학습일 = 온보딩 맛보기 말고 뭐라도 제출한 날(달력일·KST) · D{n} = 가입일 + n 일에 학습한 ACTIVE 비율
 *
 * 두 표를 위아래로 둔다:
 *   ① 가입일 코호트 — 세로로 비교한다. 9/09 가입자의 D1 과 9/13 가입자의 D1 이 다르면 그 사이 뭔가 바뀐 것.
 *      아직 그 날이 안 온 칸은 "—" (매일 오른쪽으로 한 칸씩 채워진다)
 *   ② 일별 활성 — 어제 대비 오늘. 학습자 중 "복귀"(그날 가입이 아닌 사람)가 리마인더 효과를 보는 칸
 *
 * 숫자 칸(0 제외)은 전부 누를 수 있다 (2026-09-28) — 그 칸에 든 회원이 누구인지 팝업으로 펼친다.
 */
export default function RetentionPage() {
  const [range, setRange] = useState<Range>(30)
  const [data, setData] = useState<RetentionResponse | null>(null)
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [cell, setCell] = useState<RetentionCell | null>(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    fetchRetention(range)
      .then((d) => {
        if (!alive) return
        setData(d)
        setState('done')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [range])

  // 일별 활성 — 오픈 전(학습이 한 번도 없던 날)은 표에서 접는다. 최근 쪽부터 마지막 학습일까지만
  const dailyRows = useMemo(() => {
    if (!data) return []
    const lastIdx = data.daily.map((d) => d.learners > 0 || d.wau > 0).lastIndexOf(true)
    return lastIdx < 0 ? data.daily.slice(0, 7) : data.daily.slice(0, lastIdx + 1)
  }, [data])

  // 셀 열기 — 표에 찍힌 숫자가 0 이거나 판정 불가(—)면 열 게 없으니 클릭도 막는다
  const drill = (metric: RetentionMetric, date: string | null, expected: number | null, offset?: number) =>
    expected == null || expected === 0
      ? undefined
      : () => setCell({ metric, date, offset, expected, days: range })

  const kpi = data?.kpi
  const n = (v: number | undefined) => (state === 'done' && v != null ? v.toLocaleString() : '—')
  const k = (v: number | undefined) => (state === 'done' && kpi && v != null ? pct(v, kpi.active) : '—')

  // 코호트 합계 — 계단은 단순 합, D{n} 은 "판정 가능한 코호트" 만 모아 합산 (아직인 칸은 분모에서도 뺀다)
  const cohortTotal = useMemo(() => {
    if (!data) return null
    const t = { signupAll: 0, staff: 0, deleted: 0, pending: 0, active: 0, day0Sets: 0 }
    const ret: { n: number; base: number }[] = data.offsets.map(() => ({ n: 0, base: 0 }))
    for (const c of data.cohorts) {
      t.signupAll += c.signupAll; t.staff += c.staff; t.deleted += c.deleted; t.pending += c.pending
      t.active += c.active; t.day0Sets += c.day0Sets
      c.retained.forEach((v, i) => {
        if (v != null) { ret[i].n += v; ret[i].base += c.active }
      })
    }
    return { ...t, ret }
  }, [data])

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>리텐션</h2>
        </div>
        <div className="funnel-period">
          {([7, 14, 30, 60] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={r === range ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              onClick={() => setRange(r)}
            >
              최근 {r}일
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-problems kpi-funnel">
        <StatCard label="ACTIVE 회원" value={n(kpi?.active)} delta="모든 비율의 분모" tone="flat" onOpen={drill('KPI_ACTIVE', null, kpi?.active ?? null)} />
        <StatCard label="재방문 (학습 2일 이상)" value={n(kpi?.returned)} delta={`ACTIVE 대비 ${k(kpi?.returned)} · 학습 1일 이상 ${n(kpi?.studied)}명`} tone="up" onOpen={drill('KPI_RETURNED', null, kpi?.returned ?? null)} />
        <StatCard label="이번 주 꾸준 (7일 중 3일+)" value={n(kpi?.steadyWeek)} delta={`ACTIVE 대비 ${k(kpi?.steadyWeek)}`} tone="good" onOpen={drill('KPI_STEADY', null, kpi?.steadyWeek ?? null)} />
        <StatCard label="이탈 중" value={n(kpi?.churned)} delta="학습한 적 있는데 최근 7일 0일 · 리마인더 대상" tone="flat" onOpen={drill('KPI_CHURNED', null, kpi?.churned ?? null)} />
      </div>

      {/* ① 가입일 코호트 */}
      <div className="card">
        <div className="card-head">
          <div>
            <p className="card-title">가입일 코호트</p>
          </div>
        </div>
        {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {state === 'error' && <p className="page-sub">리텐션 데이터를 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>}
        {state === 'done' && data && cohortTotal && (
          <div className="table-wrap">
            <table className="funnel-table retention-table">
              <thead>
                <tr>
                  <th style={{ width: 112 }}>가입일</th>
                  <th className="step" style={{ width: 66, textAlign: 'right' }}>가입<br />전체</th>
                  <th className="step" style={{ width: 58, textAlign: 'right' }}>관계자</th>
                  <th className="step" style={{ width: 52, textAlign: 'right' }}>탈퇴</th>
                  <th className="step" style={{ width: 58, textAlign: 'right' }}>가입 중</th>
                  <th className="step step-active" style={{ width: 70, textAlign: 'right' }}>ACTIVE</th>
                  <th style={{ width: 72, textAlign: 'right' }} title="가입 당일 세트를 1개 이상 끝까지 푼 사람">당일<br />완주</th>
                  {data.offsets.map((o) => (
                    <th key={o} style={{ width: 66, textAlign: 'right' }} title={`가입일 + ${o}일에 학습한 ACTIVE`}>D{o}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.length === 0 && (
                  <tr><td colSpan={7 + data.offsets.length} className="page-sub" style={{ padding: 18 }}>이 기간에 가입한 회원이 없습니다.</td></tr>
                )}
                {data.cohorts.map((c) => (
                  <tr key={c.date} className={c.date === data.today ? 'funnel-today' : undefined}>
                    <td className="strong num" title={c.date}>
                      {fmtDate(c.date)} <span className="funnel-weekday">({weekday(c.date)}){c.date === data.today ? ' 오늘' : ''}</span>
                    </td>
                    <StepCell n={c.signupAll} cls="step" onOpen={drill('SIGNUP_ALL', c.date, c.signupAll)} />
                    <StepCell n={c.staff} cls="step" dim onOpen={drill('STAFF', c.date, c.staff)} />
                    <StepCell n={c.deleted} cls="step" dim onOpen={drill('DELETED', c.date, c.deleted)} />
                    <StepCell n={c.pending} cls="step" dim onOpen={drill('PENDING', c.date, c.pending)} />
                    <StepCell n={c.active} cls="step step-active" onOpen={drill('ACTIVE', c.date, c.active)} />
                    <RetentionCell n={c.day0Sets} base={c.active} onOpen={drill('DAY0_SET', c.date, c.day0Sets)} />
                    {c.retained.map((v, i) => (
                      <RetentionCell
                        key={data.offsets[i]}
                        n={v}
                        base={c.active}
                        onOpen={drill('RETAINED', c.date, v, data.offsets[i])}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
              {data.cohorts.length > 0 && (
                <tfoot>
                  <tr className="funnel-total">
                    <td className="strong">합계</td>
                    <StepCell n={cohortTotal.signupAll} cls="strong step" onOpen={drill('SIGNUP_ALL', null, cohortTotal.signupAll)} />
                    <StepCell n={cohortTotal.staff} cls="step" onOpen={drill('STAFF', null, cohortTotal.staff)} />
                    <StepCell n={cohortTotal.deleted} cls="step" onOpen={drill('DELETED', null, cohortTotal.deleted)} />
                    <StepCell n={cohortTotal.pending} cls="step" onOpen={drill('PENDING', null, cohortTotal.pending)} />
                    <StepCell n={cohortTotal.active} cls="strong step step-active" onOpen={drill('ACTIVE', null, cohortTotal.active)} />
                    <RetentionCell n={cohortTotal.day0Sets} base={cohortTotal.active} onOpen={drill('DAY0_SET', null, cohortTotal.day0Sets)} />
                    {cohortTotal.ret.map((r, i) => (
                      <RetentionCell
                        key={data.offsets[i]}
                        n={r.base > 0 ? r.n : null}
                        base={r.base}
                        onOpen={drill('RETAINED', null, r.base > 0 ? r.n : null, data.offsets[i])}
                      />
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ② 일별 활성 */}
      <div className="card">
        <div className="card-head">
          <div>
            <p className="card-title">일별 활성</p>
          </div>
        </div>
        {state === 'done' && data && (
          <div className="table-wrap">
            <table className="funnel-table retention-daily">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>날짜</th>
                  <th style={{ width: 110, textAlign: 'right' }}>학습 유저 (DAU)</th>
                  <th style={{ width: 100, textAlign: 'right' }}>신규</th>
                  <th style={{ width: 100, textAlign: 'right' }}>복귀</th>
                  <th style={{ width: 120, textAlign: 'right' }}>복귀 비율</th>
                  <th style={{ width: 100, textAlign: 'right' }}>WAU</th>
                  <th style={{ width: 100, textAlign: 'right' }} title="DAU ÷ WAU · 주간 유저가 하루에 얼마나 오나">DAU/WAU</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((d) => (
                  <tr key={d.date} className={d.date === data.today ? 'funnel-today' : undefined}>
                    <td className="strong num" title={d.date}>
                      {fmtDate(d.date)} <span className="funnel-weekday">({weekday(d.date)}){d.date === data.today ? ' 오늘' : ''}</span>
                    </td>
                    <StepCell n={d.learners} cls="strong" onOpen={drill('DAILY_LEARNER', d.date, d.learners)} />
                    <StepCell n={d.newLearners} onOpen={drill('DAILY_NEW', d.date, d.newLearners)} />
                    <StepCell
                      n={d.returning}
                      cls="strong"
                      color={d.returning > 0 ? 'var(--green-text)' : undefined}
                      onOpen={drill('DAILY_RETURNING', d.date, d.returning)}
                    />
                    <td className="num" style={{ textAlign: 'right' }}>{pct(d.returning, d.learners)}</td>
                    <StepCell n={d.wau} onOpen={drill('DAILY_WAU', d.date, d.wau)} />
                    <td className="num" style={{ textAlign: 'right' }}>{pct(d.learners, d.wau)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cell && <RetentionUsersModal cell={cell} onClose={() => setCell(null)} />}
    </>
  )
}

/** 누르면 회원 목록이 열리는 셀에 공통으로 붙는 속성 — onOpen 이 없으면(0·판정 불가) 아무 일도 안 한다 */
function drillProps(onOpen?: () => void) {
  if (!onOpen) return {}
  return {
    onClick: onOpen,
    role: 'button' as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen()
      }
    },
  }
}

/** 계단·일별 활성의 숫자 셀. dim = 0 일 때 옅게 (관계자·탈퇴처럼 보통 0 인 칸) */
function StepCell({
  n, cls, dim, color, onOpen,
}: { n: number; cls?: string; dim?: boolean; color?: string; onOpen?: () => void }) {
  return (
    <td
      className={['num', cls, onOpen && 'rt-drill'].filter(Boolean).join(' ')}
      style={{ textAlign: 'right', color }}
      title={onOpen ? '누르면 이 칸의 회원 목록' : undefined}
      {...drillProps(onOpen)}
    >
      {dim && n === 0 ? <span className="sub">0</span> : n}
    </td>
  )
}

/** 코호트 셀 — 인원 + ACTIVE 대비 % + 막대. 아직 판정 불가(null)면 "—" */
function RetentionCell({ n, base, onOpen }: { n: number | null; base: number; onOpen?: () => void }) {
  if (n == null) {
    return <td className="num retention-cell retention-wait" style={{ textAlign: 'right' }} title="아직 그 날이 안 왔음">—</td>
  }
  const ratio = base > 0 ? Math.min(1, n / base) : 0
  return (
    <td
      className={['num', 'retention-cell', onOpen && 'rt-drill'].filter(Boolean).join(' ')}
      style={{ textAlign: 'right' }}
      title={`ACTIVE ${base}명 중 ${n}명${onOpen ? ' · 누르면 회원 목록' : ''}`}
      {...drillProps(onOpen)}
    >
      <span className="funnel-n">{n}</span>
      <span className="funnel-pct">{pct(n, base)}</span>
      <span className="funnel-bar" aria-hidden="true">
        <i style={{ width: `${ratio * 100}%` }} />
      </span>
    </td>
  )
}

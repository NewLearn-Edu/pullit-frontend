import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fetchAcquisitionFunnel, fetchVisitTimes, type AcquisitionFunnelRow } from '../api/adminApi'
import { StatCard } from '../components/StatCard'

/** 비율 표기 — 분모 0 이면 "—" */
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—')

/**
 * 퍼널 단계 정의 — 표 열 순서와 같다. 경로 단계는 헤더에 엔드포인트를 그대로 쓴다 (pre = 윗줄, label = 아랫줄).
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

/** 정렬 가능한 열 — 숫자 열은 값 내림차순, 퍼널 열은 건수 내림차순(동률이면 방문 대비 % 내림차순) */
type SortKey = 'today' | 'visits' | StepKey

/**
 * 유입 · 퍼널 — 소재(utm_content) 단위 한 표. visit_events 한 테이블 기준.
 * 방문 → /trial 진입 → 맛보기 완주 → 회원가입 → 첫 세트 완료 를 한 줄에서 왼쪽→오른쪽으로 읽는다.
 * 예전엔 "유입 링크(캠페인 단위)"와 "캠페인 퍼널(소재 단위)" 두 표였는데 줄이 서로 대응되지 않아 합쳤다 (2026-09-09).
 */
export default function VisitStatsPage() {
  const [rows, setRows] = useState<AcquisitionFunnelRow[]>([])
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  // 헤더 클릭으로 정렬 열 선택 — 항상 내림차순(높은 값 먼저). 기본은 방문 수
  const [sort, setSort] = useState<SortKey>('visits')
  // 상세 팝업 대상 소재 (null = 닫힘)
  const [detail, setDetail] = useState<AcquisitionFunnelRow | null>(null)

  const load = () => {
    setState('loading')
    fetchAcquisitionFunnel()
      .then((list) => {
        setRows(list)
        setState('done')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])

  const sorted = useMemo(() => {
    const copy = [...rows]
    const rate = (n: number, d: number) => (d > 0 ? n / d : -1)
    copy.sort((a, b) => {
      const diff = b[sort] - a[sort]
      if (diff !== 0 || sort === 'visits' || sort === 'today') return diff || b.visits - a.visits
      return rate(b[sort], b.visits) - rate(a[sort], a.visits) // 퍼널 건수 동률 → 방문 대비 % 높은 쪽 먼저
    })
    return copy
  }, [rows, sort])

  const total = useMemo(() => {
    const acc: FunnelCounts & { today: number } = {
      visits: 0, today: 0, trials: 0, quiz0: 0, quiz1: 0, quiz2: 0, weakness: 0, signup: 0, signupInfo: 0, members: 0, completed: 0,
    }
    for (const r of rows) {
      acc.visits += r.visits
      acc.today += r.today
      for (const s of STEPS) acc[s.key] += r[s.key]
    }
    return acc
  }, [rows])

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>유입 · 퍼널</h2>
          <p className="page-sub">
            소재(utm_content)별로 방문이 어디까지 갔는지 · 모든 %는 방문 대비 · 같은 브라우저는 24시간 1회 집계
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load}>
          새로고침
        </button>
      </div>

      <div className="kpi-problems kpi-funnel" style={{ marginBottom: 24 }}>
        <StatCard
          label="오늘 방문"
          value={state === 'done' ? total.today.toLocaleString() : '—'}
          delta="전 소재 합계"
          tone="up"
        />
        <StatCard
          label="누적 방문"
          value={state === 'done' ? total.visits.toLocaleString() : '—'}
          delta="집계 시작 이후"
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
          <p className="page-sub" style={{ margin: 0 }}>
            열 이름을 누르면 그 열 기준 높은 순으로 정렬 · 열 이름에 마우스를 올리면 단계 설명
          </p>
        </div>

        {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
        {state === 'error' && (
          <p className="page-sub">유입 데이터를 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
        )}
        {state === 'done' && rows.length === 0 && (
          <p className="page-sub">
            아직 유입 기록이 없습니다. utm_source 파라미터를 붙인 링크를 배포하면 여기에 집계됩니다.
          </p>
        )}

        {state === 'done' && sorted.length > 0 && (
          <div className="table-wrap">
            <table className="funnel-table">
              <thead>
                <tr>
                  <th style={{ width: 92 }}>소스</th>
                  <th style={{ width: 70 }}>미디엄</th>
                  <th style={{ width: 190 }}>캠페인</th>
                  {/* 소재도 폭 고정 — 유일한 auto 열이면 좁은 화면에서 0폭이 되어 글자가 세로로 쏟아진다 (fixed layout) */}
                  <th style={{ width: 200 }}>소재</th>
                  <SortTh k="today" sort={sort} onSort={setSort} width={56}>오늘</SortTh>
                  <SortTh k="visits" sort={sort} onSort={setSort} width={70}>방문</SortTh>
                  {STEPS.map((s) => (
                    <SortTh key={s.key} k={s.key} sort={sort} onSort={setSort} width={s.pre ? 132 : 100} hint={s.hint} pre={s.pre}>
                      {s.label}
                    </SortTh>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr
                    key={`${r.utmSource}:${r.utmMedium ?? ''}:${r.utmCampaign ?? ''}:${r.utmContent ?? ''}`}
                    className="visit-row"
                    onClick={() => setDetail(r)}
                  >
                    <td>{r.utmSource}</td>
                    <td>{r.utmMedium ?? '—'}</td>
                    <td className="funnel-wrap">{r.utmCampaign ?? '—'}</td>
                    <td className="strong funnel-wrap">{r.utmContent ?? '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{r.today.toLocaleString()}</td>
                    <td className="num strong" style={{ textAlign: 'right' }}>{r.visits.toLocaleString()}</td>
                    {STEPS.map((s, i) => (
                      <FunnelCell key={s.key} row={r} step={s.key} prev={i === 0 ? 'visits' : STEPS[i - 1].key} />
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="funnel-total">
                  <td className="strong" colSpan={4}>합계</td>
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

      </div>

      {detail && <VisitDetailModal target={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}

/** 정렬 헤더 — 클릭하면 그 열 기준 내림차순. 현재 정렬 열은 강조 + ↓ 표시. pre 는 엔드포인트 앞부분(윗줄 작은 글씨) */
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

type FunnelCounts = Pick<AcquisitionFunnelRow, 'visits' | StepKey>

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
  target: AcquisitionFunnelRow
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

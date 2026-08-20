import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchVisitStats, fetchVisitTimes, type VisitCampaignStats } from '../api/adminApi'
import { StatCard } from '../components/StatCard'

/** "2026-08-20T14:51:36" → "2026-08-20 14:51" */
const fmtDateTime = (iso: string) => iso.slice(0, 16).replace('T', ' ')

type SortKey = 'recent' | 'total' | 'today'

/**
 * 유입 링크 통계 — UTM 캠페인별 방문 집계 (visit_events).
 * 마케팅 링크(?utm_source=...&utm_campaign=...)와 얼리버드 직접 방문(earlybird·direct)이
 * 소스×캠페인 단위로 쌓인다. 같은 브라우저는 24시간 1회만 집계.
 */
export default function VisitStatsPage() {
  const [rows, setRows] = useState<VisitCampaignStats[]>([])
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')
  const [sort, setSort] = useState<SortKey>('recent')
  // 상세 팝업 대상 캠페인 (null = 닫힘)
  const [detail, setDetail] = useState<VisitCampaignStats | null>(null)

  const load = () => {
    setState('loading')
    fetchVisitStats()
      .then((list) => {
        setRows(list)
        setState('done')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [])

  const sorted = useMemo(() => {
    const copy = [...rows]
    if (sort === 'total') copy.sort((a, b) => b.total - a.total)
    if (sort === 'today') copy.sort((a, b) => b.today - a.today)
    return copy // 'recent' 는 서버 정렬(마지막 방문 순) 그대로
  }, [rows, sort])

  const totalVisits = rows.reduce((s, r) => s + r.total, 0)
  const todayVisits = rows.reduce((s, r) => s + r.today, 0)

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>유입 링크</h2>
          <p className="page-sub">
            utm_source·utm_campaign 별 방문 수 · 같은 브라우저는 24시간 1회 집계
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load}>
          새로고침
        </button>
      </div>

      <div className="kpi-problems" style={{ marginBottom: 24 }}>
        <StatCard
          label="오늘 방문"
          value={state === 'done' ? todayVisits.toLocaleString() : '—'}
          delta="전 캠페인 합계"
          tone="up"
        />
        <StatCard
          label="누적 방문"
          value={state === 'done' ? totalVisits.toLocaleString() : '—'}
          delta="집계 시작 이후"
          tone="good"
        />
        <StatCard
          label="캠페인 수"
          value={state === 'done' ? rows.length.toLocaleString() : '—'}
          delta="소스 × 캠페인 조합 기준"
          tone="flat"
        />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="toolbar">
          <div className="seg">
            <button className={sort === 'recent' ? 'on' : undefined} onClick={() => setSort('recent')}>
              최근 방문순
            </button>
            <button className={sort === 'total' ? 'on' : undefined} onClick={() => setSort('total')}>
              누적순
            </button>
            <button className={sort === 'today' ? 'on' : undefined} onClick={() => setSort('today')}>
              오늘순
            </button>
          </div>
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
            <table>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>소스</th>
                  <th style={{ width: 140 }}>미디엄</th>
                  <th>캠페인</th>
                  <th style={{ width: 110, textAlign: 'right' }}>오늘</th>
                  <th style={{ width: 110, textAlign: 'right' }}>누적</th>
                  <th style={{ width: 170 }}>마지막 방문</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((v) => (
                  <tr
                    key={`${v.utmSource}:${v.utmMedium ?? ''}:${v.utmCampaign ?? ''}`}
                    className="visit-row"
                    onClick={() => setDetail(v)}
                  >
                    <td className="strong">{v.utmSource}</td>
                    <td>{v.utmMedium ?? '—'}</td>
                    <td>{v.utmCampaign ?? '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{v.today.toLocaleString()}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{v.total.toLocaleString()}</td>
                    <td className="num">{fmtDateTime(v.lastVisitAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && <VisitDetailModal target={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}

/** 캠페인 1건의 개별 방문 시각 목록 팝업 — 날짜별로 묶어 최신순 표시 */
function VisitDetailModal({
  target,
  onClose,
}: {
  target: VisitCampaignStats
  onClose: () => void
}) {
  const [times, setTimes] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchVisitTimes(target.utmSource, target.utmMedium, target.utmCampaign)
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

  const title = [target.utmSource, target.utmCampaign].filter(Boolean).join(' · ')

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

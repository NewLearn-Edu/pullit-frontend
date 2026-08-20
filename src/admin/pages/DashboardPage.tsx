import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from '../components/StatCard'
import {
  fetchDashboardStats,
  fetchVisitStats,
  type DailyActivity,
  type DashboardStats,
  type VisitCampaignStats,
} from '../api/adminApi'

/** 숫자 표시 · 로딩 중엔 — */
const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString())

/** 어제 대비 증감 문구 — 증가 그린 ▲ / 감소 레드 ▼ / 동일 muted */
function dayDelta(today: number | undefined, yesterday: number | undefined) {
  if (today == null || yesterday == null) return { text: '어제 대비 —', tone: 'flat' as const }
  const diff = today - yesterday
  if (diff > 0) return { text: `▲ 어제보다 +${diff.toLocaleString()}`, tone: 'good' as const }
  if (diff < 0) return { text: `▼ 어제보다 ${diff.toLocaleString()}`, tone: 'up' as const }
  return { text: '어제와 동일', tone: 'flat' as const }
}

const pct = (numerator: number, denominator: number) =>
  denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : '—'

/** 'YYYY-MM-DD' → 'MM.DD' */
const shortDate = (iso: string) => iso.slice(5).replace('-', '.')

// ---------------------------------------------------------------------------
// 학습 활동 추이 차트 — 풀린 문제(primary) · 학습 유저(accent) 2선
// 색은 전부 CSS 변수 → 다크모드 자동 대응
// compact(모바일)에선 viewBox 를 줄여 같은 폰트 크기가 상대적으로 크게 렌더되도록 한다
// ---------------------------------------------------------------------------

/** 모바일 판별 — 어드민은 800px 미만에서 rail/sidebar 가 사라지는 단일 컬럼 레이아웃 */
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 800px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)')
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function TrendChart({ data, compact }: { data: DailyActivity[]; compact: boolean }) {
  const W = compact ? 480 : 1000
  const H = compact ? 270 : 250
  const PAD_L = compact ? 34 : 46
  const PAD_R = compact ? 12 : 18
  const PAD_T = 14
  const PAD_B = 30

  const { yMax, xLabels, solvedPath, solvedArea, learnersPath, points } = useMemo(() => {
    const rawMax = Math.max(4, ...data.map((d) => Math.max(d.solved, d.learners)))
    const yMax = Math.ceil(rawMax / 4) * 4

    const innerW = W - PAD_L - PAD_R
    const innerH = H - PAD_T - PAD_B
    const x = (i: number) => PAD_L + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
    const y = (v: number) => PAD_T + innerH - (v / yMax) * innerH

    const toPath = (key: 'solved' | 'learners') =>
      data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')

    const solvedPath = toPath('solved')
    const solvedArea = `${solvedPath} L${x(data.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`

    // x 라벨 겹침 방지 — 데스크톱 7개 · 모바일 4개 내외
    const step = Math.max(1, Math.ceil(data.length / (compact ? 4 : 7)))
    const xLabels = data
      .map((d, i) => ({
        label: shortDate(d.date),
        x: x(i),
        // 마지막 라벨은 항상 표시하되, 그 직전 step 라벨과 겹치지 않게 간격 확보
        show: i === data.length - 1 || (i % step === 0 && data.length - 1 - i >= step / 2),
      }))
      .filter((l) => l.show)

    // 점은 14개 이하일 때만 (30일 뷰에선 선만)
    const points =
      data.length <= 14
        ? data.map((d, i) => ({ x: x(i), ySolved: y(d.solved), yLearners: y(d.learners), last: i === data.length - 1 }))
        : []

    return { yMax, xLabels, solvedPath, solvedArea, learnersPath: toPath('learners'), points }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, compact])

  const gridYs = [0, 1, 2, 3, 4].map((i) => PAD_T + ((H - PAD_T - PAD_B) / 4) * i)

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <g className="grid" strokeWidth="1">
          {gridYs.map((gy) => (
            <line key={gy} x1={PAD_L} y1={gy} x2={W - PAD_R} y2={gy} />
          ))}
        </g>
        <g className="lbl" fontSize="10.5" textAnchor="end">
          {gridYs.map((gy, i) => (
            <text key={gy} x={PAD_L - 8} y={gy + 4} className="num">
              {Math.round(yMax - (yMax / 4) * i)}
            </text>
          ))}
        </g>
        <g className="lbl" fontSize="11" textAnchor="middle">
          {xLabels.map((l) => (
            <text key={l.label + l.x} x={l.x} y={H - 10} className="num">
              {l.label}
            </text>
          ))}
        </g>
        <defs>
          <linearGradient id="dashGradSolved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-primary)" stopOpacity=".14" />
            <stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={solvedArea} fill="url(#dashGradSolved)" />
        <path
          d={solvedPath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={learnersPath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g fill="var(--color-primary)">
          {points.map((p) => (
            <circle key={`s${p.x}`} cx={p.x} cy={p.ySolved} r={p.last ? 4.5 : 3.5} stroke={p.last ? 'var(--color-canvas)' : undefined} strokeWidth={p.last ? 2 : undefined} />
          ))}
        </g>
        <g fill="var(--color-accent)">
          {points.map((p) => (
            <circle key={`l${p.x}`} cx={p.x} cy={p.yLearners} r="3" />
          ))}
        </g>
      </svg>
      <div className="chart-legend">
        <span><i style={{ background: 'var(--color-primary)' }} />풀린 문제</span>
        <span><i style={{ background: 'var(--color-accent)' }} />학습 유저</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 대시보드 — 전체 현황만 (세부 통계는 문제 통계 · 유저 통계 페이지로 분리 예정)
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const navigate = useNavigate()
  const narrow = useIsNarrow()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [range, setRange] = useState<14 | 30>(14)
  const [visits, setVisits] = useState<VisitCampaignStats[]>([])

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
    fetchVisitStats()
      .then(setVisits)
      .catch(() => setVisits([]))
  }, [])

  const today = new Date()
  const dateLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 기준`

  const solvedDelta = dayDelta(stats?.todaySolved, stats?.yesterdaySolved)
  const learnersDelta = dayDelta(stats?.todayLearners, stats?.yesterdayLearners)

  const trend = useMemo(() => {
    if (!stats?.trend?.length) return []
    return range === 14 ? stats.trend.slice(-14) : stats.trend
  }, [stats, range])

  const hasActivity = trend.some((d) => d.solved > 0)

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-sub">{dateLabel}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/upload/math')}>
          + 문제 업로드
        </button>
      </div>

      {/* KPI — 오늘의 서비스 건강 상태 */}
      <div className="grid-stats">
        <StatCard
          label="오늘 풀린 문제"
          value={fmt(stats?.todaySolved)}
          valueColor={stats && stats.todaySolved > 0 ? 'var(--color-primary)' : undefined}
          delta={solvedDelta.text}
          tone={solvedDelta.tone}
        />
        <StatCard
          label="오늘 학습 유저"
          value={fmt(stats?.todayLearners)}
          delta={learnersDelta.text}
          tone={learnersDelta.tone}
        />
        <StatCard
          label="전체 회원"
          value={fmt(stats?.totalMembers)}
          delta={stats ? `게스트 ${stats.totalGuests.toLocaleString()}명 체험 중` : '게스트 — 명'}
          tone="flat"
        />
        <StatCard
          label="오늘 가입"
          value={fmt(stats?.todaySignups)}
          valueColor={stats && stats.todaySignups > 0 ? 'var(--color-primary)' : undefined}
          delta="게스트→회원 전환 포함"
          tone={stats && stats.todaySignups > 0 ? 'good' : 'flat'}
        />
      </div>

      {/* 메인 차트 — 학습 활동 추이 */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">학습 활동 추이</div>
            <div className="card-sub">
              {narrow ? `최근 ${range}일` : `최근 ${range}일 · 풀린 문제 / 학습 유저`}
              {!hasActivity && stats ? ' · 아직 풀이 데이터가 없어요' : ''}
            </div>
          </div>
          <div className="seg">
            <button className={range === 14 ? 'on' : undefined} onClick={() => setRange(14)}>
              14일
            </button>
            <button className={range === 30 ? 'on' : undefined} onClick={() => setRange(30)}>
              30일
            </button>
          </div>
        </div>
        {trend.length > 0 && <TrendChart data={trend} compact={narrow} />}
      </div>

      {/* 전환 요약 — 퍼널 핵심 숫자 3개 */}
      <div className="grid-stats cols-3" style={{ marginTop: 16 }}>
        <StatCard
          label="맛보기 완주율"
          value={stats ? pct(stats.trialCompleters, stats.trialStarters) : '—'}
          delta={stats ? `응시 ${fmt(stats.trialStarters)} · 완주 ${fmt(stats.trialCompleters)}` : '응시 — · 완주 —'}
          tone="flat"
        />
        <StatCard
          label="게스트→회원 전환율"
          value={stats ? pct(stats.totalMembers, stats.totalMembers + stats.totalGuests) : '—'}
          delta="현재 잔존 유저 기준 근사치"
          tone="flat"
        />
        <StatCard
          label="오늘 크레딧 소진"
          value={fmt(stats?.todayCreditsSpent)}
          delta="추천 세트 · 새 문제 풀기"
          tone="flat"
        />
      </div>

      {/* UTM 유입 현황 — 마케팅 링크(?utm_source=...) 캠페인별 방문 수 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">유입 링크 현황</div>
            <div className="card-sub">
              www.pullit.co.kr/?utm_source=… 링크별 방문 수 · 같은 브라우저는 24시간 1회 집계
            </div>
          </div>
        </div>
        {visits.length === 0 ? (
          <p className="page-sub" style={{ marginTop: 12 }}>
            아직 유입 기록이 없어요. utm_source 파라미터를 붙인 링크를 배포하면 여기에 집계돼요.
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>소스</th>
                  <th>캠페인</th>
                  <th style={{ width: 100, textAlign: 'right' }}>오늘</th>
                  <th style={{ width: 100, textAlign: 'right' }}>누적</th>
                  <th style={{ width: 160 }}>마지막 방문</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={`${v.utmSource}:${v.utmMedium ?? ''}:${v.utmCampaign ?? ''}`}>
                    <td className="strong">
                      {v.utmSource}
                      {v.utmMedium ? ` · ${v.utmMedium}` : ''}
                    </td>
                    <td>{v.utmCampaign ?? '—'}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{v.today.toLocaleString()}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{v.total.toLocaleString()}</td>
                    <td className="num">{v.lastVisitAt.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

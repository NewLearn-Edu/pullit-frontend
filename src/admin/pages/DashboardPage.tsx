import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from '../components/StatCard'
import { fetchDashboardStats, type DailyActivity, type DashboardStats } from '../api/adminApi'

/** 숫자 표시 · 로딩 중엔 — */
const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString())

/** 어제 대비 증감 문구 — 증가 그린 ▲ / 감소 레드 ▼ / 동일 muted */
function dayDelta(today: number | undefined, yesterday: number | undefined) {
  if (today == null || yesterday == null) return { text: '어제 대비 —', tone: 'flat' as const }
  const diff = today - yesterday
  // 증시 관례 — 상승은 빨강(up), 하락은 파랑(down) (2026-09-14)
  if (diff > 0) return { text: `▲ 어제보다 +${diff.toLocaleString()}`, tone: 'up' as const }
  if (diff < 0) return { text: `▼ 어제보다 ${diff.toLocaleString()}`, tone: 'down' as const }
  return { text: '어제와 동일', tone: 'flat' as const }
}


/** 'YYYY-MM-DD' → 'MM.DD' */
const shortDate = (iso: string) => iso.slice(5).replace('-', '.')
/** 툴팁 헤더용 — "9월 12일 (금)" */
const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`
}

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

/**
 * 꺾은선 → 부드러운 곡선 (단조 큐빅 · Fritsch–Carlson).
 * 카트멀롬 같은 일반 스플라인은 0이 이어지는 구간에서 바닥 아래로 출렁이는데,
 * 단조 보간은 데이터가 평평한 곳은 평평하게, 오르내리는 곳만 둥글게 잇는다.
 */
function monotoneCurvePath(pts: [number, number][]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0])
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1))
  // 각 점의 접선 기울기 — 양옆 기울기 부호가 다르면 0 (극점은 평평하게)
  const m: number[] = new Array(n).fill(0)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }
  // 오버슈트 방지 — 접선이 구간 기울기의 3배를 넘지 않게
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      m[i] = (3 * a) / h * slope[i]
      m[i + 1] = (3 * b) / h * slope[i]
    }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const t = dx[i] / 3
    const c1x = pts[i][0] + t
    const c1y = pts[i][1] + m[i] * t
    const c2x = pts[i + 1][0] - t
    const c2y = pts[i + 1][1] - m[i + 1] * t
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`
  }
  return d
}

function TrendChart({ data, compact }: { data: DailyActivity[]; compact: boolean }) {
  const W = compact ? 480 : 1000
  const H = compact ? 270 : 250
  const PAD_L = compact ? 34 : 46
  const PAD_R = compact ? 12 : 18
  const PAD_T = 14
  const PAD_B = 30
  // 날짜별 수치 (2026-09-14) — 세로 구간에 마우스를 올리면 그날의 세 수치를 툴팁으로. 30일 뷰는 점을 안 찍지만 hover 구간은 30개 다 둔다.
  // 클릭하면 그 날짜에 고정(마우스를 움직여도 안 바뀜), 다시 클릭하면 고정 해제 → 마우스를 따라간다. 모바일은 탭이 곧 고정
  const [hovered, setHovered] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const active = pinned ?? hovered

  const { yMax, xLabels, solvedArea, learnersArea, signupsArea, solvedPath, learnersPath, signupsPath, cols, innerH } = useMemo(() => {
    const rawMax = Math.max(4, ...data.map((d) => Math.max(d.solved, d.learners, d.signups)))
    const yMax = Math.ceil(rawMax / 4) * 4

    const innerW = W - PAD_L - PAD_R
    const innerH = H - PAD_T - PAD_B
    const x = (i: number) => PAD_L + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
    const y = (v: number) => PAD_T + innerH - (v / yMax) * innerH

    const toPath = (key: 'solved' | 'learners' | 'signups') =>
      monotoneCurvePath(data.map((d, i) => [x(i), y(d[key])]))
    // 면(wave) — 곡선 아래를 바닥까지 닫는다. 세 시리즈 모두 면으로 그리고 반투명하게 겹친다 (2026-09-14)
    const toArea = (key: 'solved' | 'learners' | 'signups') =>
      `${toPath(key)} L${x(data.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`

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

    // hover 구간 — 각 날짜를 가운데 둔 세로 띠 (이웃 점과의 중간까지)
    const half = data.length === 1 ? innerW / 2 : innerW / (data.length - 1) / 2
    const cols = data.map((d, i) => ({
      x: x(i), ySolved: y(d.solved), yLearners: y(d.learners), ySignups: y(d.signups),
      left: Math.max(PAD_L, x(i) - half), width: Math.min(W - PAD_R, x(i) + half) - Math.max(PAD_L, x(i) - half),
    }))

    return {
      yMax, xLabels, cols, innerH,
      solvedArea: toArea('solved'), learnersArea: toArea('learners'), signupsArea: toArea('signups'),
      solvedPath: toPath('solved'), learnersPath: toPath('learners'), signupsPath: toPath('signups'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, compact])

  const gridYs = [0, 1, 2, 3, 4].map((i) => PAD_T + ((H - PAD_T - PAD_B) / 4) * i)

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setHovered(null)}>
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
        {/* 물결 면 (2026-09-14) — 점 없이, 위가 진하고 아래로 옅어지는 면 + 윗가장자리 선 2px.
            큰 시리즈(풀린 문제)를 먼저 깔고 작은 시리즈(학습 유저 → 가입자)를 위에 올린다. 값은 hover·탭 툴팁으로 */}
        <defs>
          <linearGradient id="dashWaveSolved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-primary)" stopOpacity=".62" />
            <stop offset="1" stopColor="var(--color-primary)" stopOpacity=".14" />
          </linearGradient>
          <linearGradient id="dashWaveLearners" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-accent)" stopOpacity=".72" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity=".2" />
          </linearGradient>
          <linearGradient id="dashWaveSignups" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-warn)" stopOpacity=".78" />
            <stop offset="1" stopColor="var(--color-warn)" stopOpacity=".24" />
          </linearGradient>
        </defs>
        <path d={solvedArea} fill="url(#dashWaveSolved)" />
        <path d={solvedPath} fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d={learnersArea} fill="url(#dashWaveLearners)" />
        <path d={learnersPath} fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinejoin="round" />
        <path d={signupsArea} fill="url(#dashWaveSignups)" />
        <path d={signupsPath} fill="none" stroke="var(--color-warn)" strokeWidth="2.2" strokeLinejoin="round" />
        {/* 선택한 날짜 — 세로 가이드 + 세 면 위의 강조 점 (흰 테두리로 면 위에서 도드라지게) */}
        {active != null && (
          <g className="chart-active">
            {/* 고정 상태는 실선, 따라다니는 상태는 점선 */}
            <line x1={cols[active].x} y1={PAD_T} x2={cols[active].x} y2={PAD_T + innerH} strokeDasharray={pinned != null ? undefined : '3 3'} />
            <circle cx={cols[active].x} cy={cols[active].ySolved} r="4.5" fill="var(--color-primary)" stroke="var(--color-canvas)" strokeWidth="2" />
            <circle cx={cols[active].x} cy={cols[active].yLearners} r="4.5" fill="var(--color-accent)" stroke="var(--color-canvas)" strokeWidth="2" />
            <circle cx={cols[active].x} cy={cols[active].ySignups} r="4.5" fill="var(--color-warn)" stroke="var(--color-canvas)" strokeWidth="2" />
          </g>
        )}
        {/* hover·탭 영역 — 투명, 맨 위 */}
        <g fill="transparent">
          {cols.map((c, i) => (
            <rect
              key={`h${c.x}`}
              x={c.left}
              y={PAD_T}
              width={c.width}
              height={innerH}
              onMouseEnter={() => setHovered(i)}
              onClick={() => setPinned(pinned != null ? null : i)}
            />
          ))}
        </g>
      </svg>
      {active != null && (() => {
        const d = data[active]
        const pct = (cols[active].x / W) * 100
        // 오른쪽 구간에서는 왼쪽으로 펼쳐 카드 밖으로 안 나가게 — 모바일은 폭이 좁아 절반부터 뒤집는다
        const side = pct > (compact ? 50 : 72) ? 'left' : 'right'
        return (
          <div className={`chart-tip ${side}`} style={{ left: `${pct}%`, top: `${(PAD_T / H) * 100}%` }}>
            <div className="tip-date">{longDate(d.date)}</div>
            <div className="tip-row"><i style={{ background: 'var(--color-primary)' }} />풀린 문제<b className="num">{d.solved.toLocaleString()}</b></div>
            <div className="tip-row"><i style={{ background: 'var(--color-accent)' }} />학습 유저<b className="num">{d.learners.toLocaleString()}</b></div>
            <div className="tip-row"><i style={{ background: 'var(--color-warn)' }} />가입자<b className="num">{d.signups.toLocaleString()}</b></div>
          </div>
        )
      })()}
      <div className="chart-legend">
        <span><i style={{ background: 'var(--color-primary)' }} />풀린 문제</span>
        <span><i style={{ background: 'var(--color-accent)' }} />학습 유저</span>
        <span><i style={{ background: 'var(--color-warn)' }} />가입자</span>
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

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
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
              {narrow ? `최근 ${range}일` : `최근 ${range}일 · 풀린 문제 / 학습 유저 / 가입자`}
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

      {/* 전환 요약(맛보기 완주율·게스트→회원 전환율·오늘 크레딧 소진) 카드는 2026-09-14 제거 — 유입·퍼널/크레딧 페이지가 담당 */}
    </section>
  )
}

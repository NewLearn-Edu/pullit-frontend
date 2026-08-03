import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from '../components/StatCard'
import { fetchDashboardStats, type DashboardStats } from '../api/adminApi'

const RANKING = [
  { rank: 1, up: true, name: '2026 수능 대비 미적분 킬러 모음 #14', pct: '+380%', hot: true },
  { rank: 2, up: true, name: '고2 영어 빈칸추론 실전 #7', pct: '+212%', hot: true },
  { rank: 3, up: false, name: '물리학Ⅰ 역학 단원평가 #3', pct: '+71%', hot: false },
  { rank: 4, up: false, name: '국어 비문학 경제 지문 #21', pct: '+26%', hot: false },
  { rank: 5, up: false, name: '한국사 근현대사 기출 #9', pct: '+23%', hot: false },
]

const TODOS = [
  { ico: '🔍', bg: 'var(--color-primary-soft)', title: '검수 대기 문제', sub: '3건은 48시간 이상 지연', count: 18, hot: true },
  { ico: '⚠️', bg: 'var(--color-warn-soft)', title: '오류 신고 접수', sub: '정답 오류 신고 포함', count: 5, hot: false },
  { ico: '🖼️', bg: 'var(--color-accent-soft)', title: '이미지 누락 문제', sub: '지문 이미지 재업로드 필요', count: 2, hot: false },
]

/** 숫자 표시 · 로딩 중엔 — */
const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString())

export default function DashboardPage() {
  const navigate = useNavigate()

  // 상단 KPI · GET /api/admin/dashboard/stats 실데이터
  const [stats, setStats] = useState<DashboardStats | null>(null)
  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  const today = new Date()
  const dateLabel = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 기준`

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

      <div className="grid-stats">
        <StatCard label="전체 회원수" value={fmt(stats?.totalUsers)} delta="누적 가입 기준" tone="flat" />
        <StatCard
          label="오늘 가입 수"
          value={fmt(stats?.todayUsers)}
          valueColor={stats && stats.todayUsers > 0 ? 'var(--color-primary)' : undefined}
          delta="오늘 00시 이후"
          tone={stats && stats.todayUsers > 0 ? 'good' : 'flat'}
        />
        <StatCard label="전체 문제 수" value={fmt(stats?.totalProblems)} delta="문제 은행 적재 기준" tone="flat" />
        <StatCard label="오늘 풀린 문제수" value={fmt(stats?.todaySolved)} delta="풀이기록 연동 예정" tone="flat" />
      </div>

      <div className="grid-two">
        {/* 업로드 추이 */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">문제 업로드 추이</div>
              <div className="card-sub">최근 7일 · 업로드 / 검수 완료</div>
            </div>
            <div className="seg">
              <button className="on">일별</button>
              <button>주별</button>
            </div>
          </div>
          <div className="chart-wrap">
            <svg viewBox="0 0 560 220">
              <g className="grid" stroke="#eef0f3" strokeWidth="1">
                <line x1="40" y1="20" x2="540" y2="20" />
                <line x1="40" y1="65" x2="540" y2="65" />
                <line x1="40" y1="110" x2="540" y2="110" />
                <line x1="40" y1="155" x2="540" y2="155" />
                <line x1="40" y1="200" x2="540" y2="200" />
              </g>
              <g className="lbl" fontSize="10.5" fill="#8b95a1" textAnchor="end">
                <text x="32" y="24">60</text>
                <text x="32" y="69">45</text>
                <text x="32" y="114">30</text>
                <text x="32" y="159">15</text>
                <text x="32" y="204">0</text>
              </g>
              <g className="lbl" fontSize="11" fill="#8b95a1" textAnchor="middle">
                <text x="70" y="216">07.18</text>
                <text x="145" y="216">07.19</text>
                <text x="220" y="216">07.20</text>
                <text x="295" y="216">07.21</text>
                <text x="370" y="216">07.22</text>
                <text x="445" y="216">07.23</text>
                <text x="520" y="216">07.24</text>
              </g>
              <defs>
                <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ff385c" stopOpacity=".14" />
                  <stop offset="1" stopColor="#ff385c" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M70,116 L145,95 L220,128 L295,80 L370,89 L445,50 L520,92 L520,200 L70,200 Z" fill="url(#gradP)" />
              <path
                d="M70,116 L145,95 L220,128 L295,80 L370,89 L445,50 L520,92"
                fill="none"
                stroke="#ff385c"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M70,140 L145,122 L220,146 L295,104 L370,118 L445,74 L520,110"
                fill="none"
                stroke="#2dd4a0"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g fill="#ff385c">
                <circle cx="70" cy="116" r="3.5" />
                <circle cx="145" cy="95" r="3.5" />
                <circle cx="220" cy="128" r="3.5" />
                <circle cx="295" cy="80" r="3.5" />
                <circle cx="370" cy="89" r="3.5" />
                <circle cx="445" cy="50" r="3.5" />
                <circle cx="520" cy="92" r="4.5" stroke="#fff" strokeWidth="2" />
              </g>
              <g fill="#2dd4a0">
                <circle cx="70" cy="140" r="3" />
                <circle cx="145" cy="122" r="3" />
                <circle cx="220" cy="146" r="3" />
                <circle cx="295" cy="104" r="3" />
                <circle cx="370" cy="118" r="3" />
                <circle cx="445" cy="74" r="3" />
                <circle cx="520" cy="110" r="3" />
              </g>
            </svg>
            <div className="chart-legend">
              <span><i style={{ background: '#ff385c' }} />업로드</span>
              <span><i style={{ background: '#2dd4a0' }} />검수 완료</span>
            </div>
          </div>
        </div>

        <div>
          {/* 처리할 일 */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 8 }}>
              <div className="card-title">처리가 필요해요</div>
            </div>
            <ul className="todo-list">
              {TODOS.map((t) => (
                <li key={t.title} onClick={() => navigate('/admin/problems/math')}>
                  <span className="todo-ico" style={{ background: t.bg }}>{t.ico}</span>
                  <div className="t">
                    <b>{t.title}</b>
                    <span>{t.sub}</span>
                  </div>
                  <span className="todo-count num" style={t.hot ? { color: 'var(--color-primary)' } : undefined}>
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 인기 문제 */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 6 }}>
              <div>
                <div className="card-title">많이 푼 문제 TOP 5</div>
                <div className="card-sub">최근 7일 풀이 수 기준</div>
              </div>
            </div>
            <ul className="ranking">
              {RANKING.map((r) => (
                <li key={r.rank}>
                  <span className="rank num">{r.rank}</span>
                  <span className={`tri ${r.up ? 'up' : 'keep'}`} />
                  <span className="name">{r.name}</span>
                  <span className={`pct num ${r.hot ? 'hot' : 'ok'}`}>{r.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

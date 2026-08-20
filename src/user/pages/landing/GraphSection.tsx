/**
 * 성과 그래프 섹션 (ver.2 · "하루 3문제, 15분 평균 등급이 달라져")
 * 약점 추천 학습 vs 일반 학습 등급 상승 곡선 + 하단 지표 3장.
 */
const STATS = [
  { label: '평균 등급 상승', value: '2.4등급 상승 ↑' },
  { label: '약점 단원 정답률', value: '48% → 89%' },
  { label: '평균 학습 시간', value: '15분' },
]

/** x: 시작·1개월·2개월·3개월 (80~560) · y: 0~+3.0 (330→70) */
const X = [80, 240, 400, 560]
const yOf = (grade: number) => 330 - (grade / 3) * 260
const RECOMMENDED = [0, 1.3, 2.1, 2.6]
const GENERAL = [0, 0.15, 0.3, 0.5]

export default function GraphSection() {
  const recPts = RECOMMENDED.map((g, i) => `${X[i]},${yOf(g)}`).join(' ')
  const genPts = GENERAL.map((g, i) => `${X[i]},${yOf(g)}`).join(' ')

  return (
    <section id="ai" className="flex w-full flex-col items-center gap-[56px] px-[40px] py-[140px] max-xl:py-[90px] max-md:px-lg">
      <h2 className="break-keep text-center text-[24px] font-medium leading-[1.6] text-[#c8cbd0] max-md:text-[17px]">
        하루 3문제, 15분
        <br />
        <span className="text-[44px] font-bold leading-[1.5] text-white max-xl:text-[34px] max-md:text-[24px]">
          <span className="text-primary">평균 등급</span>이 달라져
        </span>
      </h2>

      <div className="flex w-full max-w-[1000px] flex-col gap-[24px]">
        <div className="flex flex-col gap-[8px] rounded-[32px] bg-[#1e2025] px-[48px] py-[48px] max-md:px-[16px] max-md:py-[24px]">
          <svg viewBox="0 0 640 400" className="w-full" role="img" aria-label="약점 추천 학습과 일반 학습의 3개월 등급 변화 비교">
            <defs>
              <linearGradient id="landing-grade-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff385c" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ff385c" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {/* 그리드 + y 라벨 */}
            {[
              { grade: 3, label: '+3.0' },
              { grade: 2, label: '+2.0' },
              { grade: 1.5, label: '+1.5' },
              { grade: 0.5, label: '+0.5' },
              { grade: 0, label: '0' },
            ].map(({ grade, label }) => (
              <g key={label}>
                <line x1="72" x2="576" y1={yOf(grade)} y2={yOf(grade)} stroke="#33363c" strokeDasharray="5 6" />
                <text x="58" y={yOf(grade) + 4} textAnchor="end" fontSize="13" fill="#8b9098">{label}</text>
              </g>
            ))}

            {/* 일반 학습 — 회색 점선 */}
            <polyline points={genPts} fill="none" stroke="#6f7680" strokeWidth="2" strokeDasharray="6 6" />
            <circle cx={X[3]} cy={yOf(GENERAL[3])} r="5" fill="#6f7680" />
            <g>
              <rect x={X[3] - 88} y={yOf(GENERAL[3]) - 44} width="76" height="28" rx="8" fill="#33363c" />
              <text x={X[3] - 50} y={yOf(GENERAL[3]) - 25} textAnchor="middle" fontSize="13" fill="#c8cbd0">일반 학습</text>
            </g>

            {/* 약점 추천 학습 — 레드 면 + 선 */}
            <polygon points={`${recPts} ${X[3]},330 ${X[0]},330`} fill="url(#landing-grade-fill)" />
            <polyline points={recPts} fill="none" stroke="#ff385c" strokeWidth="2.5" />
            {RECOMMENDED.map((g, i) => (
              <circle key={X[i]} cx={X[i]} cy={yOf(g)} r={i === 3 ? 6 : 4} fill="#fff" stroke="#ff385c" strokeWidth="2.5" />
            ))}
            <g>
              <rect x={X[3] - 44} y={yOf(RECOMMENDED[3]) - 52} width="104" height="32" rx="10" fill="#ff385c" />
              <text x={X[3] + 8} y={yOf(RECOMMENDED[3]) - 31} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">약점 추천 학습</text>
            </g>

            {/* x 라벨 */}
            {['시작', '1개월', '2개월', '3개월'].map((label, i) => (
              <text key={label} x={X[i]} y="368" textAnchor="middle" fontSize="14" fill="#8b9098">{label}</text>
            ))}
          </svg>
          <p className="text-center text-[13px] text-[#7c828a]">
            · 베타 기간(26.03~26.07) 풀잇 사용자 기준 평균 변화
          </p>
        </div>

        <div className="grid grid-cols-3 gap-[20px] max-md:grid-cols-1">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between gap-[12px] rounded-[20px] bg-[#1e2025] px-[28px] py-[26px]">
              <span className="text-[15px] font-medium text-[#c8cbd0]">{stat.label}</span>
              <span className="whitespace-nowrap text-[17px] font-bold text-primary">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

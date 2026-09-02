import SectionHeading from './SectionHeading'

/**
 * 성과 그래프 섹션 (ver.2 · 2801-5506 "하루 3문제, 15분 평균 등급이 달라져")
 * 약점 추천 학습 vs 일반 학습 등급 상승 곡선 + 하단 지표 3장.
 * 시안 축은 눈금이 균등 배치된 장식용(+3.0 / +2.0 / +1.5 / +0.5 / 0)이라 그대로 따른다.
 */
const STATS = [
  { label: '평균 등급 상승', value: '2.4등급 상승 ↑' },
  { label: '약점 단원 정답률', value: '48% → 89%' },
  { label: '평균 학습 시간', value: '15분' },
]

/** 시안 차트 영역 660×(10~278) — x: 시작·1개월·2개월·3개월, y: 시안 화면 위치를 그대로 옮김 */
const X = [62, 261.3, 460.7, 660]
const TOP = 10
const BOTTOM = 278
const RECOMMENDED_Y = [278, 178, 103, 45]
const GENERAL_END_Y = 236
const Y_LABELS = ['+3.0', '+2.0', '+1.5', '+0.5', '0']

/** 수평 접선 큐빅 — Figma 곡선처럼 각 점에서 완만하게 이어진다 */
function smoothPath(xs: number[], ys: number[]): string {
  let d = `M${xs[0]} ${ys[0]}`
  for (let i = 1; i < xs.length; i++) {
    const dx = (xs[i] - xs[i - 1]) / 2
    d += ` C${xs[i - 1] + dx} ${ys[i - 1]} ${xs[i] - dx} ${ys[i]} ${xs[i]} ${ys[i]}`
  }
  return d
}

export default function GraphSection() {
  const recPath = smoothPath(X, RECOMMENDED_Y)
  const gridYs = Y_LABELS.map((_, i) => TOP + ((BOTTOM - TOP) * i) / (Y_LABELS.length - 1))

  return (
    <section
      id="ai"
      className="flex w-full flex-col items-center gap-[60px] py-[148px] max-xl:gap-[40px] max-xl:py-[104px] max-md:gap-[24px] max-md:py-[60px]"
    >
      <SectionHeading eyebrow="하루 3문제, 15분">
        <span className="text-primary">평균 등급</span>이 달라져
      </SectionHeading>

      <div className="flex w-full max-w-[1000px] flex-col gap-[24px] px-[24px] max-md:px-[24px]">
        <div className="flex flex-col items-center gap-[31px] rounded-[32px] bg-[#23272b] px-[37.5px] pb-[37.5px] pt-[62.5px] max-md:gap-[20px] max-md:px-[16px] max-md:pb-[24px] max-md:pt-[32px]">
          <svg
            viewBox="-4 -14 672 344"
            className="landing-chart w-full max-w-[660px] overflow-visible"
            role="img"
            aria-label="약점 추천 학습과 일반 학습의 3개월 등급 변화 비교"
          >
            <defs>
              <linearGradient id="landing-grade-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff385c" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#ff385c" stopOpacity="0.03" />
              </linearGradient>
              <filter id="landing-badge-shadow" x="-20%" y="-40%" width="140%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#ff385c" floodOpacity="0.33" />
              </filter>
              <filter id="landing-endpoint-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            {/* 그리드 + y 라벨 (균등 간격 · 시안 그대로) */}
            {Y_LABELS.map((label, i) => (
              <g key={label}>
                <line
                  x1={X[0]}
                  x2={X[3]}
                  y1={gridYs[i]}
                  y2={gridYs[i]}
                  stroke={i === Y_LABELS.length - 1 ? '#5e6368' : '#40464c'}
                  strokeDasharray={i === Y_LABELS.length - 1 ? undefined : '5 6'}
                />
                <text className="landing-chart-label" x="48" y={gridYs[i] + 5} textAnchor="end" fontSize="14" fontWeight="600" fill="#a6abb1">
                  {label}
                </text>
              </g>
            ))}

            {/* 일반 학습 — 회색 점선 + 끝점 */}
            <line x1={X[0]} y1={BOTTOM} x2={X[3]} y2={GENERAL_END_Y} stroke="#80858b" strokeWidth="1.5" strokeDasharray="6 6" />
            <circle cx={X[3]} cy={GENERAL_END_Y} r="6" fill="#80858b" />
            <g className="landing-chart-badge landing-chart-badge--general">
              <rect x={X[3] - 108} y={GENERAL_END_Y - 52} width="88" height="30" rx="8.75" fill="#40464c" />
              <text x={X[3] - 64} y={GENERAL_END_Y - 32} textAnchor="middle" fontSize="14" fontWeight="600" fill="#e5e7ea">
                일반 학습
              </text>
            </g>

            {/* 약점 추천 학습 — 레드 면 + 곡선 + 점 */}
            <path d={`${recPath} L${X[3]} ${BOTTOM} L${X[0]} ${BOTTOM} Z`} fill="url(#landing-grade-fill)" />
            <path d={recPath} fill="none" stroke="#ff385c" strokeWidth="2.5" />
            {X.slice(0, 3).map((x, i) => (
              <circle key={x} cx={x} cy={RECOMMENDED_Y[i]} r="4.5" fill="#fff" stroke="#ff385c" strokeWidth="2" />
            ))}
            <circle cx={X[3]} cy={RECOMMENDED_Y[3]} r="14" fill="#ff385c" opacity="0.45" filter="url(#landing-endpoint-glow)" />
            <circle cx={X[3]} cy={RECOMMENDED_Y[3]} r="7" fill="#fff" stroke="#ff385c" strokeWidth="3" />
            <g className="landing-chart-badge landing-chart-badge--rec" filter="url(#landing-badge-shadow)">
              <rect x={X[3] - 86} y={RECOMMENDED_Y[3] - 56} width="104" height="34" rx="10.3" fill="#ff385c" />
              <text x={X[3] - 34} y={RECOMMENDED_Y[3] - 34} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">
                약점 추천 학습
              </text>
            </g>

            {/* x 라벨 */}
            {['시작', '1개월', '2개월', '3개월'].map((label, i) => (
              <text
                key={label}
                className="landing-chart-label"
                x={X[i]}
                y={BOTTOM + 42}
                textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}
                fontSize="15.6"
                fontWeight="600"
                fill="#a6abb1"
              >
                {label}
              </text>
            ))}
          </svg>
          <p className="text-center text-[12.5px] text-[#a6abb1]">· 베타 기간(26.03~26.07) 풀잇 사용자 기준 평균 변화</p>
        </div>

        <div className="grid grid-cols-3 gap-[24px] max-md:grid-cols-1 max-md:gap-[8px]">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center justify-between gap-[8px] rounded-[24px] bg-[#23272b] px-[32px] py-[40px] max-xl:p-[24px] max-md:p-[24px]"
            >
              <span className="whitespace-nowrap text-[15.6px] text-[#f0f1f3]">{stat.label}</span>
              <span className="whitespace-nowrap text-[18.75px] font-bold text-primary">{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

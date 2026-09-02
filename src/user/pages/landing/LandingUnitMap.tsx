import { clsx } from 'clsx'
import { useFitScale } from './useFitScale'

/**
 * 약점 단원 지도 데모 (시안 2801-5471 두 번째 프레임 · 3044-14801).
 * 레이더가 왼쪽으로 빠지면 이 노드 그래프가 들어온다 — 대수 → 미적분 I → 확률과 통계 순으로
 * 소단원이 선수 관계 화살표로 이어지고, 약점 단원은 핑크 카드 + "약점" 배지.
 *
 * 좌표는 시안 그대로(1x 기준, 노드 100.6×45.2) 이고 2배로 그려서 transform 으로 줄인다 —
 * 8px 미만 글꼴을 직접 쓰지 않아 브라우저 최소 폰트 제한·흐림이 없다.
 */
const K = 2
const NODE_W = 100.6
const NODE_H = 45.2
const CY = 260 // 1x 캔버스(840×520) 세로 중심

type MapNode = { cat: string; name: string; score: number; weak?: boolean; x: number; y: number }

// x: 노드 왼쪽 · y: 세로 중심 오프셋 (시안 top: calc(50% ± n))
const NODES: MapNode[] = [
  { cat: '대수', name: '지수·로그', score: 68, weak: true, x: 0, y: -230.46 },
  { cat: '대수', name: '지수·로그함수', score: 89, x: 0, y: -153.67 },
  { cat: '대수', name: '삼각함수', score: 68, weak: true, x: 110.32, y: -230.46 },
  { cat: '대수', name: '사인·코사인법칙', score: 89, x: 110.32, y: -153.67 },
  { cat: '대수', name: '등차·등비수열', score: 68, weak: true, x: 220.64, y: -230.46 },
  { cat: '대수', name: '수열의 합', score: 89, x: 220.64, y: -153.67 },
  { cat: '대수', name: '수학적 귀납법', score: 68, weak: true, x: 220.64, y: -76.88 },
  { cat: '미적분 I', name: '함수의 극한', score: 89, x: 425.25, y: -230.46 },
  { cat: '미적분 I', name: '함수의 연속', score: 68, weak: true, x: 425.25, y: -153.67 },
  { cat: '미적분 I', name: '미분계수', score: 89, x: 425.25, y: -76.88 },
  { cat: '미적분 I', name: '도함수', score: 89, x: 425.25, y: -0.09 },
  { cat: '미적분 I', name: '도함수 활용', score: 89, x: 369.85, y: 76.7 },
  { cat: '미적분 I', name: '부정적분', score: 68, weak: true, x: 480.17, y: 76.7 },
  { cat: '미적분 I', name: '정적분', score: 89, x: 425.25, y: 153.48 },
  { cat: '미적분 I', name: '정적분 활용', score: 89, x: 425.25, y: 230.27 },
  { cat: '확률과 통계', name: '순열·조합', score: 89, x: 684.77, y: -230.46 },
  { cat: '확률과 통계', name: '이항정리', score: 89, x: 629.37, y: -153.67 },
  { cat: '확률과 통계', name: '확률의 뜻·이용', score: 68, weak: true, x: 739.69, y: -153.67 },
  { cat: '확률과 통계', name: '조건부확률', score: 89, x: 684.77, y: -76.88 },
  { cat: '확률과 통계', name: '확률분포', score: 89, x: 684.77, y: -0.09 },
  { cat: '확률과 통계', name: '통계적 추정', score: 68, weak: true, x: 684.77, y: 76.7 },
]

const byName = Object.fromEntries(NODES.map((n) => [n.name, n])) as Record<string, MapNode>
const cx = (n: MapNode) => (n.x + NODE_W / 2) * K
const top = (n: MapNode) => (CY + n.y - NODE_H / 2) * K
const bottom = (n: MapNode) => (CY + n.y + NODE_H / 2) * K
const midY = (n: MapNode) => (CY + n.y) * K
const left = (n: MapNode) => n.x * K

/** 같은 열에서 바로 아래로 이어지는 선수 관계 (화살촉 있음) */
const VERTICAL: [string, string][] = [
  ['지수·로그', '지수·로그함수'],
  ['삼각함수', '사인·코사인법칙'],
  ['등차·등비수열', '수열의 합'],
  ['수열의 합', '수학적 귀납법'],
  ['함수의 극한', '함수의 연속'],
  ['함수의 연속', '미분계수'],
  ['미분계수', '도함수'],
  ['정적분', '정적분 활용'],
  ['조건부확률', '확률분포'],
  ['확률분포', '통계적 추정'],
]

/** 갈라지거나 합쳐지는 곡선 (아래 노드 위쪽 가운데로) */
const BRANCH: [string, string][] = [
  ['도함수', '도함수 활용'],
  ['도함수', '부정적분'],
  ['도함수 활용', '정적분'],
  ['부정적분', '정적분'],
  ['순열·조합', '이항정리'],
  ['순열·조합', '확률의 뜻·이용'],
  ['이항정리', '조건부확률'],
  ['확률의 뜻·이용', '조건부확률'],
]

/** 대수 → 미적분 I 로 건너가는 긴 곡선 (도착 노드 왼쪽 가운데로) */
const CROSS: [string, string][] = [
  ['지수·로그함수', '도함수 활용'],
  ['사인·코사인법칙', '도함수 활용'],
]

const W = 840 * K
const H = 520 * K

export default function LandingUnitMap({ className }: { className?: string }) {
  // 시안 카드(952×620) 안에서 지도(840 wide)가 좌우 56px 여백을 갖도록 여백 포함 크기로 맞춘다
  const { ref, scale } = useFitScale(W + 112, H + 80)

  return (
    <div ref={ref} className={clsx('relative overflow-hidden', className)} aria-hidden>
      <div
        className="absolute left-1/2 top-1/2"
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" fill="none">
          <defs>
            <marker id="landing-map-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0L8 4L0 8z" fill="#80858b" />
            </marker>
          </defs>
          {VERTICAL.map(([a, b]) => {
            const from = byName[a]
            const to = byName[b]
            return (
              <line
                key={`${a}-${b}`}
                x1={cx(from)}
                y1={bottom(from) + 2}
                x2={cx(to)}
                y2={top(to) - 3}
                stroke="#80858b"
                strokeWidth="1.5"
                markerEnd="url(#landing-map-arrow)"
              />
            )
          })}
          {BRANCH.map(([a, b]) => {
            const from = byName[a]
            const to = byName[b]
            const x1 = cx(from)
            const y1 = bottom(from) + 2
            const x2 = cx(to)
            const y2 = top(to) - 2
            const my = (y1 + y2) / 2
            return (
              <path
                key={`${a}-${b}`}
                d={`M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`}
                stroke="#80858b"
                strokeWidth="1.5"
              />
            )
          })}
          {CROSS.map(([a, b]) => {
            const from = byName[a]
            const to = byName[b]
            const x1 = cx(from)
            const y1 = bottom(from) + 2
            const x2 = left(to) - 2
            const y2 = midY(to)
            return (
              <path
                key={`${a}-${b}`}
                d={`M${x1} ${y1} C${x1} ${y1 + 220} ${x2 - 160} ${y2} ${x2} ${y2}`}
                stroke="#80858b"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                opacity="0.7"
              />
            )
          })}
        </svg>

        {NODES.map((n) => (
          <div
            key={n.name}
            className={clsx(
              'absolute flex flex-col justify-center rounded-[18px] border p-[11.7px]',
              n.weak ? 'landing-node--weak border-primary bg-[#fff1f2]' : 'border-[#23272b] bg-white',
            )}
            style={{ left: left(n), top: top(n), width: NODE_W * K, height: (n.weak ? 47.6 : NODE_H) * K }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11.7px] font-semibold leading-[1.4] text-[#80858b]">{n.cat}</span>
              {n.weak && (
                <span className="rounded-full bg-primary px-[5.8px] py-[3.9px] text-[9.7px] font-bold leading-none text-white">
                  약점
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-[4px] pt-[6px] text-[#121417]">
              <span className="whitespace-nowrap text-[15.6px] font-semibold leading-[1.4]">{n.name}</span>
              <span className="whitespace-nowrap text-[19.4px] font-semibold leading-[1.4]">{n.score}점</span>
            </div>
            <div className="mt-[8px] h-[4.9px] w-full overflow-hidden rounded-full bg-[#e5e7ea]">
              <div className={clsx('h-full rounded-full', n.weak ? 'bg-primary' : 'bg-[#23272b]')} style={{ width: n.weak ? '68%' : '87%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

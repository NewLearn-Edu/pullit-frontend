import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import styles from './styles/WeaknessRadar.module.scss'

export interface RadarUnit {
  name: string
  /** 0~100 단원 점수 (미진단 축은 실루엣 값) */
  score: number
  /** 미진단 축 — 라벨을 회색 처리하고 점수 대신 자물쇠를 표시 */
  locked?: boolean
}

/** 약점 판정 기준 — 70점 미만 */
const WEAK_THRESHOLD = 70

const RED = '#ff385c'
const INK = '#23272b'

/**
 * 꼭짓점을 둥글린 다각형 path (Figma 시안의 코너 라디우스 재현).
 * 각 꼭짓점에서 양쪽 변을 따라 radius 만큼 물러난 지점을 잇고
 * 꼭짓점을 제어점으로 하는 Q 곡선으로 모서리를 굴린다.
 */
export function roundedPolygon(
  pts: [number, number][],
  radius: number,
): { d: string; apexes: [number, number][] } {
  const n = pts.length
  let d = ''
  const apexes: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const cur = pts[i]
    const next = pts[(i + 1) % n]
    const len1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) || 1
    const len2 = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1
    const r = Math.min(radius, len1 / 2, len2 / 2)
    const p1x = cur[0] - ((cur[0] - prev[0]) / len1) * r
    const p1y = cur[1] - ((cur[1] - prev[1]) / len1) * r
    const p2x = cur[0] + ((next[0] - cur[0]) / len2) * r
    const p2y = cur[1] + ((next[1] - cur[1]) / len2) * r
    d += `${i === 0 ? 'M' : 'L'} ${p1x.toFixed(2)} ${p1y.toFixed(2)} Q ${cur[0].toFixed(2)} ${cur[1].toFixed(2)} ${p2x.toFixed(2)} ${p2y.toFixed(2)} `
    // 둥근 모서리의 실제 정점 (Q 곡선 t=0.5) — 노드 점이 선 위에 걸리도록
    apexes.push([0.25 * p1x + 0.5 * cur[0] + 0.25 * p2x, 0.25 * p1y + 0.5 * cur[1] + 0.25 * p2y])
  }
  return { d: d + 'Z', apexes }
}

export function roundedPolygonPath(pts: [number, number][], radius: number): string {
  return roundedPolygon(pts, radius).d
}

/**
 * 점수 배열을 목표값으로 부드럽게 트윈 (easeInOutCubic).
 * 시나리오가 바뀌면 그래프 폴리곤·점·점수 라벨이 함께 흘러가듯 변한다.
 */
function useAnimatedScores(targets: number[], duration = 900): number[] {
  const [values, setValues] = useState(targets)
  const valuesRef = useRef(targets)
  const key = targets.join(',')

  useEffect(() => {
    const to = key.split(',').map(Number)
    const from = [...valuesRef.current]
    if (
      from.length !== to.length ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      valuesRef.current = to
      setValues(to)
      return
    }
    let raf = 0
    let startAt: number | null = null
    const tick = (now: number) => {
      if (startAt === null) startAt = now
      const t = Math.min(1, (now - startAt) / duration)
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const cur = from.map((f, i) => f + (to[i] - f) * eased)
      valuesRef.current = cur
      setValues(cur)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key, duration])

  return values
}

/**
 * 약점 레이더 차트 (Figma 2689-12016 · 홈 약점 그래프)
 * - 겹겹이 쌓인 핑크 웹 배경 + 다크 데이터 폴리곤
 * - 약점(70점 미만) 노드: 빨간 점 + 띵~ 띵 이중 펄스 링, 라벨·점수 빨간 강조
 * - scores 가 바뀌면 폴리곤이 부드럽게 morph — 점수가 떨어져 약점으로 바뀌는
 *   과정이 그대로 보인다
 */
export default function WeaknessRadar({
  units,
  className,
  dark = false,
}: {
  units: RadarUnit[]
  className?: string
  /** 다크 배경용 라벨 색 (랜딩 ver.2 다크 카드) — 웹·폴리곤은 동일, 텍스트만 밝게 */
  dark?: boolean
}) {
  const labelInk = dark ? '#e9ebee' : INK
  const n = Math.max(units.length, 3)
  const cx = 180
  const cy = 168
  const maxR = 104 // 라벨을 줄바꿈해 좌우 공간을 확보한 만큼 웹을 키움

  const animated = useAnimatedScores(units.map((u) => u.score))

  const point = (i: number, r: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }
  const ringXY = (r: number) =>
    Array.from({ length: n }, (_, i) => point(i, r)) as [number, number][]

  const dataXY = units.map((_, i) =>
    point(i, maxR * Math.max(0.08, (animated[i] ?? 0) / 100)),
  ) as [number, number][]
  // 점·펄스는 둥근 모서리의 실제 정점 위에 얹는다
  const { d: dataPath, apexes } = roundedPolygon(dataXY, 16)

  return (
    <svg
      viewBox="0 0 360 336"
      className={className}
      role="img"
      aria-label="단원별 약점 그래프"
      style={{ overflow: 'visible' }} // 라벨이 뷰박스 가장자리를 살짝 넘어도 잘리지 않게
    >
      {/* 그림자 베이스 — 반투명 핑크 링은 그림자도 투명해져 안 보이므로
          불투명한 흰 바닥판이 대신 그림자를 만든다 */}
      <path
        d={roundedPolygonPath(ringXY(maxR), Math.max(3, maxR * 0.13))}
        fill="#fff"
        style={{ filter: 'drop-shadow(0 6px 12px rgba(116, 116, 116, 0.25))' }}
      />

      {/* 배경 웹 — Figma 원본과 동일한 4겹 (#FF385C 4·8·16·24%, 코너 라디우스) */}
      {[
        { f: 1, opacity: 0.04, stroke: '#fecdd3' },
        { f: 0.75, opacity: 0.08 },
        { f: 0.5, opacity: 0.16 },
        { f: 0.25, opacity: 0.24 },
      ].map(({ f, opacity, stroke }) => (
        <path
          key={f}
          d={roundedPolygonPath(ringXY(maxR * f), Math.max(3, maxR * f * 0.13))}
          fill={RED}
          fillOpacity={opacity}
          stroke={stroke}
          strokeWidth={stroke ? 1 : 0}
        />
      ))}

      {/* 데이터 폴리곤 — 검정 20% + 다크 스트로크 + 드롭섀도 + 코너 라디우스 (Figma 동일) */}
      <path
        d={dataPath}
        fill="rgba(0, 0, 0, 0.2)"
        stroke="#121417"
        strokeWidth="1"
        style={{ filter: 'drop-shadow(0 6px 9px rgba(0, 0, 0, 0.32))' }}
      />

      {/* 노드 + 약점 펄스 */}
      {units.map((unit, i) => {
        // 미진단 축은 중심에 수축돼 있어 점을 찍지 않는다 (중앙에 점 뭉침 방지)
        if (unit.locked) return null
        const [x, y] = apexes[i]
        const weak = Math.round(animated[i] ?? unit.score) < WEAK_THRESHOLD
        return (
          <g key={unit.name}>
            {weak && (
              <>
                <circle cx={x} cy={y} r="7" fill="none" stroke={RED} strokeWidth="0.8" className={styles.pulse} />
                <circle cx={x} cy={y} r="7" fill="none" stroke={RED} strokeWidth="0.8" className={clsx(styles.pulse, styles.pulseLate)} />
              </>
            )}
            {/* 약점 = 채운 빨간 점(경고, 크게) · 정상 = 회색 소점 (Figma 원본 색) */}
            <circle
              cx={x}
              cy={y}
              r={weak ? 3.5 : 2.5}
              fill={weak ? RED : '#80858b'}
              stroke="#fff"
              strokeWidth={weak ? 1.5 : 1}
              className={styles.dot}
            />
          </g>
        )
      })}

      {/* 라벨 — 단원명 + 점수. 약점은 빨간 볼드, 나머지는 흐린 회색 */}
      {units.map((unit, i) => {
        const shown = Math.round(animated[i] ?? unit.score)
        const weak = !unit.locked && shown < WEAK_THRESHOLD
        const [lx, ly] = point(i, maxR + 20)
        const anchor = Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end'
        // 긴 이름("사인·코사인법칙")은 가운뎃점에서 줄바꿈 — 좌우 공간 확보
        const nameParts =
          unit.name.includes('·') && unit.name.length >= 7 ? unit.name.split('·') : null
        // 위쪽 라벨은 위로, 아래쪽 라벨은 아래로 밀어 겹침 방지 (두 줄이면 위쪽은 한 줄 더)
        const dy = ly < cy - 40 ? (nameParts ? -32 : -16) : ly > cy + 40 ? 16 : 0
        const nameY = ly + dy
        const subY = nameY + (nameParts ? 35 : 20)
        return (
          <g key={unit.name} textAnchor={anchor}>
            <text
              x={lx}
              y={nameY}
              fontSize="14"
              fontWeight="500"
              fill={labelInk}
              opacity={unit.locked ? 0.35 : weak ? 1 : dark ? 0.85 : 0.55}
              className={styles.label}
            >
              {nameParts ? (
                <>
                  <tspan x={lx}>{nameParts[0]}·</tspan>
                  <tspan x={lx} dy="16">
                    {nameParts.slice(1).join('·')}
                  </tspan>
                </>
              ) : (
                unit.name
              )}
            </text>
            {unit.locked ? (
              // 미진단 — 점수 대신 자물쇠
              <g
                transform={`translate(${anchor === 'middle' ? lx : anchor === 'start' ? lx + 12 : lx - 12}, ${subY - 9}) scale(1.25)`}
                opacity="0.4"
              >
                <rect x="-4.5" y="0" width="9" height="6.5" rx="1.4" fill="#80858b" />
                <path
                  d="M -2.6 0 V -1.8 A 2.6 2.6 0 0 1 2.6 -1.8 V 0"
                  stroke="#80858b"
                  strokeWidth="1.4"
                  fill="none"
                />
              </g>
            ) : (
              <text
                x={lx}
                y={subY}
                fontSize={weak ? 16 : 13}
                fontWeight={weak ? 700 : 500}
                fill={weak ? RED : labelInk}
                opacity={weak ? 1 : dark ? 0.85 : 0.55}
                className={clsx(styles.label, 'tabular-nums')}
              >
                {shown}점
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

import { clsx } from 'clsx'
import { roundedPolygon, roundedPolygonPath } from './WeaknessRadar'
import styles from './styles/WeaknessRadar.module.scss'

/**
 * 진행형 약점 레이더 (홈 전용 · A안 2026-08-13)
 *
 * WeaknessRadar(가입 유도 데모)와 다른 점 — "완성되어 가는 그래프" 를 그린다.
 *  - 채우는 중: 진단한 축만 중심에서 뻗은 조각(점·선)으로 이어지고,
 *    미진단 축 끝에는 점선 빈 슬롯 + 회색 라벨 + 자물쇠
 *  - 완성: 폴리곤이 닫히고 가장 약한 축만 크게·빨갛게 + 펄스,
 *    나머지 라벨은 조용히 가라앉는다 (결론 전환)
 *
 * 애니메이션 — 진입 시 웹 링 스태거 등장 → 진단 조각이 중심에서 성장,
 * 빈 슬롯 점선 회전 + 최근 진단 점 핑 (전부 CSS · reduced-motion 시 정지).
 * 재생은 마운트 기준 — 탭/카테고리 전환 시 key 로 리마운트해 다시 재생한다.
 */
export interface ProgressRadarUnit {
  name: string
  /** 0~100 단원 점수 — undefined = 미진단 */
  score?: number
}

const WEAK_THRESHOLD = 70
const RED = '#ff385c'
const INK = '#23272b'

export default function ProgressRadar({
  units,
  className,
}: {
  units: ProgressRadarUnit[]
  className?: string
}) {
  const n = Math.max(units.length, 3)
  const cx = 180
  const cy = 168
  const maxR = 104

  const point = (i: number, r: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }
  const ringXY = (r: number) =>
    Array.from({ length: n }, (_, i) => point(i, r)) as [number, number][]

  const diagnosed = units
    .map((u, i) => ({ ...u, i }))
    .filter((u): u is { name: string; score: number; i: number } => u.score != null)
  const complete = diagnosed.length === units.length && units.length > 0

  /** 진단 축의 데이터 좌표 (점수 비례 반경) */
  const dataPoint = (i: number, score: number): [number, number] =>
    point(i, maxR * Math.max(0.08, score / 100))

  // 완성 시 — 닫힌 폴리곤 + 가장 약한 축
  const fullXY = complete
    ? (units.map((u, i) => dataPoint(i, u.score ?? 0)) as [number, number][])
    : null
  const full = fullXY ? roundedPolygon(fullXY, 16) : null
  const weakestIdx = complete
    ? diagnosed.reduce((a, b) => (b.score < a.score ? b : a)).i
    : -1

  // 채우는 중 — 중심에서 진단 축들을 잇는 조각 (순서 진행이라 진단 축은 항상 연속)
  const partialPts = diagnosed.map((u) => dataPoint(u.i, u.score))
  const wedgePath =
    !complete && partialPts.length >= 1
      ? `M ${cx} ${cy} ${partialPts.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} Z`
      : null
  const edgePath =
    !complete && partialPts.length >= 2
      ? `M ${partialPts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}`
      : null

  return (
    <svg
      viewBox="0 0 360 336"
      className={className}
      role="img"
      aria-label="단원별 약점 그래프"
      style={{ overflow: 'visible' }}
    >
      {/* 그림자 베이스 — 흰 바닥판이 그림자를 만든다 (WeaknessRadar 와 동일) */}
      <path
        d={roundedPolygonPath(ringXY(maxR), Math.max(3, maxR * 0.13))}
        fill="#fff"
        style={{ filter: 'drop-shadow(0 6px 12px rgba(116, 116, 116, 0.25))' }}
      />

      {/* 배경 웹 — 4겹 핑크 링 */}
      {[
        { f: 1, opacity: 0.04, stroke: '#fecdd3' },
        { f: 0.75, opacity: 0.08 },
        { f: 0.5, opacity: 0.16 },
        { f: 0.25, opacity: 0.24 },
      ].map(({ f, opacity, stroke }, ringIdx) => (
        <path
          key={f}
          d={roundedPolygonPath(ringXY(maxR * f), Math.max(3, maxR * f * 0.13))}
          fill={RED}
          fillOpacity={opacity}
          stroke={stroke}
          strokeWidth={stroke ? 1 : 0}
          className={styles.webIn}
          // 첫 값 = 등장 스태거, 둘째 값 = 출렁임 시작 위상 / 링마다 주기를 다르게 — 물결 위상차
          style={{
            animationDelay: `${ringIdx * 70}ms, ${900 + ringIdx * 700}ms`,
            animationDuration: `550ms, ${8000 + ringIdx * 1400}ms`,
          }}
        />
      ))}

      {/* ── 채우는 중 — 진단 조각 + 빈 슬롯 (조각은 중심에서 자라난다) ── */}
      {!complete && partialPts.length > 0 && (
        <g className={styles.pieceIn}>
          {wedgePath && <path d={wedgePath} fill="rgba(255, 56, 92, 0.18)" />}
          {edgePath && (
            <path
              d={edgePath}
              stroke="#121417"
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
            />
          )}
          {partialPts.map(([x, y], k) => (
            <g key={diagnosed[k].i}>
              {/* 마지막(가장 최근) 진단 점 — 은은한 핑으로 살아있는 느낌 */}
              {k === partialPts.length - 1 && (
                <>
                  <circle cx={x} cy={y} r="8" fill="none" stroke={RED} strokeWidth="1" className={styles.pulse} />
                  <circle cx={x} cy={y} r="8" fill="none" stroke={RED} strokeWidth="1" className={clsx(styles.pulse, styles.pulseLate)} />
                </>
              )}
              <circle cx={x} cy={y} r="4.5" fill={RED} stroke="#fff" strokeWidth="1.5" />
            </g>
          ))}
        </g>
      )}
      {!complete &&
        units.map((u, i) => {
          if (u.score != null) return null
          const [x, y] = point(i, maxR)
          return (
            <circle
              key={u.name}
              cx={x}
              cy={y}
              r="6"
              fill="none"
              stroke="#c9ccd1"
              strokeWidth="1.4"
              strokeDasharray="3 3"
              className={styles.slotSpin}
            />
          )
        })}

      {/* ── 완성 — 닫힌 폴리곤 + 최약 축 강조 ───────────────────────────── */}
      {full && (
        <path
          d={full.d}
          fill="rgba(0, 0, 0, 0.16)"
          stroke="#121417"
          strokeWidth="1.6"
          className={styles.pieceIn}
          style={{ filter: 'drop-shadow(0 6px 9px rgba(0, 0, 0, 0.25))' }}
        />
      )}
      {full &&
        full.apexes.map(([x, y], i) =>
          i === weakestIdx ? (
            <g key={units[i].name}>
              <circle cx={x} cy={y} r="9" fill="none" stroke={RED} strokeWidth="1.2" className={styles.pulse} />
              <circle cx={x} cy={y} r="9" fill="none" stroke={RED} strokeWidth="1.2" className={clsx(styles.pulse, styles.pulseLate)} />
              <circle cx={x} cy={y} r="5" fill={RED} stroke="#fff" strokeWidth="1.8" />
            </g>
          ) : (
            <circle
              key={units[i].name}
              cx={x}
              cy={y}
              r="2.5"
              fill="#80858b"
              stroke="#fff"
              strokeWidth="1"
            />
          ),
        )}

      {/* ── 라벨 ───────────────────────────────────────────────────────── */}
      {units.map((unit, i) => {
        const locked = unit.score == null
        const weakest = complete && i === weakestIdx
        const weak = !locked && (unit.score ?? 100) < WEAK_THRESHOLD
        // 완성 후엔 최약만 강조, 나머지는 가라앉힌다
        const mutedByConclusion = complete && !weakest
        const [lx, ly] = point(i, maxR + 20)
        const anchor = Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end'
        const nameParts =
          unit.name.includes('·') && unit.name.length >= 7 ? unit.name.split('·') : null
        const dy = ly < cy - 40 ? (nameParts ? -32 : -16) : ly > cy + 40 ? 16 : 0
        const nameY = ly + dy
        const subY = nameY + (nameParts ? 35 : 20)

        const nameFill = weakest ? RED : INK
        const nameOpacity = locked ? 0.35 : mutedByConclusion ? 0.55 : 1

        return (
          <g key={unit.name} textAnchor={anchor}>
            <text
              x={lx}
              y={nameY}
              fontSize="14"
              fontWeight={weakest ? 700 : 500}
              fill={nameFill}
              opacity={nameOpacity}
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
            {locked ? (
              // 미진단 — 점수 대신 "미진단" 텍스트 (Figma 2919-8728)
              <text
                x={lx}
                y={subY}
                fontSize="13"
                fontWeight={700}
                fill="#80858b"
                className={styles.label}
              >
                미진단
              </text>
            ) : (
              <text
                x={lx}
                y={subY}
                fontSize={weakest ? 16 : weak && !complete ? 15 : 13}
                fontWeight={weakest || (weak && !complete) ? 700 : 500}
                fill={weakest || (weak && !complete) ? RED : INK}
                opacity={mutedByConclusion ? 0.55 : 1}
                className={clsx(styles.label, 'tabular-nums')}
              >
                {Math.round(unit.score ?? 0)}점
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useMe } from '@/user/hooks/useMe'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useUserStore } from '@/user/stores/userStore'
import { useTasteStore, type Subject } from '@/user/stores/tasteStore'
import {
  MATH_MAP_EDGES,
  MATH_MAP_NODES,
  MAP_BOUNDS,
  NODE_H,
  NODE_W,
  type MapNode,
} from '@/user/data/mathWeaknessMap'
import { ENGLISH_MAP_EDGES, ENGLISH_MAP_NODES } from '@/user/data/englishWeaknessMap'
import styles from './styles/WeaknessMapPage.module.scss'

const MIN_SCALE = 0.3
const MAX_SCALE = 2
/** 첫 진입 — 줌아웃 상태로 전체 흐름이 보이게 */
const INITIAL_SCALE = 0.55
/** 노드 클릭 포커스 줌 */
const FOCUS_SCALE = 0.95

interface View {
  x: number
  y: number
  scale: number
}

/**
 * 약점 지도 (/weakness-map · Figma 2370-9041 / 2536-2709)
 * 피그마식 무한 캔버스 — 팬(드래그) · 줌(휠/핀치/버튼) · 노드 포커스.
 * 첫 진입은 줌아웃 상태에서 가장 약점인 노드가 화면 중앙에 오도록 시작한다.
 */
export default function WeaknessMapPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const reset = useTasteStore((s) => s.reset)
  const setLastSubject = useTasteStore((s) => s.setLastSubject)

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true })
  }, [sessionStatus, navigate])

  const [subject, setSubject] = useState<Subject>('math')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: INITIAL_SCALE })
  const [animated, setAnimated] = useState(false) // 포커스 이동 중에만 transform 트랜지션

  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // 과목별 그래프 (수학 2370-9041 · 영어 2370-9311)
  const nodes = subject === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES
  const edges = subject === 'math' ? MATH_MAP_EDGES : ENGLISH_MAP_EDGES

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  /** 약점 점수가 가장 낮은 노드 = 첫 포커스 대상 */
  const weakest = useMemo(() => {
    const scored = nodes.filter((n) => n.score != null)
    return scored.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0] ?? nodes[0]
  }, [nodes])

  /**
   * 특정 월드 좌표(노드 중심)를 "보이는 영역"의 중앙에 놓는 view 계산.
   * 패널이 가리는 만큼 제외 — 모바일은 바텀시트 높이(bottom), 웹은 우측 패널 폭(right).
   */
  const centerOn = useCallback(
    (node: MapNode, scale: number, inset: { bottom?: number; right?: number } = {}): View => {
      const rect = containerRef.current?.getBoundingClientRect()
      const vw = rect?.width ?? window.innerWidth
      const vh = rect?.height ?? window.innerHeight
      const visibleW = Math.max(vw - (inset.right ?? 0), vw * 0.3)
      const visibleH = Math.max(vh - (inset.bottom ?? 0), vh * 0.3)
      const cx = node.x + NODE_W / 2
      const cy = node.y + NODE_H / 2
      return { x: visibleW / 2 - cx * scale, y: visibleH / 2 - cy * scale, scale }
    },
    [],
  )

  const sheetRef = useRef<HTMLDivElement>(null)
  /** 팀 기준 데스크탑 분기 (1281~) — 시트가 우측 패널로 배치되는 구간 */
  const isDesktop = () => window.matchMedia('(min-width: 1281px)').matches

  const focusNode = useCallback(
    (node: MapNode, scale: number) => {
      setAnimated(true)
      const el = sheetRef.current
      const inset = isDesktop()
        ? { right: (el?.offsetWidth ?? 0) + 40 } // 패널 폭 + 우측 여백
        : { bottom: el?.offsetHeight ?? 0 }
      setView(centerOn(node, scale, inset))
    },
    [centerOn],
  )

  // 첫 진입·과목 전환 — 선택 해제 + 줌아웃 상태로 그 과목의 가장 약한 노드 중앙
  useEffect(() => {
    setSelectedId(null)
    setAnimated(false)
    setView(centerOn(weakest, INITIAL_SCALE))
    // weakest 는 nodes(과목)에서 파생 — 과목이 바뀔 때만 재실행되면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject])

  // 노드 선택 → 시트가 그려진 다음 프레임에 높이를 재서 가려지지 않는 중심으로 포커스
  useEffect(() => {
    if (!selected) return
    const raf = requestAnimationFrame(() => focusNode(selected, FOCUS_SCALE))
    return () => cancelAnimationFrame(raf)
  }, [selected, focusNode])

  // ── 팬 · 핀치 (pointer events) ─────────────────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ moved: false, lastDist: 0 })

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current.moved = false
    gesture.current.lastDist = 0
    setAnimated(false)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const pts = pointers.current

    if (pts.size === 2) {
      // 핀치 줌 — 두 포인터 중점 기준
      const [a, b] = [...pts.values()]
      const otherPrev = a === prev ? b : a
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [na, nb] = [...pts.values()]
      const dist = Math.hypot(na.x - nb.x, na.y - nb.y)
      const prevDist = gesture.current.lastDist || Math.hypot(prev.x - otherPrev.x, prev.y - otherPrev.y)
      gesture.current.lastDist = dist
      if (prevDist > 0) {
        const mid = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 }
        zoomAt(mid.x, mid.y, dist / prevDist)
      }
      gesture.current.moved = true
      return
    }

    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (Math.abs(dx) + Math.abs(dy) > 2) gesture.current.moved = true
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    gesture.current.lastDist = 0
  }

  /** 화면 좌표 (px,py) 를 고정점으로 배율 factor 적용 */
  const zoomAt = (px: number, py: number, factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    const ox = px - (rect?.left ?? 0)
    const oy = py - (rect?.top ?? 0)
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const k = scale / v.scale
      return { scale, x: ox - (ox - v.x) * k, y: oy - (oy - v.y) * k }
    })
  }

  // 휠 — 기본 스크롤 = 팬, ⌘/Ctrl(트랙패드 핀치 포함) = 줌 (피그마와 동일)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setAnimated(false)
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01))
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomButtons = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setAnimated(true)
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }

  const handleNodeClick = (node: MapNode) => {
    if (gesture.current.moved) return // 드래그 후 클릭 오발동 방지
    // 같은 노드 재탭 = 선택 해제 (시트 닫힘) · 포커스는 시트 높이 측정 후 effect 에서
    setSelectedId((cur) => (cur === node.id ? null : node.id))
  }

  const closeSheet = () => setSelectedId(null)

  // 같은 타깃으로 들어가는 간접 점선이 여러 개면 진입 높이를 위아래로 분산 (겹침 방지)
  const indirectEntryOffset = useMemo(() => {
    const groups = new Map<string, typeof MATH_MAP_EDGES>()
    MATH_MAP_EDGES.filter((e) => e.indirect).forEach((e) => {
      const list = groups.get(e.to) ?? []
      list.push(e)
      groups.set(e.to, list)
    })
    const offsets = new Map<string, number>()
    groups.forEach((list) => {
      list.forEach((e, i) => {
        offsets.set(`${e.from}-${e.to}`, (i - (list.length - 1) / 2) * 24)
      })
    })
    return offsets
  }, [])

  // 시트 아래로 스와이프 닫기 (공용 훅) — 웹은 우측 고정 패널이라 제스처 제외
  const sheetDragGesture = useSheetDrag(closeSheet, { disabled: isDesktop })

  /** 학습 경로 — 메인 간선 기준 이전 → 현재 → 다음 */
  const path = useMemo(() => {
    if (!selected) return []
    const main = edges.filter((e) => !e.indirect)
    const prev = main.find((e) => e.to === selected.id)?.from
    const next = main.find((e) => e.from === selected.id)?.to
    const name = (id?: string) => nodes.find((n) => n.id === id)?.name
    return [
      { name: name(prev), current: false },
      { name: selected.name, current: true },
      { name: name(next), current: false },
    ].filter((p): p is { name: string; current: boolean } => !!p.name)
  }, [selected, nodes, edges])

  const startQuiz = () => {
    reset()
    setLastSubject(subject)
    navigate(`/taste/quiz/${subject}/0`)
  }

  return (
    <div className={styles.page}>
      <UserNav active="map" />

      <div
        className={styles.canvasWrap}
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (!gesture.current.moved) closeSheet() // 빈 캔버스 탭 = 선택 해제
        }}
      >
        {/* 캔버스 (팬/줌 대상) */}
        <div
          className={clsx(styles.world, animated && styles.worldAnimated)}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <>
              {/* 간선 (노드 아래 레이어) — 굵기는 줌 역보정으로 화면상 항상 일정 */}
              <svg
                className={styles.edges}
                width={MAP_BOUNDS.maxX}
                height={MAP_BOUNDS.maxY}
                aria-hidden
              >
                {edges.map((edge) => {
                  const from = nodes.find((n) => n.id === edge.from)!
                  const to = nodes.find((n) => n.id === edge.to)!
                  const sx = from.x + NODE_W / 2
                  const tx = to.x + NODE_W / 2

                  let d: string
                  if (edge.indirect) {
                    // 간접 점선 — 타깃의 "왼쪽 옆면"으로 진입 (시안 라우팅)
                    const entryY = to.y + NODE_H / 2 + (indirectEntryOffset.get(`${edge.from}-${edge.to}`) ?? 0)
                    if (edge.fromSide === 'right') {
                      // 오른쪽 면 출발 → 수평 → 수직 → 수평 진입 (수학적 귀납법 → 순열·조합)
                      const sRight = from.x + NODE_W
                      const sCy = from.y + NODE_H / 2
                      const midX = to.x - NODE_W // 타깃 왼쪽 한 칸 옆 빈 공간에서 수직 이동
                      d = roundedPath([
                        [sRight, sCy],
                        [midX, sCy],
                        [midX, entryY],
                        [to.x, entryY],
                      ])
                    } else {
                      // 아래 면 출발 → 수직으로 타깃 행까지 → 수평 진입
                      d = roundedPath([
                        [sx, from.y + NODE_H],
                        [sx, entryY],
                        [to.x, entryY],
                      ])
                    }
                  } else if (sx === tx) {
                    // 같은 열 — 세로 직선
                    d = `M ${sx} ${from.y + NODE_H} L ${tx} ${to.y}`
                  } else {
                    // 분기·합류 — 행 사이 빈 레인을 지나는 직교 엘보
                    const goingDown = to.y >= from.y + NODE_H
                    const sy = goingDown ? from.y + NODE_H : from.y
                    const ty = goingDown ? to.y : to.y + NODE_H
                    const lane = goingDown ? sy + 26 : sy - 26
                    d = roundedPath([
                      [sx, sy],
                      [sx, lane],
                      [tx, lane],
                      [tx, ty],
                    ])
                  }

                  // CSS scale 이 선까지 축소하므로 역보정 — 줌아웃해도 화면상 1.5px 유지
                  const w = 1.5 / view.scale
                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      d={d}
                      className={clsx(
                        edge.indirect ? styles.edgeIndirect : styles.edgeMain,
                        from.state === 'weak' && styles.edgeWeak,
                      )}
                      style={{
                        strokeWidth: w,
                        strokeDasharray: edge.indirect ? `${6 / view.scale} ${6 / view.scale}` : undefined,
                      }}
                    />
                  )
                })}
              </svg>

              {/* 노드 */}
              {nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNodeClick(node)
                  }}
                  style={{ left: node.x, top: node.y }}
                  className={clsx(
                    styles.node,
                    node.state === 'weak' && styles.nodeWeak,
                    node.state === 'done' && styles.nodeDone,
                    node.state === 'locked' && styles.nodeLocked,
                    selectedId === node.id && styles.nodeSelected,
                  )}
                >
                  <span className={styles.nodeHead}>
                    <span className={styles.nodeCat}>{node.cat}</span>
                    {node.state === 'weak' && <span className={styles.badgeWeak}>약점</span>}
                    {node.state === 'locked' && <span className={styles.badgeLocked}>잠김</span>}
                  </span>
                  <span className={styles.nodeBody}>
                    <span className={styles.nodeName}>{node.name}</span>
                    <span className={styles.nodeScore}>
                      {node.score != null ? `${node.score}점` : '-'}
                    </span>
                  </span>
                  <span className={styles.track}>
                    {node.score != null && (
                      <span className={styles.fill} style={{ width: `${node.score}%` }} />
                    )}
                  </span>
                </button>
              ))}
            </>
        </div>

        {/* 상단 플로팅 헤더 — 캔버스 팬/선택해제와 분리 */}
        <header
          className={styles.header}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <CreditBadge credit={me?.creditBalance ?? 0} />
          <SubjectTabs pill value={subject} onChange={setSubject} />
          <div className={styles.headerIcons}>
            <button
              type="button"
              aria-label="오답노트"
              onClick={() => navigate('/wrong-note')}
              className={styles.iconCircle}
            >
              <BookmarkIcon />
            </button>
            <button
              type="button"
              aria-label="마이페이지"
              onClick={() => navigate('/my')}
              className={styles.iconCircle}
            >
              <PersonIcon />
            </button>
          </div>
        </header>

        {/* 좌하단 범례 */}
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.legendItem}>
              <svg width="16" height="8" viewBox="0 0 16 8"><line x1="0" y1="4" x2="16" y2="4" stroke="#c4c9ce" strokeWidth="1.5" /></svg>
              연결 단원
            </span>
            <span className={styles.legendItem}>
              <svg width="16" height="8" viewBox="0 0 16 8"><line x1="0" y1="4" x2="16" y2="4" stroke="#c4c9ce" strokeWidth="1.5" strokeDasharray="3 3" /></svg>
              간접 단원
            </span>
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendItem}>
              <i className={clsx(styles.swatch, styles.swatchWeak)} />약점
            </span>
            <span className={styles.legendItem}>
              <i className={clsx(styles.swatch, styles.swatchDone)} />진단 완료
            </span>
            <span className={styles.legendItem}>
              <i className={clsx(styles.swatch, styles.swatchLocked)} />미진단
            </span>
          </div>
        </div>

        {/* 우하단 줌 컨트롤 — 웹에서 우측 패널이 열리면 왼쪽으로 밀림 */}
        <div
          className={clsx(styles.controls, selected && styles.controlsShifted)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" aria-label="확대" onClick={() => zoomButtons(1.25)} className={styles.controlButton}>
            +
          </button>
          <button type="button" aria-label="축소" onClick={() => zoomButtons(0.8)} className={styles.controlButton}>
            −
          </button>
          <button
            type="button"
            aria-label="약점 단원으로 이동"
            onClick={() => focusNode(selected ?? weakest, FOCUS_SCALE)}
            className={styles.controlButton}
          >
            <CrosshairIcon />
          </button>
        </div>

        {/* 노드 상세 바텀시트 */}
        {selected && (
          <div
            ref={sheetRef}
            {...sheetDragGesture.sheetProps}
            className={clsx(styles.sheet, sheetDragGesture.dragging && styles.sheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" aria-label="닫기" onClick={closeSheet} className={styles.sheetHandleWrap}>
              <span className={styles.sheetHandle} />
            </button>
            {/* 웹(우측 패널) 전용 닫기 버튼 — 모바일은 핸들·스와이프로 닫음 */}
            <button type="button" aria-label="닫기" onClick={closeSheet} className={styles.sheetClose}>
              ×
            </button>
            <h2 className={styles.sheetTitle}>{selected.name}</h2>
            <div className={styles.sheetStats}>
              <div className={styles.sheetStat}>
                <span className={styles.sheetStatLabel}>푼 문제</span>
                <span className={styles.sheetStatValue}>
                  {selected.stats ? `${selected.stats.solved}문제` : '-'}
                </span>
              </div>
              <div className={styles.sheetStat}>
                <span className={styles.sheetStatLabel}>점수</span>
                <span className={styles.sheetStatValue}>
                  {selected.score != null ? `${selected.score}점` : '-'}
                </span>
              </div>
              <div className={clsx(styles.sheetStat, styles.sheetStatLast)}>
                <span className={styles.sheetStatLabel}>공부 시간</span>
                <span className={styles.sheetStatValue}>
                  {selected.stats
                    ? `${Math.floor(selected.stats.minutes / 60)}시간 ${selected.stats.minutes % 60}분`
                    : '-'}
                </span>
              </div>
            </div>

            {path.length > 0 && (
              <>
                <h3 className={styles.sheetSection}>학습 경로</h3>
                <div className={styles.pathBox}>
                  {path.map((p, i) => (
                    <div key={p.name} className={styles.pathItem}>
                      {i > 0 && <span className={styles.pathLine} />}
                      <span className={styles.pathRow}>
                        <i className={clsx(styles.pathDot, p.current && styles.pathDotCurrent)} />
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button type="button" onClick={startQuiz} className={styles.sheetButton}>
              문제 풀기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 직교 폴리라인 경로 (피그마 커넥터 스타일) — 꺾이는 모서리를 라운드(Q 커브) 처리.
 * 반경은 인접 구간 길이의 절반까지 클램프.
 */
function roundedPath(pts: Array<[number, number]>, r = 14): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const [nx, ny] = pts[i + 1]
    const inLen = Math.hypot(cx - px, cy - py)
    const outLen = Math.hypot(nx - cx, ny - cy)
    const rr = Math.min(r, inLen / 2, outLen / 2)
    const inX = cx - ((cx - px) / inLen) * rr
    const inY = cy - ((cy - py) / inLen) * rr
    const outX = cx + ((nx - cx) / outLen) * rr
    const outY = cy + ((ny - cy) / outLen) * rr
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`
  }
  const [lx, ly] = pts[pts.length - 1]
  d += ` L ${lx} ${ly}`
  return d
}

/* --- 인라인 SVG 아이콘 --- */

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  )
}

function CrosshairIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
    </svg>
  )
}

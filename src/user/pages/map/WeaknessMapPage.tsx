import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useMe } from '@/user/hooks/useMe'
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

  const selected = useMemo(
    () => MATH_MAP_NODES.find((n) => n.id === selectedId) ?? null,
    [selectedId],
  )

  /** 약점 점수가 가장 낮은 노드 = 첫 포커스 대상 */
  const weakest = useMemo(() => {
    const scored = MATH_MAP_NODES.filter((n) => n.score != null)
    return scored.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0] ?? MATH_MAP_NODES[0]
  }, [])

  /** 특정 월드 좌표(노드 중심)를 뷰포트 중앙에 놓는 view 계산 */
  const centerOn = useCallback((node: MapNode, scale: number): View => {
    const rect = containerRef.current?.getBoundingClientRect()
    const vw = rect?.width ?? window.innerWidth
    const vh = rect?.height ?? window.innerHeight
    const cx = node.x + NODE_W / 2
    const cy = node.y + NODE_H / 2
    return { x: vw / 2 - cx * scale, y: vh / 2 - cy * scale, scale }
  }, [])

  const focusNode = useCallback(
    (node: MapNode, scale: number) => {
      setAnimated(true)
      setView(centerOn(node, scale))
    },
    [centerOn],
  )

  // 첫 진입 — 줌아웃 + 가장 약한 노드 중앙 (애니메이션 없이 즉시)
  useEffect(() => {
    setView(centerOn(weakest, INITIAL_SCALE))
    // centerOn 은 ref 기반이라 마운트 후 1회면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setSelectedId(node.id)
    focusNode(node, FOCUS_SCALE)
  }

  const closeSheet = () => setSelectedId(null)

  /** 학습 경로 — 메인 간선 기준 이전 → 현재 → 다음 */
  const path = useMemo(() => {
    if (!selected) return []
    const main = MATH_MAP_EDGES.filter((e) => !e.indirect)
    const prev = main.find((e) => e.to === selected.id)?.from
    const next = main.find((e) => e.from === selected.id)?.to
    const name = (id?: string) => MATH_MAP_NODES.find((n) => n.id === id)?.name
    return [
      { name: name(prev), current: false },
      { name: selected.name, current: true },
      { name: name(next), current: false },
    ].filter((p): p is { name: string; current: boolean } => !!p.name)
  }, [selected])

  const startQuiz = () => {
    reset()
    setLastSubject('math')
    navigate('/taste/quiz/math/0')
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
          {subject === 'math' ? (
            <>
              {/* 간선 (노드 아래 레이어) */}
              <svg
                className={styles.edges}
                width={MAP_BOUNDS.maxX}
                height={MAP_BOUNDS.maxY}
                aria-hidden
              >
                {MATH_MAP_EDGES.map((edge) => {
                  const from = MATH_MAP_NODES.find((n) => n.id === edge.from)!
                  const to = MATH_MAP_NODES.find((n) => n.id === edge.to)!
                  const sx = from.x + NODE_W / 2
                  const sy = from.y + NODE_H
                  const tx = to.x + NODE_W / 2
                  const ty = to.y
                  const d =
                    sx === tx && !edge.indirect
                      ? `M ${sx} ${sy} L ${tx} ${ty}`
                      : `M ${sx} ${sy} C ${sx} ${sy + 60}, ${tx} ${ty - 60}, ${tx} ${ty}`
                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      d={d}
                      className={edge.indirect ? styles.edgeIndirect : styles.edgeMain}
                    />
                  )
                })}
              </svg>

              {/* 노드 */}
              {MATH_MAP_NODES.map((node) => (
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
          ) : null}
        </div>

        {/* 영어 — 준비 중 */}
        {subject === 'english' && (
          <div className={styles.emptyState}>영어 약점 지도는 준비 중이에요</div>
        )}

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

        {/* 우하단 줌 컨트롤 */}
        <div
          className={styles.controls}
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
            className={styles.sheet}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" aria-label="닫기" onClick={closeSheet} className={styles.sheetHandleWrap}>
              <span className={styles.sheetHandle} />
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

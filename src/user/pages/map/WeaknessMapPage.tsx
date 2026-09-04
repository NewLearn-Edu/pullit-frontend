import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { UserNav } from '@/user/components/UserNav'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { type Subject } from '@/user/stores/trialStore'
import { fetchUnitLocks } from '@/user/api/recommendApi'
import { fetchResumableSet, type ResumableSet } from '@/user/api/problemSetApi'
import { findCategoryByName } from '@/user/data/curriculum'
import {
  computeCategoryProgress,
  useTrialProgressStore,
  type UnitProgressRow,
} from '@/user/stores/trialProgressStore'
import { useUnitSheets, consumeUnitReopenFlash } from '@/user/pages/home/UnitSheets'
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

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  const [subject, setSubject] = useState<Subject>('math')

  // ── 진행 상태 — 홈과 같은 진실원 (trial_diagnoses + unit_locks) ──────────
  const diagnosed = useTrialProgressStore((s) => s.diagnosed)
  const hydrateFromServer = useTrialProgressStore((s) => s.hydrateFromServer)
  const [locks, setLocks] = useState<Record<string, string>>({})
  const refreshLocks = useCallback(
    () =>
      fetchUnitLocks(subject)
        .then((list) => {
          const map: Record<string, string> = {}
          for (const lock of list) map[lock.categoryCode] = lock.offFromUnitCode
          setLocks(map)
        })
        .catch(() => {}),
    [subject],
  )
  useEffect(() => {
    if (sessionStatus !== 'ready') return
    hydrateFromServer()
    refreshLocks()
  }, [sessionStatus, hydrateFromServer, refreshLocks])

  // 풀다 만 세트 — 해당 노드에 "풀다 만 문제" 표식 (홈 카드 라벨과 같은 진실원, 3681)
  const [resumableSet, setResumableSet] = useState<ResumableSet | null>(null)
  useEffect(() => {
    if (sessionStatus !== 'ready') return
    let alive = true
    fetchResumableSet()
      .then((resumable) => {
        if (alive) setResumableSet(resumable)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [sessionStatus])

  // 소단원명 → (진행 행 + 카테고리 행 목록) — 노드 상태·시트 컨텍스트의 근거
  const rowIndex = useMemo(() => {
    const map = new Map<string, { row: UnitProgressRow; rows: UnitProgressRow[] }>()
    const seen = new Set<string>()
    for (const node of subject === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES) {
      const category = findCategoryByName(subject, node.cat)
      if (!category || seen.has(category.slug)) continue
      seen.add(category.slug)
      const code = category.units[0].unitCode.split('_').slice(0, 3).join('_')
      const rows = computeCategoryProgress(category, diagnosed, locks[code] ?? null).rows
      for (const row of rows) map.set(row.name, { row, rows })
    }
    return map
  }, [subject, diagnosed, locks])

  // 홈과 동일한 소단원 액션 시트 (상세·진단 시작·재진단·선행 안내)
  const sheets = useUnitSheets({
    subject,
    credit: me?.creditBalance ?? 0,
    returnTo: () => '/weakness-map',
    onLocksChanged: refreshLocks,
    onAllClosed: () => setSelectedId(null),
    // 선행 안내 시트에서 "OO 먼저 풀기" — 시트가 선행 단원으로 넘어가면 지도 선택 노드도 따라간다 (2026-09-04)
    onUnitSwitched: (name) => {
      const node = (subject === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES).find((n) => n.name === name)
      if (node) setSelectedId(node.id)
    },
    // 진단 완료 토스트 "보기" (3575-7884) — 노드 클릭과 같은 경로로 선택 + 상세 시트
    resolveUnit: (name) => {
      const hit = rowIndex.get(name)
      if (!hit) return null
      const node = (subject === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES).find(
        (n) => n.name === name,
      )
      if (!node) return null
      const category = findCategoryByName(subject, node.cat)
      if (!category) return null
      setSelectedId(node.id)
      return { row: hit.row, context: { category, rows: hit.rows } }
    },
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 점수 변동 화면(/solve-result)에서 "완료"로 돌아온 경우 — 방금 푼 소단원을 선택(포커스)하고
  // 상세 시트를 바로 연다 (3699-11683). 플래시는 읽는 즉시 지워져 1회만
  // (플래시는 마운트 때 한 번 읽어 두고, 행 인덱스가 준비되는 시점에 연다 — 잠금 조회 뒤 재계산돼도 1회)
  const pendingReopenRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (pendingReopenRef.current === undefined) pendingReopenRef.current = consumeUnitReopenFlash(subject)
    const unitName = pendingReopenRef.current
    if (!unitName) return
    const hit = rowIndex.get(unitName)
    const node = (subject === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES).find((n) => n.name === unitName)
    const category = node ? findCategoryByName(subject, node.cat) : null
    if (!hit || !node || !category) return
    pendingReopenRef.current = null
    setSelectedId(node.id)
    sheets.openUnit(hit.row, { category, rows: hit.rows })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, rowIndex])

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: INITIAL_SCALE })
  const [animated, setAnimated] = useState(false) // 포커스 이동 중에만 transform 트랜지션
  // 피그마식 핸드 툴 — 스페이스 누르는 동안 grab 커서 + 노드 클릭 무시
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const spaceRef = useRef(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      e.preventDefault() // 스페이스 스크롤 방지
      spaceRef.current = true
      setSpaceHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceRef.current = false
      setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

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

  /** 약점 점수가 가장 낮은 노드 = 첫 포커스 대상 — 서버 진단 점수 기준 */
  const weakest = useMemo(() => {
    const scored = nodes
      .map((n) => ({ n, score: rowIndex.get(n.name)?.row.diagnosis?.score }))
      .filter((e): e is { n: MapNode; score: number } => e.score != null)
    return scored.sort((a, b) => a.score - b.score)[0]?.n ?? nodes[0]
  }, [nodes, rowIndex])

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

  const focusNode = useCallback(
    (node: MapNode, scale: number, inset: { bottom?: number; right?: number } = {}) => {
      setAnimated(true)
      setView(centerOn(node, scale, inset))
    },
    [centerOn],
  )

  // 첫 진입·과목 전환 — 선택 해제 + 줌아웃 상태로 그 과목의 가장 약한 노드 중앙
  // useLayoutEffect: 페인트 전에 중앙 정렬 — useEffect 면 (0,0) 프레임이 먼저 보여 깜빡인다
  useLayoutEffect(() => {
    setSelectedId(null)
    setAnimated(false)
    setView(centerOn(weakest, INITIAL_SCALE))
    // weakest 는 nodes(과목)에서 파생 — 과목이 바뀔 때만 재실행되면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject])

  // 노드 선택 → 시트가 그려진 다음 프레임에 높이를 재서 가려지지 않는 중심으로 포커스
  // 노드 선택 → 시트가 그려진 다음 프레임에 높이를 재서 가려지지 않는 중심으로 포커스
  useEffect(() => {
    if (!selected) return
    const raf = requestAnimationFrame(() => {
      const el = sheets.sheetEl.current
      const inset = window.matchMedia('(min-width: 1281px)').matches
        ? { right: (el?.offsetWidth ?? 0) + 40 } // 웹 — 우측 패널 폭 + 여백
        : { bottom: el?.offsetHeight ?? 0 } // 모바일·패드 — 바텀시트 높이
      focusNode(selected, FOCUS_SCALE, inset)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setPanning(true)
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
    if (pointers.current.size === 0) setPanning(false)
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
    if (spaceRef.current) return // 핸드 툴 중엔 선택 없이 팬만
    setSelectedId(node.id)
    // 홈과 같은 분기 — 상태별 시트 (상세·진단 시작·재진단·선행 안내)
    const hit = rowIndex.get(node.name)
    if (!hit) return
    const category = findCategoryByName(subject, node.cat)
    if (!category) return
    sheets.openUnit(hit.row, { category, rows: hit.rows })
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

  return (
    <div className={styles.page}>
      <UserNav active="map" />

      <div
        className={clsx(
          styles.canvasWrap,
          spaceHeld && (panning ? styles.handGrabbing : styles.handGrab),
        )}
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          // 빈 캔버스 탭 = 선택 해제
          if (!gesture.current.moved && !spaceRef.current) closeSheet()
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
                        rowIndex.get(from.name)?.row.diagnosis?.weak && styles.edgeWeak,
                      )}
                      style={{
                        strokeWidth: w,
                        strokeDasharray: edge.indirect ? `${6 / view.scale} ${6 / view.scale}` : undefined,
                      }}
                    />
                  )
                })}
              </svg>

              {/* 노드 — 상태·점수는 홈과 같은 진실원(서버 진단·잠금)에서 파생 */}
              {nodes.map((node) => {
                const row = rowIndex.get(node.name)?.row
                const score = row?.diagnosis?.score ?? null
                const weak = !!row?.diagnosis?.weak
                const done = !!row?.diagnosis
                // 건너뛴(off) 구간은 자물쇠로 — 그 외 미진단은 전부 "미진단" 배지 (시안 2370-9041)
                const off = row?.state === 'off'
                // 풀다 만 세트가 있는 노드 — 상태 배지 대신 재개 표식이 우선 (홈 3681 라벨과 동일 정보)
                const resumable = !!row && resumableSet?.unitCode === row.unitCode
                return (
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
                      weak && styles.nodeWeak,
                      done && !weak && styles.nodeDone,
                      !done && !off && styles.nodeLocked,
                      off && styles.nodeSkipped,
                      selectedId === node.id && styles.nodeSelected,
                    )}
                  >
                    <span className={styles.nodeHead}>
                      <span className={styles.nodeCat}>{node.cat}</span>
                      {resumable ? (
                        <span className={styles.badgeResume}>풀다 만 문제</span>
                      ) : (
                        <>
                          {weak && <span className={styles.badgeWeak}>약점</span>}
                          {!done && !off && <span className={styles.badgeLocked}>미진단</span>}
                          {off && <span className={styles.badgeLocked}>건너뜀</span>}
                        </>
                      )}
                    </span>
                    <span className={styles.nodeBody}>
                      <span className={styles.nodeName}>{node.name}</span>
                      <span className={styles.nodeScore}>
                        {score != null ? `${score}점` : '-'}
                      </span>
                    </span>
                    <span className={styles.track}>
                      {score != null && (
                        <span className={styles.fill} style={{ width: `${score}%` }} />
                      )}
                    </span>
                  </button>
                )
              })}
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
              <WrongNoteIcon />
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
            <span className={styles.legendItem}>
              <i className={clsx(styles.swatch, styles.swatchSkipped)} />건너뜀
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

        {/* 소단원 액션 시트 — 홈과 공용 (UnitSheets). 지도 위 오버레이로 뜬다 */}
        {sheets.element}
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

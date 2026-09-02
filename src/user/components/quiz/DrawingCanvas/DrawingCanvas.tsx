import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { getStroke } from 'perfect-freehand'
import { newStrokeId, noteBottom, strokeRect, type NoteStroke } from '@/user/utils/noteStroke'
import styles from './styles/DrawingCanvas.module.scss'

/** 필기 도구 — 저장되는 둘(mono · marker)은 PNK1 type 이름 그대로 (pen→mono · highlighter→marker, 2026-09-02) */
export type StrokeTool = 'mono' | 'marker' | 'eraser' | 'laser'

/** 지우개 종류 — 전체: 닿은 획을 통째로 · 일부: 지나간 부분만 잘라냄 (패스노트 전체/일부와 같은 의미) */
export type EraserMode = 'stroke' | 'partial'

export interface DrawingCanvasHandle {
  clear: () => void
  undo: () => void
  /** 저장본 복원 — 되돌리기 히스토리를 비우고 통째로 교체. 사용자 편집이 아니라 onStrokesChange 는 부르지 않는다 */
  setStrokes: (strokes: NoteStroke[]) => void
}

/** 진행 중 획 · 레이저 — 완성 전이라 id · rect 없음. 완성 획(NoteStroke)도 같은 필드로 렌더한다 */
interface Ink {
  tool: StrokeTool
  color: string
  /** 굵기(지름) — 기준 폭 base 조판 px (레이저만 화면 px ÷ 배율) */
  width: number
  /** [x, y] — 기준 폭 base 조판 좌표 · 좌상단 원점 (화면 px 을 배율로 나눈 값) */
  points: number[][]
}

export interface DrawingCanvasProps {
  tool: StrokeTool
  color: string
  size: number
  disabled?: boolean
  allowFinger?: boolean
  /**
   * 월드 좌표 기준 폭 — 본문을 감싼 ExamScaleFrame 의 base 와 같은 값이어야
   * 필기가 본문과 같은 배율로 커지고 줄어든다.
   */
  base?: number
  /** 지우개 종류 — 기본 일부(partial) */
  eraserMode?: EraserMode
  /** 완성 획 목록이 사용자 편집(획 추가 · 지우개 · 되돌리기 · 모두 지우기)으로 바뀔 때 — 저장 대상 */
  onStrokesChange?: (strokes: NoteStroke[]) => void
  /** 획이 차지하는 세로 끝(컨테이너 상단 기준 화면 px) — 복원한 필기가 안 잘리게 부모가 min-height 를 늘린다 */
  onContentHeight?: (px: number) => void
}

/**
 * 입력 게이트 (화면 px) — 이보다 작게 움직인 포인터 리포트는 노이즈로 보고 버린다.
 * 손떨림·펜 센서 노이즈 진폭(±0.5~1px)보다 크고, 작은 글씨 획(10px+)보다는 충분히 작게.
 */
const INPUT_GATE_PX = 2

/** 되돌리기 보관 단계 */
const MAX_HISTORY = 100

/**
 * 도구별 슬라이더 값(0.1~1.0) → 굵기 (기준 폭 base 조판 px — 저장 단위 · 지우개 커서 지름과 공유).
 * 화면 px 이 아니다 — 350px 화면에선 ×0.7 로 가늘어져 본문과 같은 비율을 유지한다 (2026-09-02).
 * 레이저만 화면 px (포인터 효과라 배율 무관 · 호출부가 배율로 나눔).
 */
function toolWidth(tool: StrokeTool, size: number): number {
  if (tool === 'laser') return 9 // 슬라이더 무시 · 네온 링+코어 구조 잘 보이게 다소 굵게
  if (tool === 'marker') return size * 32
  return size * 14
}

/**
 * 필기 캔버스 — 보이는 2-레이어 방식 (2026-08-30 개편).
 *
 * Layer A · base (아래 캔버스, 보임)
 *   - 완성된 stroke 를 픽셀로 박제. undo · clear · resize · 지우개 때만 전체 재구성.
 *   - 그리는 동안에는 절대 지우지 않는다 — 완성된 잉크는 물리적으로 깜빡일 수 없다.
 * Layer B · live (위 캔버스, 보임 · 포인터 수신)
 *   - 진행 중 stroke 와 레이저만. 매 프레임 clear 후 다시 그린다.
 *
 * 이전의 "오프스크린 → 매 프레임 메인에 전체 복사" 방식은 iPad Safari(120Hz)에서
 * 큰 캔버스의 clear+blit 가 프레임마다 반복돼 간헐적 빈 프레임(깜빡임)과 프레임
 * 드랍을 만들었다. 레이어를 DOM 에서 분리하면 프레임당 비용이 진행 중 획 하나로
 * 줄고, 완성 획은 합성기(compositor)가 그대로 유지한다.
 *
 * 지우개는 벡터 (2026-09-02) — 픽셀을 파던(destination-out) 결과는 저장할 방법이 없었다.
 * 전체(stroke) 모드는 지나간 자리와 겹치는 완성 획을 목록에서 빼고, 일부(partial) 모드는 겹치는 구간만
 * 잘라내 남은 조각을 새 획으로 둔다. 어느 쪽이든 목록을 고치고 base 를 재구성한다.
 *
 * 좌표계 — 본문(ExamScaleFrame)과 같은 "기준 폭 base 조판" 월드 좌표 (= PNK1 저장 좌표).
 * 획은 월드 좌표로 저장하고 렌더 때 현재 배율(컨테이너 clientWidth ÷ base)을 곱한다.
 * → 창 리사이즈·해설 패널 드래그·기기 회전으로 본문이 확대/축소돼도
 *   필기가 본문 위 같은 자리에 같은 비율로 따라간다.
 *
 * perfect-freehand 옵션도 튜닝 · SVG path 스타일로 렌더링해 계단현상 최소화.
 * 저장은 하지 않는다 — 완성 획 목록을 onStrokesChange 로 올리면 ProblemNoteCanvas 가 저장소에 넘긴다.
 */
export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      tool,
      color,
      size,
      disabled,
      allowFinger = false,
      base = 500,
      eraserMode = 'partial',
      onStrokesChange,
      onContentHeight,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    /** Layer A — 완성 stroke (아래) */
    const baseCanvasRef = useRef<HTMLCanvasElement>(null)
    /** Layer B — 진행 중 stroke · 레이저 (위 · 포인터 수신) */
    const liveCanvasRef = useRef<HTMLCanvasElement>(null)
    // 현재 배율 (컨테이너 폭 ÷ base) — 월드 좌표 ↔ 화면 px 변환에 사용
    const scaleRef = useRef(1)
    // 지우개 도구 사용 시 포인터 위치 · 크기를 미리 보여주는 원형 커서 오버레이
    const eraserCursorRef = useRef<HTMLDivElement>(null)

    const strokesRef = useRef<NoteStroke[]>([])
    /** 되돌리기 스택 — 편집 직전 목록의 스냅샷 (완성 목록은 불변 취급이라 참조만 보관) */
    const historyRef = useRef<NoteStroke[][]>([])
    const currentRef = useRef<Ink | null>(null)
    /** 이번 지우개 제스처에서 획을 지웠는가 — 스냅샷은 첫 삭제 때 1회, 통지는 손 뗄 때 1회 */
    const erasedRef = useRef(false)
    const rafRef = useRef<number | null>(null)
    const drawingRef = useRef<boolean>(false)
    // 레이저 stroke · 그린 후 자동 fade out 되는 임시 stroke (base 저장 안 함)
    // 개별 타이머 없이 배열 · 페이드 시점은 아래 laserActivityEndRef 로 공유 관리
    const fadingLasersRef = useRef<Ink[]>([])
    // 마지막 레이저 stroke 가 완료된 시각 (ms).
    // null = 레이저 그리는 중 · 그 외 = 이 시각 기준으로 HOLD → FADE 진행 · 새 레이저 시작 시 null 로 리셋
    // → 그리는 중엔 사라지지 않고, 손 뗀 후 전부 함께 페이드
    const laserActivityEndRef = useRef<number | null>(null)
    const LASER_HOLD_MS = 500 // 완전 노출 시간
    const LASER_FADE_MS = 400 // fade out 시간 (iPad · PC 공통 · 부드럽게)

    // 현재 옵션은 pointerdown 시점 값을 캡처하기 위해 ref 로도 보관
    const toolRef = useRef(tool)
    const colorRef = useRef(color)
    const sizeRef = useRef(size)
    useEffect(() => void (toolRef.current = tool), [tool])
    useEffect(() => void (colorRef.current = color), [color])
    useEffect(() => void (sizeRef.current = size), [size])
    const eraserModeRef = useRef(eraserMode)
    useEffect(() => void (eraserModeRef.current = eraserMode), [eraserMode])
    const onStrokesChangeRef = useRef(onStrokesChange)
    const onContentHeightRef = useRef(onContentHeight)
    useEffect(() => void (onStrokesChangeRef.current = onStrokesChange), [onStrokesChange])
    useEffect(() => void (onContentHeightRef.current = onContentHeight), [onContentHeight])

    /** 획이 차지하는 세로 끝을 화면 px 로 보고 — 배율(폭)이나 목록이 바뀔 때마다 */
    const reportContentHeight = () => {
      onContentHeightRef.current?.(Math.ceil(noteBottom(strokesRef.current) * scaleRef.current))
    }

    const pushHistory = () => {
      const history = historyRef.current
      history.push(strokesRef.current)
      if (history.length > MAX_HISTORY) history.shift()
    }

    /** 완성 획 목록 교체 (사용자 편집 결과) — 렌더 · 부모 통지 · 높이 보고 */
    const applyStrokes = (next: NoteStroke[], rebuild: boolean) => {
      strokesRef.current = next
      if (rebuild) rebuildBase()
      onStrokesChangeRef.current?.(next)
      reportContentHeight()
    }

    /** 편집 커밋 — 되돌리기 스냅샷을 남기고 교체 */
    const commit = (next: NoteStroke[], rebuild = true) => {
      pushHistory()
      applyStrokes(next, rebuild)
    }

    useImperativeHandle(ref, () => ({
      clear: () => {
        currentRef.current = null
        if (strokesRef.current.length === 0) return
        commit([])
        renderLive()
      },
      undo: () => {
        const prev = historyRef.current.pop()
        if (!prev) return
        applyStrokes(prev, true)
        renderLive()
      },
      setStrokes: (strokes) => {
        historyRef.current = []
        currentRef.current = null
        strokesRef.current = strokes
        rebuildBase()
        renderLive()
        reportContentHeight()
      },
    }))

    // 초기화 · 리사이즈 — 두 레이어를 같은 크기로 맞추고 base 를 재래스터
    useEffect(() => {
      const baseCanvas = baseCanvasRef.current
      const liveCanvas = liveCanvasRef.current
      const container = containerRef.current
      if (!baseCanvas || !liveCanvas || !container) return

      const resize = () => {
        // 본문(ExamScaleFrame)과 같은 정수 clientWidth 로 배율을 잡는다 — getBoundingClientRect 의
        // 소수 폭을 쓰면 최대 0.5px 차 → 배율 0.1% 차 → 긴 페이지 아래쪽에서 필기가 본문과 어긋난다
        const width = container.clientWidth
        const height = container.clientHeight
        const dpr = window.devicePixelRatio || 1
        scaleRef.current = width > 0 ? width / base : 1

        for (const canvas of [baseCanvas, liveCanvas]) {
          canvas.width = Math.round(width * dpr)
          canvas.height = Math.round(height * dpr)
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
          }
        }

        rebuildBase()
        renderLive()
        reportContentHeight()
      }

      resize()
      const observer = new ResizeObserver(resize)
      observer.observe(container)
      return () => {
        observer.disconnect()
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [base])

    /** base 컨텍스트를 월드 → 디바이스 변환으로 맞춰 반환 */
    const baseCtx = () => {
      const canvas = baseCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return null
      const k = (window.devicePixelRatio || 1) * scaleRef.current
      ctx.setTransform(k, 0, 0, k, 0, 0)
      return ctx
    }

    /**
     * base 캔버스에 완성 stroke 를 전부 다시 그림.
     * undo · clear · resize · 지우개 삭제에서만 호출 · 그리기 루프에서는 사용 X.
     */
    const rebuildBase = () => {
      const canvas = baseCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const bctx = baseCtx()
      if (!bctx) return
      for (const s of strokesRef.current) {
        renderInk(bctx, s.type, s.color, s.width, s.points, 1, true)
      }
    }

    /**
     * 매 프레임 live 레이어 갱신 — 진행 중 stroke 와 레이저만.
     * base(완성 잉크)는 여기서 절대 건드리지 않는다.
     * 지우개는 포인터 이벤트에서 목록을 고치고 base 를 재구성하므로 여기 그릴 게 없다.
     */
    const renderLive = () => {
      rafRef.current = null
      const canvas = liveCanvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      const dpr = window.devicePixelRatio || 1
      const drawScale = dpr * scaleRef.current
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 레이저 stroke 공유 페이드 로직:
      // - laserActivityEndRef = null → 새 레이저 그리는 중 · 전부 full opacity 유지
      // - laserActivityEndRef = 마지막 완료 시각 → 그 시각부터 HOLD 후 FADE_MS 동안 함께 사라짐
      // → "그리는 동안 안 사라지고, 손 뗀 후 동시에 서서히 사라짐" 동작
      const now = Date.now()
      if (fadingLasersRef.current.length > 0) {
        const activityEnd = laserActivityEndRef.current
        let opacity = 1
        let expired = false
        if (activityEnd != null) {
          const elapsed = now - activityEnd
          if (elapsed > LASER_HOLD_MS + LASER_FADE_MS) {
            expired = true
          } else if (elapsed > LASER_HOLD_MS) {
            opacity = Math.max(0, 1 - (elapsed - LASER_HOLD_MS) / LASER_FADE_MS)
          }
        }
        if (expired) {
          fadingLasersRef.current = []
          laserActivityEndRef.current = null
        } else if (opacity > 0) {
          ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0)
          for (const s of fadingLasersRef.current) {
            renderInk(ctx, s.tool, s.color, s.width, s.points, opacity)
          }
        }
      }

      // 진행 중 stroke (지우개 제외)
      const cur = currentRef.current
      if (cur && cur.tool !== 'eraser') {
        ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0)
        renderInk(ctx, cur.tool, cur.color, cur.width, cur.points, 1)
      }

      // 그리는 중이거나 페이드 중인 레이저가 있으면 다음 프레임 예약
      if (drawingRef.current || fadingLasersRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(renderLive)
      }
    }

    /**
     * perfect-freehand outline 을 SVG path 로 변환해 Path2D 로 그림.
     * lineTo 반복보다 훨씬 부드럽고 안티앨리어싱이 잘 적용됨.
     *
     * opacity 는 레이저 fade 를 위한 값 (0~1). rgba 알파에 직접 곱해 적용 →
     * iPad Safari 의 globalAlpha × shadowBlur 조합 렌더링 이슈 우회.
     */
    const renderInk = (
      ctx: CanvasRenderingContext2D,
      tool: StrokeTool,
      color: string,
      width: number,
      points: number[][],
      opacity: number = 1,
      complete: boolean = false,
    ) => {
      if (points.length === 0) return
      if (opacity <= 0) return

      if (tool === 'laser') {
        // 네온 레이저 튜브 효과:
        //  1) 큰 외곽선 (원본 크기) · 진한 빨강 fill + 큰 shadowBlur → 빨간 링 + halo
        //  2) 작은 외곽선 (약 40% 크기) · 흰색 fill → 중앙 white core
        // getStroke 를 두 번 호출해 크기 다른 outline 두 개 확보
        const baseOptions = strokeOptions(width, complete)
        const outerOutline = getStroke(points, baseOptions)
        const innerOutline = getStroke(points, {
          ...baseOptions,
          size: baseOptions.size * 0.4,
        })
        if (outerOutline.length < 2) return
        const outerPath = new Path2D(getSvgPathFromStroke(outerOutline))
        const innerPath =
          innerOutline.length >= 2
            ? new Path2D(getSvgPathFromStroke(innerOutline))
            : null

        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        // 1) 빨간 링 + halo · shadowBlur 로 부드러운 발광
        // (shadowBlur 는 transform 을 안 타는 디바이스 px — 배율을 직접 곱해 비율 유지)
        ctx.shadowColor = `rgba(255, 30, 55, ${0.9 * opacity})`
        ctx.shadowBlur = 18 * scaleRef.current
        ctx.fillStyle = `rgba(230, 25, 50, ${opacity})`
        ctx.fill(outerPath)
        // 2) 흰 코어 · shadow off · 살짝 붉은 기 남은 흰색
        if (innerPath) {
          ctx.shadowBlur = 0
          ctx.fillStyle = `rgba(255, 240, 240, ${opacity})`
          ctx.fill(innerPath)
        }
        ctx.restore()
        return
      }

      const outline = getStroke(points, strokeOptions(width, complete))
      if (outline.length < 2) return
      const path = new Path2D(getSvgPathFromStroke(outline))

      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = color
      ctx.globalAlpha = tool === 'marker' ? 0.32 : 1
      ctx.fill(path)
      ctx.restore()
    }

    /**
     * perfect-freehand 옵션 — 굵기는 획에 박제된 조판 px(width) 그대로 (배율은 ctx transform 이 곱한다).
     * 굵기는 압력과 무관하게 일정 (thinning: 0).
     *
     * complete(last) — 완성 획은 마지막 점을 정확히 찍는다. streamline 은 점마다 이전 점 쪽으로 60% 끌어당기므로
     * last=false 면 렌더 끝이 기하 끝보다 마지막 점 간격의 약 0.6배 뒤에서 멈춘다. 촘촘한 획에선 1~2px 이지만
     * 빠른 획·잘린 조각(마지막 구간이 길다)에선 수십 px 이 비어 보여 "지우개보다 크게 잘림", 그 보이지 않는
     * 꼬리를 다시 지우면 끝이 앞으로 튀어나오는 "지우는 중 획이 길어짐" 으로 나타났다 (2026-09-02).
     * 그리는 중(live)은 false — 끝점을 고정하면 새 점이 올 때마다 꼬리가 되돌아가 떨린다.
     */
    const strokeOptions = (width: number, complete = false) => ({
      size: Math.max(0.5, width),
      thinning: 0,
      smoothing: 0.65,
      streamline: 0.7,
      last: complete,
    })

    /** 포인터 화면 좌표 → 월드 좌표 (배율 나눔) */
    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): number[] => {
      const rect = liveCanvasRef.current!.getBoundingClientRect()
      const k = scaleRef.current || 1
      return [(e.clientX - rect.left) / k, (e.clientY - rect.top) / k]
    }

    /**
     * 지우개 선분(이전 점 → 새 점, 반지름 r)을 완성 획에 적용.
     * - 전체(stroke): 겹치는 획을 통째로 뺀다
     * - 일부(partial): 겹치는 구간만 잘라내고 남은 조각을 새 획으로 (cutStroke)
     * 되돌리기 스냅샷은 제스처 안의 첫 변경 때 1회 · 부모 통지는 손 뗄 때(handlePointerUp) 1회.
     */
    const eraseAlong = (ax: number, ay: number, bx: number, by: number, r: number) => {
      const before = strokesRef.current
      const partial = eraserModeRef.current === 'partial'
      const after: NoteStroke[] = []
      let changed = false
      for (const s of before) {
        if (partial) {
          const pieces = cutStroke(s, ax, ay, bx, by, r)
          if (pieces === null) after.push(s)
          else {
            changed = true
            after.push(...pieces)
          }
        } else if (strokeHitsEraser(s, ax, ay, bx, by, r)) {
          changed = true
        } else {
          after.push(s)
        }
      }
      if (!changed) return
      if (!erasedRef.current) {
        pushHistory()
        erasedRef.current = true
      }
      strokesRef.current = after
      rebuildBase()
    }

    /**
     * 지우개 도구 활성 시 포인터 따라다니는 원형 커서 위치·표시 갱신.
     * ref 조작으로 리렌더 없이 매끄러운 tracking.
     * 지름 = 지금 그으면 지워질 실제 폭 (조판 px × 배율 → 화면 px · toolWidth 공유)
     */
    const updateEraserCursor = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (toolRef.current !== 'eraser') return
      const el = eraserCursorRef.current
      const canvas = liveCanvasRef.current
      if (!el || !canvas) return
      const rect = canvas.getBoundingClientRect()
      const diameter = Math.max(6, toolWidth('eraser', sizeRef.current) * (scaleRef.current || 1))
      el.style.width = `${diameter}px`
      el.style.height = `${diameter}px`
      el.style.left = `${e.clientX - rect.left}px`
      el.style.top = `${e.clientY - rect.top}px`
      el.style.opacity = '1'
    }
    const hideEraserCursor = () => {
      const el = eraserCursorRef.current
      if (el) el.style.opacity = '0'
    }

    const shouldAcceptPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return false
      if (e.pointerType === 'mouse') {
        // pointerdown 은 e.button 으로 왼쪽 클릭만 허용
        // pointermove/up 은 e.button === -1/0 이 되므로 조건 못 통과 → drag 중 새 점 안 들어오는 버그
        // → pointerdown 만 button 체크 · move/up 은 이미 down 필터 통과한 상태이므로 통과
        return e.type !== 'pointerdown' || e.button === 0
      }
      if (e.pointerType === 'pen') return true
      if (e.pointerType === 'touch') return allowFinger
      return false
    }

    /**
     * 펜 감지 — Apple Pencil 호버(M2+ iPad)는 CSS cursor 를 화면에 띄우는데,
     * 글씨를 쓰는 동안 획 사이마다 호버 커서(십자선)가 나타났다 사라지며 깜빡인다.
     * 펜은 촉 자체가 포인터라 커서가 필요 없다 — 펜이 한 번이라도 감지되면 숨긴다.
     * (호버도 pointermove 로 오므로 첫 호버 순간 바로 사라진다 · 마우스는 십자선 유지)
     */
    const [penSeen, setPenSeen] = useState(false)
    const notePen = (e: React.PointerEvent) => {
      if (!penSeen && e.pointerType === 'pen') setPenSeen(true)
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      notePen(e)
      updateEraserCursor(e)
      if (!shouldAcceptPointer(e)) return
      e.preventDefault()
      e.stopPropagation()
      liveCanvasRef.current?.setPointerCapture(e.pointerId)
      const t = toolRef.current
      const k = scaleRef.current || 1
      const [x, y] = getPoint(e)
      const ink: Ink = {
        points: [[x, y]],
        tool: t,
        color: colorRef.current,
        // 굵기는 조판 px 그대로 박제 — 배율이 바뀌어도 본문과 같은 비율로 커지고 줄어든다.
        // 레이저만 화면 px 고정 (포인터 효과)
        width: t === 'laser' ? toolWidth(t, sizeRef.current) / k : toolWidth(t, sizeRef.current),
      }
      currentRef.current = ink
      drawingRef.current = true
      // 레이저 새 stroke 시작 → 공유 페이드 타이머 리셋
      // 페이드 중이던 이전 레이저 stroke 들도 다시 full opacity 로 복구됨
      if (t === 'laser') {
        laserActivityEndRef.current = null
      }
      if (t === 'eraser') {
        erasedRef.current = false
        eraseAlong(x, y, x, y, ink.width / 2) // 탭만 해도 그 자리의 획은 지운다
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(renderLive)
      }
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      notePen(e)
      // 드로잉 중이 아니어도 지우개 커서 위치는 항상 tracking
      updateEraserCursor(e)
      const cur = currentRef.current
      if (!cur) return
      if (!shouldAcceptPointer(e)) return
      e.preventDefault()
      // getCoalescedEvents 로 놓친 점까지 수집 → 곡선 정밀도 향상.
      // WebKit(iPad Safari)은 펜 입력에서 이 목록을 간헐적으로 비워 반환한다 —
      // 그대로 쓰면 이동점이 전부 버려져 획이 점·토막으로 끊긴다. 비면 원 이벤트로 폴백.
      const coalesced =
        typeof e.nativeEvent.getCoalescedEvents === 'function'
          ? e.nativeEvent.getCoalescedEvents()
          : null
      const events = coalesced && coalesced.length > 0 ? coalesced : [e.nativeEvent]
      const rect = liveCanvasRef.current!.getBoundingClientRect()
      const k = scaleRef.current || 1
      /**
       * 최소 이동 게이트 — 마지막 채택점에서 INPUT_GATE_PX(화면 px) 미만 이동은 버린다.
       * 펜은 속도와 무관하게 초당 120~240회 리포트하므로, 느리게 움직이면 리포트당
       * 이동(0.2~0.5px)이 손떨림·센서 노이즈(±0.5px+)보다 작아져 노이즈가 획 모양을
       * 지배한다 — 저속에서만 획이 꾸물거리는 원인. 게이트는 저속 노이즈만 걸러내고
       * 보통 속도(이동 ≫ 게이트)에는 아무 영향이 없다.
       */
      const pts = cur.points
      const gate = INPUT_GATE_PX / k
      const gateSq = gate * gate
      const eraserRadius = cur.tool === 'eraser' ? cur.width / 2 : 0
      let [lx, ly] = pts[pts.length - 1]
      for (const ev of events) {
        const x = (ev.clientX - rect.left) / k
        const y = (ev.clientY - rect.top) / k
        const dx = x - lx
        const dy = y - ly
        if (dx * dx + dy * dy < gateSq) continue
        pts.push([x, y])
        if (cur.tool === 'eraser') eraseAlong(lx, ly, x, y, eraserRadius)
        lx = x
        ly = y
      }
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!currentRef.current) return
      liveCanvasRef.current?.releasePointerCapture(e.pointerId)
      const s = currentRef.current
      // 획 끝점 보정 — 게이트에 걸려 못 들어간 마지막 위치를 채워 펜을 뗀 자리에서 끝나게
      {
        const rect = liveCanvasRef.current!.getBoundingClientRect()
        const k = scaleRef.current || 1
        const x = (e.clientX - rect.left) / k
        const y = (e.clientY - rect.top) / k
        const [lx, ly] = s.points[s.points.length - 1]
        const half = (INPUT_GATE_PX / k) * 0.5
        if ((x - lx) ** 2 + (y - ly) ** 2 > half * half) {
          s.points.push([x, y])
          if (s.tool === 'eraser') eraseAlong(lx, ly, x, y, s.width / 2)
        }
      }
      if (s.tool === 'laser') {
        // 레이저 · base 저장 안 함 · fadingLasers 에 누적
        // 공유 타이머 시작 → 이후 다른 레이저 stroke 안 그리면 HOLD 후 함께 페이드
        fadingLasersRef.current.push(s)
        laserActivityEndRef.current = Date.now()
        // undo 대상에서도 제외
      } else if (s.tool === 'eraser') {
        // 지운 결과는 목록 변경으로 남는다 — 지운 게 있을 때만 부모에 통지 (스냅샷은 eraseAlong 이 남김)
        if (erasedRef.current) applyStrokes(strokesRef.current, false)
      } else {
        // 일반 stroke · base 에 이 획만 그려 박제 (전체 재구성 없음) 후 목록에 추가
        const stroke: NoteStroke = {
          id: newStrokeId(),
          type: s.tool,
          color: s.color,
          width: s.width,
          rect: strokeRect(s.points, s.width),
          points: s.points,
        }
        const bctx = baseCtx()
        if (bctx) renderInk(bctx, stroke.type, stroke.color, stroke.width, stroke.points, 1, true)
        commit([...strokesRef.current, stroke], false)
      }
      currentRef.current = null
      drawingRef.current = false
      // live 를 동기로 비운다 — 커밋(base)과 다음 rAF 사이에 한 프레임이라도 양쪽에
      // 같은 획이 보이면 형광펜(알파 0.32)이 겹쳐 진해 보인다. 레이저 페이드가 남아
      // 있으면 renderLive 가 이어서 스케줄한다.
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      renderLive()
    }

    const suppressContext = (e: React.SyntheticEvent) => e.preventDefault()

    const cursorStyle = disabled
      ? 'default'
      : tool === 'eraser' || penSeen
        ? 'none' // 지우개는 원형 오버레이로 대체 · 펜은 촉이 포인터 (호버 커서 깜빡임 방지)
        : 'crosshair'

    return (
      <div ref={containerRef} className={styles.container}>
        {/* Layer A — 완성 잉크. 포인터는 위 레이어가 받는다 */}
        <canvas ref={baseCanvasRef} className={styles.canvas} style={{ pointerEvents: 'none' }} />
        {/* Layer B — 진행 중 획 · 레이저 · 포인터 수신 */}
        <canvas
          ref={liveCanvasRef}
          className={styles.canvas}
          // 비활성(모바일 등) — 터치를 아래 본문으로 통과시켜 페이지 스크롤이 살아있게 한다.
          // touch-action:none 이 남아 있으면 캔버스가 덮은 영역 전체에서 스크롤이 죽는다
          style={{
            cursor: cursorStyle,
            ...(disabled ? { pointerEvents: 'none' as const, touchAction: 'auto' } : {}),
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={hideEraserCursor}
          onContextMenu={suppressContext}
        />
        {/* 지우개 원형 커서 오버레이 · 포인터 따라 이동 · translate 로 중앙 정렬 · 크기는 이동 때 배율 반영 */}
        {tool === 'eraser' && !disabled && (
          <div
            ref={eraserCursorRef}
            aria-hidden
            className={styles.eraserCursor}
            style={{ left: 0, top: 0 }}
          />
        )}
      </div>
    )
  },
)

/**
 * perfect-freehand outline 을 SVG path 문자열로.
 * 각 점 사이를 quadratic Bezier 로 연결 → 부드러운 곡선.
 */
function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) return ''
  const d: (string | number)[] = ['M', stroke[0][0], stroke[0][1], 'Q']
  for (let i = 0; i < stroke.length - 1; i++) {
    const [x0, y0] = stroke[i]
    const [x1, y1] = stroke[i + 1]
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  d.push('Z')
  return d.join(' ')
}

/* --- 지우개 판정 (월드 좌표) --- */

/**
 * 넓은 판정 — 지우개 선분(a→b)의 bbox 를 반지름만큼 넓힌 것과 획 rect(굵기 반영)가 안 겹치면 볼 필요 없다.
 * 지우개가 어느 모드든 이걸로 먼저 거른다.
 */
function eraserMissesRect(
  rect: NoteStroke['rect'],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
): boolean {
  const [rx, ry, rw, rh] = rect
  return (
    Math.max(ax, bx) + r < rx ||
    Math.min(ax, bx) - r > rx + rw ||
    Math.max(ay, by) + r < ry ||
    Math.min(ay, by) - r > ry + rh
  )
}

/**
 * 전체 모드 — 지우개가 지나간 선분(a→b · 반지름 r)과 획의 선분들 사이 거리가 r + 굵기/2 이하면 겹친 것.
 * 선분끼리 거리를 잰다 — 빠르게 그은 획은 점 간격이 넓어 점만 검사하면 그 사이를 지나간 지우개를 놓친다.
 */
function strokeHitsEraser(
  s: NoteStroke,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
): boolean {
  if (eraserMissesRect(s.rect, ax, ay, bx, by, r)) return false
  const limit = r + s.width / 2
  const limitSq = limit * limit
  const pts = s.points
  if (pts.length === 1) return pointSegDistSq(pts[0][0], pts[0][1], ax, ay, bx, by) <= limitSq
  for (let i = 0; i < pts.length - 1; i++) {
    const [px, py] = pts[i]
    const [qx, qy] = pts[i + 1]
    if (segDistSq(px, py, qx, qy, ax, ay, bx, by) <= limitSq) return true
  }
  return false
}

/** 조각으로 남기지 않는 길이 — 굵기 절반보다 짧은 토막은 지우개 가장자리의 부스러기로 보인다 */
const MIN_PIECE_LENGTH_RATIO = 0.5

/**
 * 일부 모드 — 지우개 캡슐(선분 a→b · 반지름 r)이 덮는 구간을 획에서 잘라내고 남은 조각을 돌려준다.
 * 안 닿았으면 null · 전부 지워졌으면 []. 조각은 새 id 를 받고 rect 를 다시 계산한다.
 *
 * 점을 지우는 게 아니라 선분을 자른다 — 각 선분에서 캡슐 안에 드는 파라미터 구간을 정확히 구해
 * (capsuleInterval) 경계에 보간점을 넣는다. 그래서 점이 성긴(빠르게 그은) 획도 지나간 자리만큼만 잘리고,
 * 잘린 끝의 둥근 캡이 정확히 지우개 가장자리에서 끝난다 (판정 반지름 = r + 굵기/2).
 */
function cutStroke(
  s: NoteStroke,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
): NoteStroke[] | null {
  if (eraserMissesRect(s.rect, ax, ay, bx, by, r)) return null
  const reach = r + s.width / 2
  const pts = s.points
  if (pts.length === 1) {
    return pointSegDistSq(pts[0][0], pts[0][1], ax, ay, bx, by) <= reach * reach ? [] : null
  }

  // 지워지는 구간 — 획 전체 파라미터 u = 선분 번호 + 선분 안 t 로 모으고 이어지는 구간은 합친다
  const cut: [number, number][] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const iv = capsuleInterval(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ax, ay, bx, by, reach)
    if (!iv) continue
    const lo = i + iv[0]
    const hi = i + iv[1]
    const last = cut[cut.length - 1]
    if (last && lo <= last[1] + 1e-9) last[1] = Math.max(last[1], hi)
    else cut.push([lo, hi])
  }
  if (cut.length === 0) return null

  const at = (u: number): number[] => {
    const i = Math.floor(u)
    if (i >= pts.length - 1) return pts[pts.length - 1]
    const t = u - i
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]
  }
  const pieces: NoteStroke[] = []
  const keep = (from: number, to: number) => {
    if (to - from < 1e-6) return
    const out: number[][] = [at(from)]
    for (let j = Math.floor(from) + 1; j < to; j++) out.push(pts[j])
    out.push(at(to))
    if (polylineLength(out) < s.width * MIN_PIECE_LENGTH_RATIO) return
    pieces.push({
      id: newStrokeId(),
      type: s.type,
      color: s.color,
      width: s.width,
      rect: strokeRect(out, s.width),
      points: out,
    })
  }
  let from = 0
  for (const [lo, hi] of cut) {
    keep(from, lo)
    from = hi
  }
  keep(from, pts.length - 1)
  return pieces
}

function polylineLength(pts: number[][]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return len
}

/**
 * 선분 p→q(파라미터 t∈[0,1]) 가 캡슐(선분 a→b 에서 거리 R 이내) 안에 드는 t 구간 · 없으면 null.
 * 캡슐 = 원(a) ∪ 원(b) ∪ 직사각형(a→b 방향 · 폭 2R). 볼록한 캡슐과 직선의 교집합은 구간 하나라
 * 세 영역의 구간을 각각 구해 합치면(최소~최대) 된다.
 */
function capsuleInterval(
  px: number,
  py: number,
  qx: number,
  qy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  R: number,
): [number, number] | null {
  const dx = qx - px
  const dy = qy - py
  let lo = Infinity
  let hi = -Infinity
  const take = (iv: [number, number] | null) => {
    if (!iv) return
    if (iv[0] < lo) lo = iv[0]
    if (iv[1] > hi) hi = iv[1]
  }
  take(diskInterval(px, py, dx, dy, ax, ay, R))
  const ux = bx - ax
  const uy = by - ay
  const len2 = ux * ux + uy * uy
  if (len2 > 0) {
    take(diskInterval(px, py, dx, dy, bx, by, R))
    // 직사각형: a→b 방향 투영이 [0, |ab|] 안이고 수직 거리가 R 이하 — 둘 다 t 에 대해 1차식
    // (투영은 |ab| 배, 수직 거리는 |ab| 배 스케일된 값으로 비교해 나눗셈을 피한다)
    const ex = px - ax
    const ey = py - ay
    const along = linearInterval(ex * ux + ey * uy, dx * ux + dy * uy, 0, len2)
    const rl = R * Math.sqrt(len2)
    const across = linearInterval(ex * uy - ey * ux, dx * uy - dy * ux, -rl, rl)
    if (along && across) {
      const l = Math.max(along[0], across[0])
      const h = Math.min(along[1], across[1])
      if (l <= h) take([l, h])
    }
  }
  if (lo > hi) return null
  lo = Math.max(0, lo)
  hi = Math.min(1, hi)
  return lo <= hi ? [lo, hi] : null
}

/** |p + t·d − c| ≤ R 인 t 구간 (2차 부등식) · 없으면 null */
function diskInterval(
  px: number,
  py: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  R: number,
): [number, number] | null {
  const ex = px - cx
  const ey = py - cy
  const a = dx * dx + dy * dy
  const b = ex * dx + ey * dy
  const c = ex * ex + ey * ey - R * R
  if (a === 0) return c <= 0 ? [-Infinity, Infinity] : null
  const disc = b * b - a * c
  if (disc < 0) return null
  const sq = Math.sqrt(disc)
  return [(-b - sq) / a, (-b + sq) / a]
}

/** min ≤ c0 + c1·t ≤ max 인 t 구간 · 없으면 null */
function linearInterval(c0: number, c1: number, min: number, max: number): [number, number] | null {
  if (c1 === 0) return c0 >= min && c0 <= max ? [-Infinity, Infinity] : null
  const t1 = (min - c0) / c1
  const t2 = (max - c0) / c1
  return t1 <= t2 ? [t1, t2] : [t2, t1]
}

/** 점 p 와 선분 ab 의 거리² */
function pointSegDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const qx = ax + t * dx
  const qy = ay + t * dy
  return (px - qx) * (px - qx) + (py - qy) * (py - qy)
}

/** 선분 ab 와 cd 의 거리² — 교차하면 0, 아니면 끝점→상대 선분 거리 4개의 최소 */
function segDistSq(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number {
  const o1 = orient(ax, ay, bx, by, cx, cy)
  const o2 = orient(ax, ay, bx, by, dx, dy)
  const o3 = orient(cx, cy, dx, dy, ax, ay)
  const o4 = orient(cx, cy, dx, dy, bx, by)
  // 엄밀 교차 — 끝점이 닿거나 겹치는(공선) 경우는 아래 끝점 거리 0 으로 잡힌다
  if (o1 * o2 < 0 && o3 * o4 < 0) return 0
  return Math.min(
    pointSegDistSq(ax, ay, cx, cy, dx, dy),
    pointSegDistSq(bx, by, cx, cy, dx, dy),
    pointSegDistSq(cx, cy, ax, ay, bx, by),
    pointSegDistSq(dx, dy, ax, ay, bx, by),
  )
}

const orient = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
  (bx - ax) * (py - ay) - (by - ay) * (px - ax)

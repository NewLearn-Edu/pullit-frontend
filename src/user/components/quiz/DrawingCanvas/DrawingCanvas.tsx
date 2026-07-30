import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { getStroke } from 'perfect-freehand'
import styles from './styles/DrawingCanvas.module.scss'

export type StrokeTool = 'pen' | 'highlighter' | 'eraser' | 'laser'

export interface DrawingCanvasHandle {
  clear: () => void
  undo: () => void
}

interface Stroke {
  points: number[][] // [x, y] (pressure 는 균일 굵기라 사용 안 함)
  tool: StrokeTool
  color: string
  size: number
}

interface DrawingCanvasProps {
  tool: StrokeTool
  color: string
  size: number
  disabled?: boolean
  allowFinger?: boolean
}

/**
 * 필기 캔버스 — 오프스크린 2-레이어 방식.
 *
 * Layer 1 · Offscreen canvas
 *   - 완성된 stroke 를 픽셀로 박제. undo · clear · resize 때만 재구성.
 * Layer 2 · Main canvas (사용자에게 보임)
 *   - 매 프레임 offscreen 을 drawImage 복사 후 현재 그리는 stroke 만 그림.
 *   - 겹침 누적 · 지글거림 없음.
 *
 * perfect-freehand 옵션도 튜닝 · SVG path 스타일로 렌더링해 계단현상 최소화.
 * 정책상 필기 저장 안 함. 문제 넘기면 자연 소실.
 */
export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    { tool, color, size, disabled, allowFinger = false },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    // 완성된 stroke 를 담아두는 오프스크린 캔버스 (사용자에게 안 보임)
    const offscreenRef = useRef<HTMLCanvasElement | null>(null)
    // 지우개 도구 사용 시 포인터 위치 · 크기를 미리 보여주는 원형 커서 오버레이
    const eraserCursorRef = useRef<HTMLDivElement>(null)

    const strokesRef = useRef<Stroke[]>([])
    const currentRef = useRef<Stroke | null>(null)
    const rafRef = useRef<number | null>(null)
    const drawingRef = useRef<boolean>(false)
    // 레이저 stroke · 그린 후 자동 fade out 되는 임시 stroke (offscreen 저장 안 함)
    // 개별 타이머 없이 배열 · 페이드 시점은 아래 laserActivityEndRef 로 공유 관리
    const fadingLasersRef = useRef<Stroke[]>([])
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

    useImperativeHandle(ref, () => ({
      clear: () => {
        strokesRef.current = []
        currentRef.current = null
        rebuildOffscreen()
        blitToMain()
      },
      undo: () => {
        strokesRef.current = strokesRef.current.slice(0, -1)
        rebuildOffscreen()
        blitToMain()
      },
    }))

    // 초기화 · 리사이즈
    useEffect(() => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const resize = () => {
        const rect = container.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1

        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
        }

        // 오프스크린도 같이 리사이즈
        if (!offscreenRef.current) {
          offscreenRef.current = document.createElement('canvas')
        }
        const off = offscreenRef.current
        off.width = canvas.width
        off.height = canvas.height
        const offCtx = off.getContext('2d')
        if (offCtx) {
          offCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
          offCtx.imageSmoothingEnabled = true
          offCtx.imageSmoothingQuality = 'high'
        }

        rebuildOffscreen()
        blitToMain()
      }

      resize()
      const observer = new ResizeObserver(resize)
      observer.observe(container)
      return () => {
        observer.disconnect()
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /**
     * 오프스크린 캔버스에 완성된 stroke 를 전부 다시 그림.
     * undo · clear · resize 에서만 호출 · 그리기 루프에서는 사용 X.
     */
    const rebuildOffscreen = () => {
      const off = offscreenRef.current
      const canvas = canvasRef.current
      if (!off || !canvas) return
      const ctx = off.getContext('2d')
      if (!ctx) return
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)
      for (const s of strokesRef.current) {
        renderStroke(ctx, s)
      }
    }

    /**
     * 매 프레임 표시 캔버스 갱신:
     * 1) offscreen (완성 stroke) 복사
     * 2) 페이드 중인 레이저 stroke 를 opacity 로 겹쳐 그림
     * 3) 현재 그리는 stroke 위에 얹기
     */
    const blitToMain = () => {
      rafRef.current = null
      const canvas = canvasRef.current
      const off = offscreenRef.current
      if (!canvas || !off) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 표시 캔버스는 dpr 스케일이 적용된 상태 · offscreen 을 dpr 픽셀 그대로 복사
      const dpr = window.devicePixelRatio || 1
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(off, 0, 0)
      ctx.restore()

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
            opacity = Math.max(
              0,
              1 - (elapsed - LASER_HOLD_MS) / LASER_FADE_MS,
            )
          }
        }
        if (expired) {
          fadingLasersRef.current = []
          laserActivityEndRef.current = null
        } else if (opacity > 0) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          for (const s of fadingLasersRef.current) {
            renderStroke(ctx, s, opacity)
          }
        }
      }

      // 현재 stroke 는 dpr 스케일 컨텍스트에서 그림
      const cur = currentRef.current
      if (cur) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        renderStroke(ctx, cur, 1)
      }

      // 그리는 중이거나 페이드 중인 레이저가 있으면 다음 프레임 예약
      if (drawingRef.current || fadingLasersRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(blitToMain)
      }
    }

    /**
     * perfect-freehand outline 을 SVG path 로 변환해 Path2D 로 그림.
     * lineTo 반복보다 훨씬 부드럽고 안티앨리어싱이 잘 적용됨.
     *
     * opacity 는 레이저 fade 를 위한 값 (0~1). rgba 알파에 직접 곱해 적용 →
     * iPad Safari 의 globalAlpha × shadowBlur 조합 렌더링 이슈 우회.
     */
    const renderStroke = (
      ctx: CanvasRenderingContext2D,
      s: Stroke,
      opacity: number = 1,
    ) => {
      if (s.points.length === 0) return
      if (opacity <= 0) return

      if (s.tool === 'laser') {
        // 네온 레이저 튜브 효과:
        //  1) 큰 외곽선 (원본 크기) · 진한 빨강 fill + 큰 shadowBlur → 빨간 링 + halo
        //  2) 작은 외곽선 (약 40% 크기) · 흰색 fill → 중앙 white core
        // getStroke 를 두 번 호출해 크기 다른 outline 두 개 확보
        const baseOptions = strokeOptionsFor(s)
        const outerOutline = getStroke(s.points, baseOptions)
        const innerOutline = getStroke(s.points, {
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
        ctx.shadowColor = `rgba(255, 30, 55, ${0.9 * opacity})`
        ctx.shadowBlur = 18
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

      const outline = getStroke(s.points, strokeOptionsFor(s))
      if (outline.length < 2) return
      const path = new Path2D(getSvgPathFromStroke(outline))

      ctx.save()
      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = '#000'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = s.color
        ctx.globalAlpha = s.tool === 'highlighter' ? 0.32 : 1
      }
      ctx.fill(path)
      ctx.restore()
    }

    /**
     * perfect-freehand 옵션.
     * s.size 는 사용자 슬라이더 값 (0.1 ~ 1.0). 도구별로 실제 픽셀 크기가 다름.
     * - 펜/지우개: size × 14  (0.1 = 1.4px · 1.0 = 14px)
     * - 형광펜:    size × 32  (0.1 = 3.2px · 1.0 = 32px)
     * 굵기는 압력과 무관하게 일정 (thinning: 0).
     */
    const strokeOptionsFor = (s: Stroke) => {
      let px: number
      if (s.tool === 'laser') {
        px = 9 // 레이저 · 슬라이더 무시 · 네온 링+코어 구조 잘 보이게 다소 굵게
      } else if (s.tool === 'highlighter') {
        px = s.size * 32
      } else {
        px = s.size * 14
      }
      return {
        size: Math.max(1, px),
        thinning: 0,
        smoothing: 0.65,
        streamline: 0.7,
      }
    }

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): number[] => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return [e.clientX - rect.left, e.clientY - rect.top]
    }

    /**
     * 지우개 도구 활성 시 포인터 따라다니는 원형 커서 위치·표시 갱신.
     * ref 조작으로 리렌더 없이 매끄러운 tracking.
     */
    const updateEraserCursor = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (toolRef.current !== 'eraser') return
      const el = eraserCursorRef.current
      const canvas = canvasRef.current
      if (!el || !canvas) return
      const rect = canvas.getBoundingClientRect()
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

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      updateEraserCursor(e)
      if (!shouldAcceptPointer(e)) return
      e.preventDefault()
      e.stopPropagation()
      canvasRef.current?.setPointerCapture(e.pointerId)
      currentRef.current = {
        points: [getPoint(e)],
        tool: toolRef.current,
        color: colorRef.current,
        size: sizeRef.current,
      }
      drawingRef.current = true
      // 레이저 새 stroke 시작 → 공유 페이드 타이머 리셋
      // 페이드 중이던 이전 레이저 stroke 들도 다시 full opacity 로 복구됨
      if (toolRef.current === 'laser') {
        laserActivityEndRef.current = null
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(blitToMain)
      }
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      // 드로잉 중이 아니어도 지우개 커서 위치는 항상 tracking
      updateEraserCursor(e)
      if (!currentRef.current) return
      if (!shouldAcceptPointer(e)) return
      e.preventDefault()
      // getCoalescedEvents 로 놓친 점까지 수집 → 곡선 정밀도 향상
      const events = typeof e.nativeEvent.getCoalescedEvents === 'function'
        ? e.nativeEvent.getCoalescedEvents()
        : [e.nativeEvent]
      const rect = canvasRef.current!.getBoundingClientRect()
      for (const ev of events) {
        currentRef.current.points.push([
          ev.clientX - rect.left,
          ev.clientY - rect.top,
        ])
      }
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!currentRef.current) return
      canvasRef.current?.releasePointerCapture(e.pointerId)
      const s = currentRef.current
      if (s.tool === 'laser') {
        // 레이저 · offscreen 저장 안 함 · fadingLasers 에 누적
        // 공유 타이머 시작 → 이후 다른 레이저 stroke 안 그리면 HOLD 후 함께 페이드
        fadingLasersRef.current.push(s)
        laserActivityEndRef.current = Date.now()
        // undo 대상에서도 제외
      } else {
        // 일반 stroke · offscreen 에 박제
        const off = offscreenRef.current
        if (off) {
          const ctx = off.getContext('2d')
          if (ctx) renderStroke(ctx, s)
        }
        strokesRef.current.push(s)
      }
      currentRef.current = null
      drawingRef.current = false
      // 마지막 프레임 다시 blit — offscreen 복사 · 페이드 루프 시작
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(blitToMain)
      }
    }

    const suppressContext = (e: React.SyntheticEvent) => e.preventDefault()

    // 지우개 커서 지름 (px) · strokeOptionsFor 의 eraser 스케일과 동일하게 size × 14
    const eraserDiameterPx = Math.max(6, size * 14)
    const cursorStyle = disabled
      ? 'default'
      : tool === 'eraser'
        ? 'none' // 기본 크로스헤어 숨기고 원형 오버레이로 대체
        : 'crosshair'

    return (
      <div ref={containerRef} className={styles.container}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ cursor: cursorStyle }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={hideEraserCursor}
          onContextMenu={suppressContext}
        />
        {/* 지우개 원형 커서 오버레이 · 포인터 따라 이동 · translate 로 중앙 정렬 */}
        {tool === 'eraser' && !disabled && (
          <div
            ref={eraserCursorRef}
            aria-hidden
            className={styles.eraserCursor}
            style={{
              width: `${eraserDiameterPx}px`,
              height: `${eraserDiameterPx}px`,
              left: 0,
              top: 0,
            }}
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

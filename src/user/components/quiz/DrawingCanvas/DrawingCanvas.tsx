import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { getStroke } from 'perfect-freehand'
import styles from './styles/DrawingCanvas.module.scss'

export type StrokeTool = 'pen' | 'highlighter' | 'eraser' | 'laser'

export interface DrawingCanvasHandle {
  clear: () => void
  undo: () => void
}

interface Stroke {
  /**
   * [x, y] — 월드 좌표 (기준 폭 base 조판 기준 · pressure 는 균일 굵기라 사용 안 함).
   * 화면 px 이 아니라 배율을 나눈 값이라, 컨테이너가 커지고 줄어도 본문 위 같은 자리를 가리킨다.
   */
  points: number[][]
  tool: StrokeTool
  color: string
  /** 브러시 굵기 — 월드 px (그린 시점의 화면 px ÷ 그 시점 배율) */
  sizeWorld: number
}

interface DrawingCanvasProps {
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
}

/**
 * 입력 게이트 (화면 px) — 이보다 작게 움직인 포인터 리포트는 노이즈로 보고 버린다.
 * 손떨림·펜 센서 노이즈 진폭(±0.5~1px)보다 크고, 작은 글씨 획(10px+)보다는 충분히 작게.
 */
const INPUT_GATE_PX = 2

/** 도구별 슬라이더 값(0.1~1.0) → 화면 px 굵기 (지우개 커서 지름과 공유) */
function toolScreenPx(tool: StrokeTool, size: number): number {
  if (tool === 'laser') return 9 // 슬라이더 무시 · 네온 링+코어 구조 잘 보이게 다소 굵게
  if (tool === 'highlighter') return size * 32
  return size * 14
}

/**
 * 필기 캔버스 — 보이는 2-레이어 방식 (2026-08-30 개편).
 *
 * Layer A · base (아래 캔버스, 보임)
 *   - 완성된 stroke 를 픽셀로 박제. undo · clear · resize 때만 전체 재구성.
 *   - 그리는 동안에는 절대 지우지 않는다 — 완성된 잉크는 물리적으로 깜빡일 수 없다.
 * Layer B · live (위 캔버스, 보임 · 포인터 수신)
 *   - 진행 중 stroke 와 레이저만. 매 프레임 clear 후 다시 그린다.
 *
 * 이전의 "오프스크린 → 매 프레임 메인에 전체 복사" 방식은 iPad Safari(120Hz)에서
 * 큰 캔버스의 clear+blit 가 프레임마다 반복돼 간헐적 빈 프레임(깜빡임)과 프레임
 * 드랍을 만들었다. 레이어를 DOM 에서 분리하면 프레임당 비용이 진행 중 획 하나로
 * 줄고, 완성 획은 합성기(compositor)가 그대로 유지한다.
 *
 * 지우개는 특수 — 완성 잉크를 파야 하므로 base 에 직접 destination-out 으로 그린다.
 * 같은 경로를 매 프레임 다시 파도 결과가 같아(멱등) clear 가 필요 없다.
 *
 * 좌표계 — 본문(ExamScaleFrame)과 같은 "기준 폭 base 조판" 월드 좌표.
 * 획은 월드 좌표로 저장하고 렌더 때 현재 배율(컨테이너 폭 ÷ base)을 곱한다.
 * → 창 리사이즈·해설 패널 드래그·기기 회전으로 본문이 확대/축소돼도
 *   필기가 본문 위 같은 자리에 같은 비율로 따라간다.
 *
 * perfect-freehand 옵션도 튜닝 · SVG path 스타일로 렌더링해 계단현상 최소화.
 * 정책상 필기 저장 안 함. 문제 넘기면 자연 소실.
 */
export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    { tool, color, size, disabled, allowFinger = false, base = 500 },
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

    const strokesRef = useRef<Stroke[]>([])
    const currentRef = useRef<Stroke | null>(null)
    const rafRef = useRef<number | null>(null)
    const drawingRef = useRef<boolean>(false)
    // 레이저 stroke · 그린 후 자동 fade out 되는 임시 stroke (base 저장 안 함)
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
        rebuildBase()
        renderLive()
      },
      undo: () => {
        strokesRef.current = strokesRef.current.slice(0, -1)
        rebuildBase()
        renderLive()
      },
    }))

    // 초기화 · 리사이즈 — 두 레이어를 같은 크기로 맞추고 base 를 재래스터
    useEffect(() => {
      const baseCanvas = baseCanvasRef.current
      const liveCanvas = liveCanvasRef.current
      const container = containerRef.current
      if (!baseCanvas || !liveCanvas || !container) return

      const resize = () => {
        const rect = container.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        // 본문(ExamScaleFrame)과 같은 배율 — 폭이 바뀌면 획도 이 배율로 다시 래스터된다
        scaleRef.current = rect.width > 0 ? rect.width / base : 1

        for (const canvas of [baseCanvas, liveCanvas]) {
          canvas.width = Math.round(rect.width * dpr)
          canvas.height = Math.round(rect.height * dpr)
          canvas.style.width = `${rect.width}px`
          canvas.style.height = `${rect.height}px`
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
          }
        }

        rebuildBase()
        renderLive()
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
     * undo · clear · resize 에서만 호출 · 그리기 루프에서는 사용 X.
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
        renderStroke(bctx, s)
      }
    }

    /**
     * 매 프레임 live 레이어 갱신 — 진행 중 stroke 와 레이저만.
     * base(완성 잉크)는 여기서 절대 건드리지 않는다.
     * 지우개는 base 에 직접 판다 (같은 경로 반복은 멱등이라 clear 불필요).
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
            renderStroke(ctx, s, opacity)
          }
        }
      }

      // 진행 중 stroke — 지우개는 base 에 직접, 나머지는 live 에
      const cur = currentRef.current
      if (cur) {
        if (cur.tool === 'eraser') {
          const bctx = baseCtx()
          if (bctx) renderStroke(bctx, cur)
        } else {
          ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0)
          renderStroke(ctx, cur, 1)
        }
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
     * perfect-freehand 옵션 — 굵기는 stroke 에 박제된 월드 px(sizeWorld) 그대로.
     * (도구별 화면 px 매핑은 캡처 시점의 toolScreenPx ÷ 배율로 이미 반영됨)
     * 굵기는 압력과 무관하게 일정 (thinning: 0).
     */
    const strokeOptionsFor = (s: Stroke) => ({
      size: Math.max(0.5, s.sizeWorld),
      thinning: 0,
      smoothing: 0.65,
      streamline: 0.7,
    })

    /** 포인터 화면 좌표 → 월드 좌표 (배율 나눔) */
    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): number[] => {
      const rect = liveCanvasRef.current!.getBoundingClientRect()
      const k = scaleRef.current || 1
      return [(e.clientX - rect.left) / k, (e.clientY - rect.top) / k]
    }

    /**
     * 지우개 도구 활성 시 포인터 따라다니는 원형 커서 위치·표시 갱신.
     * ref 조작으로 리렌더 없이 매끄러운 tracking.
     */
    const updateEraserCursor = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (toolRef.current !== 'eraser') return
      const el = eraserCursorRef.current
      const canvas = liveCanvasRef.current
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
      currentRef.current = {
        points: [getPoint(e)],
        tool: toolRef.current,
        color: colorRef.current,
        // 화면에서 보이는 굵기(도구별 px)를 월드 px 로 변환해 박제 —
        // 이후 배율이 바뀌어도 본문과 같은 비율로 커지고 줄어든다
        sizeWorld:
          toolScreenPx(toolRef.current, sizeRef.current) / (scaleRef.current || 1),
      }
      drawingRef.current = true
      // 레이저 새 stroke 시작 → 공유 페이드 타이머 리셋
      // 페이드 중이던 이전 레이저 stroke 들도 다시 full opacity 로 복구됨
      if (toolRef.current === 'laser') {
        laserActivityEndRef.current = null
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(renderLive)
      }
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      notePen(e)
      // 드로잉 중이 아니어도 지우개 커서 위치는 항상 tracking
      updateEraserCursor(e)
      if (!currentRef.current) return
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
      const pts = currentRef.current.points
      const gate = INPUT_GATE_PX / k
      const gateSq = gate * gate
      let [lx, ly] = pts[pts.length - 1]
      for (const ev of events) {
        const x = (ev.clientX - rect.left) / k
        const y = (ev.clientY - rect.top) / k
        const dx = x - lx
        const dy = y - ly
        if (dx * dx + dy * dy < gateSq) continue
        pts.push([x, y])
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
        if ((x - lx) ** 2 + (y - ly) ** 2 > half * half) s.points.push([x, y])
      }
      if (s.tool === 'laser') {
        // 레이저 · base 저장 안 함 · fadingLasers 에 누적
        // 공유 타이머 시작 → 이후 다른 레이저 stroke 안 그리면 HOLD 후 함께 페이드
        fadingLasersRef.current.push(s)
        laserActivityEndRef.current = Date.now()
        // undo 대상에서도 제외
      } else {
        // 일반 stroke · base 에 박제 (지우개는 이미 base 에 파는 중 — 끝점 보정분만 최종 반영)
        const bctx = baseCtx()
        if (bctx) renderStroke(bctx, s)
        strokesRef.current.push(s)
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

    // 지우개 커서 지름 (화면 px) — 지금 그으면 지워질 실제 폭과 동일 (toolScreenPx 공유)
    const eraserDiameterPx = Math.max(6, toolScreenPx('eraser', size))
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

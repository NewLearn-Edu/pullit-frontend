import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { StrokeTool } from '../DrawingCanvas'
import { useIsCompact, useIsTouchDevice } from '@/user/hooks/useMediaQuery'
import styles from './styles/DrawingToolbar.module.scss'

const COLORS = ['#120C0B', '#2563EB', '#DC2626', '#059669']

/** 초기 프리셋 두께 (0.1 ~ 1.0) — 사용자가 팝오버에서 조정 시 이 자리를 대체 */
const DEFAULT_PRESETS: [number, number, number] = [0.2, 0.35, 0.7]

/**
 * 지우개 사이즈 4단 (canvas size 값 · × 14 = 실제 픽셀)
 * 0.6 = 8.4px · 1.4 = 19.6px · 2.6 = 36.4px · 4.2 = 58.8px
 */
const ERASER_SIZES: readonly number[] = [0.6, 1.4, 2.6, 4.2]
/** 툴바 버튼 안 원 지름 · 실제 지우개 크기 비율만 반영 */
const ERASER_DOT_PX = [7, 14, 22, 32]

interface DrawingToolbarProps {
  tool: StrokeTool
  color: string
  size: number
  allowFinger: boolean
  /** 필기 도구 활성화 여부 · false 이면 툴바 접힘 + canvas 도 disabled */
  drawingEnabled: boolean
  onToolChange: (t: StrokeTool) => void
  onColorChange: (c: string) => void
  onSizeChange: (s: number) => void
  onAllowFingerChange: (v: boolean) => void
  onDrawingEnabledChange: (v: boolean) => void
  onUndo: () => void
  onClear: () => void
}

/**
 * 문제풀이 상단 필기 툴바.
 * 두께는 3개 프리셋 dot · 활성 프리셋 재클릭 시 슬라이더 팝오버.
 */
export function DrawingToolbar({
  tool,
  color,
  size,
  allowFinger,
  drawingEnabled,
  onToolChange,
  onColorChange,
  onSizeChange,
  onAllowFingerChange,
  onDrawingEnabledChange,
  onUndo,
  onClear,
}: DrawingToolbarProps) {
  const isCompact = useIsCompact()
  const isTouch = useIsTouchDevice()

  // 뷰포트 breakpoint 이동 시 초기 상태 재설정
  useEffect(() => {
    onDrawingEnabledChange(!isCompact)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact])

  const [presets, setPresets] = useState<[number, number, number]>(DEFAULT_PRESETS)
  const [activeIdx, setActiveIdx] = useState(1)
  const [eraserSizeIdx, setEraserSizeIdx] = useState(1)
  const [popMounted, setPopMounted] = useState(false)
  const [popVisible, setPopVisible] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const sizeGroupRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([null, null, null])

  // 팝오버 위치 · viewport 좌표 (position: fixed 로 body 에 portal 렌더)
  type PopLayout = {
    left: number
    top: number
    width: number
    arrowLeft: number
    originLeft: number
  }
  const [popLayout, setPopLayout] = useState<PopLayout | null>(null)
  useLayoutEffect(() => {
    if (!popMounted) {
      setPopLayout(null)
      return
    }
    const compute = () => {
      const btn = buttonRefs.current[activeIdx]
      if (!btn) return
      const btnRect = btn.getBoundingClientRect()
      const vw = window.innerWidth
      const margin = 12
      const ideal = 320
      const width = Math.min(ideal, vw - margin * 2)
      const btnCenter = btnRect.left + btnRect.width / 2
      let left = btnCenter - width / 2
      left = Math.max(margin, Math.min(vw - margin - width, left))
      const rawArrowX = btnCenter - left
      const arrowSafeMargin = 22
      const arrowLeft = Math.max(
        arrowSafeMargin,
        Math.min(width - arrowSafeMargin, rawArrowX),
      )
      setPopLayout({
        left,
        top: btnRect.bottom + 11,
        width,
        arrowLeft,
        originLeft: rawArrowX,
      })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [activeIdx, popMounted])

  const openPopover = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setPopMounted(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPopVisible(true))
    })
  }

  const closePopover = () => {
    setPopVisible(false)
    closeTimerRef.current = window.setTimeout(() => {
      setPopMounted(false)
      closeTimerRef.current = null
    }, 280)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  // 부모 size 가 프리셋과 항상 일치하도록 초기 동기화
  useEffect(() => {
    if (size !== presets[activeIdx]) {
      onSizeChange(presets[activeIdx])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 도구 전환 · 크기 복원까지 이벤트 핸들러 내에서 한 번에 처리.
   * React 18+ 자동 배칭으로 단일 리렌더 · flicker 사라짐.
   */
  const handleToolChange = (newTool: StrokeTool) => {
    onToolChange(newTool)
    if (newTool === 'eraser') {
      onSizeChange(ERASER_SIZES[eraserSizeIdx])
    } else if (newTool !== 'laser') {
      onSizeChange(presets[activeIdx])
    }
  }

  const popoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!popVisible) return
    const handler = (e: Event) => {
      const target = e.target as Node
      if (
        (sizeGroupRef.current && sizeGroupRef.current.contains(target)) ||
        (popoverRef.current && popoverRef.current.contains(target))
      ) {
        return
      }
      closePopover()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popVisible])

  const handlePresetClick = (idx: number) => {
    if (idx === activeIdx) {
      if (popVisible) closePopover()
      else openPopover()
    } else {
      setActiveIdx(idx)
      if (popVisible) closePopover()
      onSizeChange(presets[idx])
    }
  }

  const handleSliderChange = (v: number) => {
    const next = [...presets] as [number, number, number]
    next[activeIdx] = v
    setPresets(next)
    onSizeChange(v)
  }

  const dotPx = (v: number) => Math.max(3, Math.round(v * 14))

  const [clearFlash, setClearFlash] = useState(false)
  const clearFlashTimer = useRef<number | null>(null)
  const handleClearClick = () => {
    if (clearFlashTimer.current) clearTimeout(clearFlashTimer.current)
    setClearFlash(true)
    onClear()
    clearFlashTimer.current = window.setTimeout(() => {
      setClearFlash(false)
      clearFlashTimer.current = null
    }, 140)
  }
  useEffect(() => {
    return () => {
      if (clearFlashTimer.current) clearTimeout(clearFlashTimer.current)
    }
  }, [])

  // 색 팔레트
  const colorsGroup = (
    <div className={styles.colorsGroup}>
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onColorChange(c)}
          aria-label={`색 ${c}`}
          className={styles.colorButton}
        >
          <span
            className={styles.colorSwatch}
            style={{
              background: c,
              boxShadow:
                color === c ? `0 0 0 2px #FFFFFF, 0 0 0 3.5px ${c}` : undefined,
            }}
          />
        </button>
      ))}
    </div>
  )

  // 지우개 사이즈 4단 그룹
  const eraserSizesGroup = (
    <div className={styles.eraserSizesGroup}>
      {ERASER_SIZES.map((v, i) => {
        const isActive = i === eraserSizeIdx
        const px = ERASER_DOT_PX[i]
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              setEraserSizeIdx(i)
              onSizeChange(v)
            }}
            aria-label={`지우개 크기 ${i + 1}`}
            aria-pressed={isActive}
            className={clsx(
              styles.eraserSizeButton,
              isActive && styles.eraserSizeButtonActive,
            )}
            style={{ width: Math.max(32, px + 10) }}
          >
            <span
              className={clsx(
                styles.eraserSizeCircle,
                isActive && styles.eraserSizeCircleActive,
              )}
              style={{ width: px, height: px }}
            />
          </button>
        )
      })}
    </div>
  )

  // 두께 프리셋 3개 + 팝오버
  const presetsGroup = (
    <div ref={sizeGroupRef} className={styles.presetsGroup}>
      {presets.map((v, i) => {
        const isActive = i === activeIdx
        return (
          <button
            key={i}
            ref={(el) => {
              buttonRefs.current[i] = el
            }}
            type="button"
            onClick={() => handlePresetClick(i)}
            aria-label={`두께 ${i + 1}`}
            aria-pressed={isActive}
            className={clsx(
              styles.presetButton,
              isActive && styles.presetButtonActive,
            )}
          >
            <span
              className={styles.presetDot}
              style={{ width: dotPx(v), height: dotPx(v) }}
            />
          </button>
        )
      })}

      {popMounted &&
        popLayout &&
        createPortal(
          <SizePopover
            ref={popoverRef}
            tool={tool}
            value={presets[activeIdx]}
            onChange={handleSliderChange}
            visible={popVisible}
            left={popLayout.left}
            top={popLayout.top}
            width={popLayout.width}
            arrowLeft={popLayout.arrowLeft}
            originLeft={popLayout.originLeft}
          />,
          document.body,
        )}
    </div>
  )

  // 필기 꺼짐 — 툴바 미노출. 켜기는 상단 네비의 펜 토글 (2026-08-07 UI 정리 · 미니 스트립 제거)
  if (!drawingEnabled) return null

  // 손필기 토글 (터치 기기에서만)
  const fingerToggle = isTouch && (
    <button
      type="button"
      onClick={() => onAllowFingerChange(!allowFinger)}
      aria-pressed={allowFinger}
      className={styles.fingerToggle}
      title={allowFinger ? '손필기 켜짐 · 눌러서 끄기' : '손필기 꺼짐 · 눌러서 켜기'}
    >
      <span className={styles.fingerToggleLabel}>손필기</span>
      <span
        aria-hidden
        className={clsx(
          styles.fingerToggleTrack,
          allowFinger && styles.fingerToggleTrackOn,
        )}
      >
        <span
          className={clsx(
            styles.fingerToggleThumb,
            allowFinger && styles.fingerToggleThumbOn,
          )}
        />
      </span>
    </button>
  )

  return (
    <div className={styles.container}>
      {/* Row 1 : 필수 컨트롤 · 항상 한 줄 */}
      <div className={styles.row}>
        {/* 좌측: 접기 (모바일만) · 되돌리기 */}
        <div className={styles.left}>
          {isCompact && (
            <button
              type="button"
              onClick={() => onDrawingEnabledChange(false)}
              aria-label="필기 도구 접기"
              className={styles.collapseButton}
            >
              <ChevronUpIcon />
              접기
            </button>
          )}
          <button
            type="button"
            onClick={onUndo}
            aria-label="되돌리기"
            className={styles.iconButton}
          >
            <UndoIcon />
          </button>
        </div>

        {/* 가운데: 도구 + (데스크탑에서만) 색 · 두께 */}
        <div className={styles.center}>
          <ToolButton
            active={tool === 'pen'}
            onClick={() => handleToolChange('pen')}
            label="펜"
          >
            <PenIcon />
          </ToolButton>
          <ToolButton
            active={tool === 'highlighter'}
            onClick={() => handleToolChange('highlighter')}
            label="형광펜"
          >
            <HighlighterIcon />
          </ToolButton>
          <ToolButton
            active={tool === 'eraser'}
            onClick={() => handleToolChange('eraser')}
            label="지우개"
          >
            <EraserIcon />
          </ToolButton>
          <ToolButton
            active={tool === 'laser'}
            onClick={() => handleToolChange('laser')}
            label="레이저 · 잠시 후 자동으로 사라짐"
          >
            <LaserIcon />
          </ToolButton>

          {/* 설정 슬롯 · 도구 무관 300px 고정 → layout shift 방지 */}
          {!isCompact && (
            <div className={styles.settings}>
              <Divider />
              {tool === 'eraser' ? (
                eraserSizesGroup
              ) : (
                <>
                  {colorsGroup}
                  <Divider />
                  {presetsGroup}
                </>
              )}
            </div>
          )}
        </div>

        {/* 우측: 손필기 토글 · 모두 지우기 */}
        <div className={styles.right}>
          {fingerToggle}
          <button
            type="button"
            onClick={handleClearClick}
            aria-label="모두 지우기"
            className={clsx(styles.clearButton, clearFlash && styles.clearButtonFlash)}
          >
            <TrashIcon />
            <span className={styles.clearButtonLabel}>모두 지우기</span>
          </button>
        </div>
      </div>

      {/* Row 2 : 모바일 색 · 두께 프리셋 */}
      {isCompact && (
        <div className={styles.row2}>
          {tool === 'eraser' ? (
            eraserSizesGroup
          ) : (
            <>
              {colorsGroup}
              <Divider />
              {presetsGroup}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* --- 서브 컴포넌트 --- */

function ToolButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={clsx(styles.toolButton, active && styles.toolButtonActive)}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className={styles.divider} aria-hidden />
}

const SizePopover = forwardRef<HTMLDivElement, {
  tool: StrokeTool
  value: number
  onChange: (v: number) => void
  visible: boolean
  left: number
  top: number
  width: number
  arrowLeft: number
  originLeft: number
}>(function SizePopover(
  { tool, value, onChange, visible, left, top, width, arrowLeft, originLeft },
  ref,
) {
  const label =
    tool === 'highlighter' ? '형광펜 두께' : tool === 'eraser' ? '지우개 두께' : '펜 두께'
  return (
    <div
      ref={ref}
      className={styles.popover}
      style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}
    >
      <div
        role="dialog"
        className={clsx(
          styles.popoverBubble,
          'bubble',
          visible ? 'bubble-open' : 'bubble-closed',
        )}
        style={{ transformOrigin: `${originLeft}px 0` }}
      >
        <span
          aria-hidden
          className={styles.popoverArrow}
          style={{ left: `${arrowLeft}px`, transform: 'translateX(-50%) rotate(45deg)' }}
        />
        <div className={styles.popoverInner}>
          <span className={styles.popoverLabel}>{label}</span>
          <CustomRangeSlider
            min={0.1}
            max={1}
            step={0.05}
            value={value}
            onChange={onChange}
            label={label}
          />
          <span className={styles.popoverValue}>{value.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
})

/**
 * iPad · PC 통일된 커스텀 슬라이더
 * - 검정 fill (좌 → 우 값 만큼 채워짐)
 * - 흰 원 thumb + shadow
 * - Pointer Events 로 마우스 · 손가락 · 펜 모두 지원
 */
function CustomRangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  label,
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  label?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pct = ((value - min) / (max - min)) * 100

  const commitFromClientX = (clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const rawPct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + rawPct * (max - min)
    const stepped = Math.round(raw / step) * step
    const clamped = Math.max(min, Math.min(max, stepped))
    const decimals = (step.toString().split('.')[1] || '').length
    onChange(parseFloat(clamped.toFixed(decimals)))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    commitFromClientX(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.pointerType === 'mouse') return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    commitFromClientX(e.clientX)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(min, value - step)
      onChange(parseFloat(next.toFixed(2)))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(max, value + step)
      onChange(parseFloat(next.toFixed(2)))
    }
  }

  const clipId = useId()
  const wedgePath =
    'M 1 7 C 30 5.5 60 4 97 3 A 8 8 0 0 1 97 13 C 60 12 30 10.5 1 9 A 1 1 0 0 1 1 7 Z'
  const fillPath = buildFillPath(pct)

  const dotPx = 3 + value * 9

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      className={styles.slider}
    >
      <svg
        className={styles.sliderSvg}
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
      >
        <path d={wedgePath} fill="#E8E4E2" />
        {fillPath && <path d={fillPath} fill="#120C0B" />}
      </svg>
      <span hidden id={clipId} />

      <div
        className={styles.sliderThumb}
        style={{ left: `${pct}%` }}
      >
        <span
          className={styles.sliderThumbDot}
          style={{ width: `${dotPx}px`, height: `${dotPx}px` }}
        />
      </div>
    </div>
  )
}

function buildFillPath(pct: number): string {
  if (pct < 0.5) return ''
  if (pct >= 97) {
    return 'M 1 7 C 30 5.5 60 4 97 3 A 8 8 0 0 1 97 13 C 60 12 30 10.5 1 9 A 1 1 0 0 1 1 7 Z'
  }
  const t = (pct - 1) / 96
  const P0 = { x: 1, y: 7 }
  const P1 = { x: 30, y: 5.5 }
  const P2 = { x: 60, y: 4 }
  const P3 = { x: 97, y: 3 }
  const u = 1 - t
  const q1x = u * P0.x + t * P1.x
  const q1y = u * P0.y + t * P1.y
  const r0x = u * P1.x + t * P2.x
  const r0y = u * P1.y + t * P2.y
  const s0x = u * P2.x + t * P3.x
  const s0y = u * P2.y + t * P3.y
  const q2x = u * q1x + t * r0x
  const q2y = u * q1y + t * r0y
  const r1x = u * r0x + t * s0x
  const r1y = u * r0y + t * s0y
  const q3x = u * q2x + t * r1x
  const q3y = u * q2y + t * r1y
  const yTop = q3y
  const yBot = 16 - yTop
  const capR = (yBot - yTop) / 2
  return `M 1 7 C ${q1x} ${q1y} ${q2x} ${q2y} ${q3x} ${yTop} A ${capR} ${capR} 0 0 1 ${q3x} ${yBot} C ${q2x} ${16 - q2y} ${q1x} ${16 - q1y} 1 9 A 1 1 0 0 1 1 7 Z`
}

/* --- 인라인 SVG 아이콘 --- */

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 3.5a2.121 2.121 0 1 1 3 3L7 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  )
}

function HighlighterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3l6 6-8 8H7v-6l8-8z" />
      <path d="M3 21h6" />
    </svg>
  )
}

function LaserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="M5.6 5.6l1.4 1.4" />
      <path d="M17 17l1.4 1.4" />
      <path d="M5.6 18.4l1.4-1.4" />
      <path d="M17 7l1.4-1.4" />
    </svg>
  )
}

function EraserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H8.5L3 14.5a2 2 0 0 1 0-2.8l8.5-8.5a2 2 0 0 1 2.8 0l7.7 7.7a2 2 0 0 1 0 2.8L14 20" />
      <path d="M17 17L7 7" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}

import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { StrokeTool } from './DrawingCanvas'
import { useIsCompact, useIsTouchDevice } from '@/hooks/useMediaQuery'

const COLORS = ['#120C0B', '#2563EB', '#DC2626', '#059669']

/** 초기 프리셋 두께 (0.1 ~ 1.0) — 사용자가 팝오버에서 조정 시 이 자리를 대체 */
const DEFAULT_PRESETS: [number, number, number] = [0.2, 0.35, 0.7]

/**
 * 지우개 사이즈 4단 (canvas size 값 · × 14 = 실제 픽셀)
 * 0.6 = 8.4px · 1.4 = 19.6px · 2.6 = 36.4px · 4.2 = 58.8px
 * 마지막은 굉장히 큼 · 표시할 때는 버튼 지름에 맞춰 스케일 다운
 */
const ERASER_SIZES: readonly number[] = [0.6, 1.4, 2.6, 4.2]
/** 툴바 버튼 안에 그려지는 원 지름 · 실제 지우개 크기 인상만 반영 (h-10 안에 들어가는 범위) */
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
  // - 모바일 진입: 툴바 접기 · 손가락 필기도 안 되게
  // - 데스크탑/태블릿 진입: 툴바 펼치기
  useEffect(() => {
    onDrawingEnabledChange(!isCompact)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompact])
  const [presets, setPresets] = useState<[number, number, number]>(DEFAULT_PRESETS)
  const [activeIdx, setActiveIdx] = useState(1)
  // 지우개 사이즈는 pen 프리셋과 분리 관리 · 도구 전환 시 각자 마지막 선택값 복원
  const [eraserSizeIdx, setEraserSizeIdx] = useState(1)
  // 팝오버는 두 개의 상태로 분리 · 닫힘 애니메이션이 끝나야 DOM 에서 제거
  const [popMounted, setPopMounted] = useState(false)
  const [popVisible, setPopVisible] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const sizeGroupRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([null, null, null])

  // 팝오버 위치 · viewport 좌표 (position: fixed 로 body 에 portal 렌더)
  // null 이면 아직 계산 안 됨 · 렌더도 안 함 → 초기 (top:0) 위치로 잠깐 뜨는 이슈 방지
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
        left, // viewport X
        top: btnRect.bottom + 11, // 버튼 밑 11px
        width,
        arrowLeft,
        originLeft: rawArrowX,
      })
    }
    compute()
    window.addEventListener('resize', compute)
    // 스크롤 시 sticky 툴바가 잠깐 이동하는 순간에도 팝오버 위치 동기화
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
    // 2 rAF 로 초기 closed 상태가 페인트된 뒤 open 클래스로 전환 → transition 이 트리거됨
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPopVisible(true))
    })
  }

  const closePopover = () => {
    setPopVisible(false)
    closeTimerRef.current = window.setTimeout(() => {
      setPopMounted(false)
      closeTimerRef.current = null
    }, 280) // .bubble-closed transition 260ms + 여유 20ms
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
   * useEffect 로 tool 변경을 감지해 크기를 바꾸면 두 번 리렌더가 발생 →
   * 활성 상태 CSS transition 이 이상하게 겹쳐 "펜이 다시 activate 되는 것 같은" flicker 발생.
   * 두 setState 를 같은 이벤트 안에서 부르면 React 18+ 자동 배칭으로 단일 리렌더 · flicker 사라짐.
   */
  const handleToolChange = (newTool: StrokeTool) => {
    onToolChange(newTool)
    if (newTool === 'eraser') {
      onSizeChange(ERASER_SIZES[eraserSizeIdx])
    } else if (newTool !== 'laser') {
      // laser 는 canvas 에서 슬라이더 무시 · 그 외 도구는 마지막 펜 프리셋 복원
      onSizeChange(presets[activeIdx])
    }
  }

  // 팝오버 밖 클릭 시 닫기 (팝오버가 body 로 portal 되므로 popoverRef 도 별도 체크)
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
      // 활성 프리셋 재클릭 → 팝오버 토글
      if (popVisible) closePopover()
      else openPopover()
    } else {
      // 다른 프리셋으로 전환 · 팝오버 열려있으면 부드럽게 닫기
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

  // "모두 지우기" 클릭 시 잠깐 primary 색으로 flash → 원상복귀
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

  // 색 팔레트 · 두께 프리셋 (모바일에선 아래 줄로 · 데스크탑에선 인라인)
  const colorsGroup = (
    <div className="flex items-center gap-xs">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onColorChange(c)}
          aria-label={`색 ${c}`}
          className="flex h-8 w-8 items-center justify-center rounded-full"
        >
          <span
            className="block h-4 w-4 rounded-full transition-shadow duration-150"
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

  // 지우개 사이즈 그룹 · 4개 프리셋 · 원 지름이 실제 지우개 크기 비율을 반영 (h-10 내 스케일)
  const eraserSizesGroup = (
    <div className="flex items-center gap-xs">
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
              'flex h-10 items-center justify-center rounded-full transition-colors',
              'active:scale-90',
              isActive ? 'bg-surface' : 'hover:bg-surface/60',
            )}
            style={{ width: Math.max(32, px + 10) }}
          >
            <span
              className={clsx(
                'block rounded-full border-2 transition-colors',
                isActive ? 'border-foreground' : 'border-body/60',
              )}
              style={{ width: px, height: px }}
            />
          </button>
        )
      })}
    </div>
  )

  const presetsGroup = (
    <div ref={sizeGroupRef} className="relative flex items-center gap-xs">
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
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
              'active:scale-90',
              isActive ? 'bg-surface' : 'hover:bg-surface/60',
            )}
          >
            <span
              className="block rounded-full bg-foreground"
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

  // 모바일에서 툴바 접힌 상태: 미니 스트립만 표시 · canvas 도 disabled 됨
  if (isCompact && !drawingEnabled) {
    return (
      <div className="sticky top-14 z-20 flex h-10 w-full items-center justify-between border-b border-[#D6CFCB] bg-canvas px-lg">
        <span className="text-body-sm text-muted">문제만 풀이 중</span>
        <button
          type="button"
          onClick={() => onDrawingEnabledChange(true)}
          className="flex items-center gap-xs rounded-btn-sm bg-surface px-md py-xs text-body-sm font-semibold text-foreground transition-transform active:scale-95"
        >
          <PenIcon />
          필기 도구
        </button>
      </div>
    )
  }

  // 손필기 토글 (터치 기기에서만 · PC 는 마우스라 필요 없음)
  // ON = 손가락 필기 허용 · OFF = 펜만 필기
  const fingerToggle = isTouch && (
    <button
      type="button"
      onClick={() => onAllowFingerChange(!allowFinger)}
      aria-pressed={allowFinger}
      className="flex h-8 flex-none items-center gap-sm whitespace-nowrap rounded-btn-sm px-md text-body-sm text-body transition-colors hover:bg-surface"
      title={allowFinger ? '손필기 켜짐 · 눌러서 끄기' : '손필기 꺼짐 · 눌러서 켜기'}
    >
      <span className="font-medium">손필기</span>
      <span
        aria-hidden
        className={clsx(
          'relative inline-block h-5 w-9 flex-none rounded-full transition-colors',
          allowFinger ? 'bg-primary' : 'bg-line',
        )}
      >
        <span
          className={clsx(
            'absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-sm transition-all',
            allowFinger ? 'left-[18px]' : 'left-[2px]',
          )}
        />
      </span>
    </button>
  )

  return (
    <div className="sticky top-14 z-20 w-full border-b border-[#D6CFCB] bg-canvas">
      {/* Row 1 : 필수 컨트롤 · 항상 한 줄에 */}
      <div className="grid h-12 w-full grid-cols-[1fr_auto_1fr] items-center gap-md px-lg">
        {/* 좌측: 접기 (모바일만) · 되돌리기 */}
        <div className="flex items-center gap-xs">
          {isCompact && (
            <button
              type="button"
              onClick={() => onDrawingEnabledChange(false)}
              aria-label="필기 도구 접기"
              className="flex h-8 items-center gap-xs whitespace-nowrap rounded-btn-sm px-md text-body-sm font-semibold text-body transition-colors active:scale-95 hover:bg-surface"
            >
              <ChevronUpIcon />
              접기
            </button>
          )}
          <IconButton onClick={onUndo} label="되돌리기">
            <UndoIcon />
          </IconButton>
        </div>

        {/* 가운데: 도구 + (데스크탑에서만) 색 · 두께 */}
        <div className="flex items-center gap-md">
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

          {/* 데스크탑에서만 노출 · 모바일은 아래 Row 2 에서 렌더 (조건 렌더로 DOM 유일성 보장)
              설정 슬롯 고정 폭 · 도구 전환 시 layout shift 방지 → 펜 버튼 위치 안정 → flicker 사라짐
              (eraserSizesGroup 이 colors+divider+presets 보다 좁아서, 폭이 자유로우면 tool 버튼이 우측으로 튐) */}
          {!isCompact && (
            <div className="flex w-[300px] flex-none items-center gap-md">
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

        {/* 우측: 손가락 잠금 (터치 기기만) · 모두 지우기 */}
        <div className="flex items-center justify-end gap-xs">
          {fingerToggle}
          <button
            type="button"
            onClick={handleClearClick}
            aria-label="모두 지우기"
            className={clsx(
              'flex h-8 flex-none items-center gap-xs whitespace-nowrap rounded-btn-sm px-md text-body-sm transition-colors duration-150',
              clearFlash
                ? 'bg-weak-bg text-primary'
                : 'text-muted hover:bg-surface',
            )}
          >
            <TrashIcon />
            <span className="hidden md:inline">모두 지우기</span>
          </button>
        </div>
      </div>

      {/* Row 2 : 모바일에서만 · 색 · 두께 프리셋 (조건 렌더로 DOM 유일)
          모바일은 Row 2 가 별도 줄이라 layout shift 우려 없음 · justify-center 자연 배치 */}
      {isCompact && (
        <div className="flex h-12 items-center justify-center gap-md border-t border-[#D6CFCB] px-lg">
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

const SizePopover = forwardRef<HTMLDivElement, {
  tool: StrokeTool
  value: number
  onChange: (v: number) => void
  visible: boolean
  /** viewport X · fixed positioning */
  left: number
  /** viewport Y · fixed positioning */
  top: number
  /** 팝오버 폭 (px) - viewport 에 맞춰 축소됨 */
  width: number
  /** 팝오버 안에서 화살표 X (px) - edge 회피 clamp 적용된 시각 위치 */
  arrowLeft: number
  /** 스프링 애니메이션 원점 X (px) - 활성 버튼 실제 위치 · clamp 없음 */
  originLeft: number
}>(function SizePopover(
  { tool, value, onChange, visible, left, top, width, arrowLeft, originLeft },
  ref,
) {
  const label =
    tool === 'highlighter' ? '형광펜 두께' : tool === 'eraser' ? '지우개 두께' : '펜 두께'
  return (
    // Portal 로 body 에 렌더 · position: fixed · z-index 최상위 → clipping · stacking 이슈 zero
    <div
      ref={ref}
      className="fixed z-[9999]"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
      }}
    >
      <div
        role="dialog"
        className={clsx(
          'bubble relative rounded-btn-xl border border-line bg-canvas px-lg py-md shadow-[0_12px_32px_rgba(18,12,11,0.12)]',
          visible ? 'bubble-open' : 'bubble-closed',
        )}
        style={{
          transformOrigin: `${originLeft}px 0`,
        }}
      >
        <span
          aria-hidden
          className="absolute -top-[6px] h-3 w-3 rotate-45 border-l border-t border-line bg-canvas"
          style={{
            left: `${arrowLeft}px`,
            transform: 'translateX(-50%) rotate(45deg)',
          }}
        />
        <div className="relative flex items-center gap-lg">
          <span className="whitespace-nowrap text-body-sm font-semibold text-foreground">
            {label}
          </span>
          <CustomRangeSlider
            min={0.1}
            max={1}
            step={0.05}
            value={value}
            onChange={onChange}
            label={label}
          />
          <span className="w-10 flex-none text-right text-body-sm tabular-nums text-body">
            {value.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
})

function IconButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void
  children: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-btn-sm text-body hover:bg-surface"
    >
      {children}
    </button>
  )
}

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
      className={clsx(
        'flex h-8 w-8 items-center justify-center rounded-btn-sm transition-colors',
        active ? 'bg-weak-bg text-primary' : 'text-body hover:bg-surface',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="mx-xs h-5 w-px flex-none bg-line" aria-hidden />
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
    // 부동소수점 오차 방지 · step 자릿수 만큼만 반올림
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
  // 쐐기 모양 path · cubic bezier 로 부드러운 곡선 · 양쪽 끝 rounded 캡
  // 우측 body 를 x=97 까지 확장 → thumb 위치까지 wedge 가 도달
  const wedgePath =
    'M 1 7 C 30 5.5 60 4 97 3 A 8 8 0 0 1 97 13 C 60 12 30 10.5 1 9 A 1 1 0 0 1 1 7 Z'
  // Fill 은 bezier 분할로 자기 위치에 맞는 rounded 캡 생성 → 우측 끝이 자연스럽게 연결
  const fillPath = buildFillPath(pct)

  // Thumb 안 dot 크기 · value 에 따라 3px ~ 12px 로 변화
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
      className="relative flex h-6 flex-1 cursor-pointer touch-none select-none items-center"
    >
      {/* SVG 쐐기 트랙 · 부드러운 곡선 · 좌 얇음 → 우 두꺼움 */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2 overflow-visible"
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
      >
        {/* 배경 쐐기 (회색) · 전체 노출 */}
        <path d={wedgePath} fill="#E8E4E2" />
        {/* Fill 쐐기 (검정) · 자체 rounded 캡으로 우측 끝이 부드럽게 마무리 */}
        {fillPath && <path d={fillPath} fill="#120C0B" />}
      </svg>
      {/* clipId 는 지금 안 쓰지만 재사용 대비 유지 */}
      <span hidden id={clipId} />

      {/* Thumb (흰 원 + shadow + 안에 dot) · dot 크기가 value 반영 */}
      <div
        className="pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-white shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
        style={{ left: `${pct}%` }}
      >
        <span
          className="block rounded-full bg-foreground"
          style={{ width: `${dotPx}px`, height: `${dotPx}px` }}
        />
      </div>
    </div>
  )
}

/**
 * Fill wedge path 를 pct (0~100) 만큼 잘라내는 함수.
 * de Casteljau 알고리즘으로 cubic bezier 를 t 지점에서 분할해
 * fill 이 자기 위치에 맞는 rounded 캡을 갖도록.
 *
 * 배경 wedge 의 top edge bezier: (1,7) → (30,5.5) → (60,4) → (97,3)
 * y=8 대칭이므로 bottom edge 는 y' = 16 - y_top.
 */
function buildFillPath(pct: number): string {
  if (pct < 0.5) return '' // 너무 작으면 렌더 X

  // 우측 끝 (x=97 이후 배경 wedge 의 rounded 캡 영역) 도달 시 배경 전체 shape 그대로 사용
  if (pct >= 97) {
    return 'M 1 7 C 30 5.5 60 4 97 3 A 8 8 0 0 1 97 13 C 60 12 30 10.5 1 9 A 1 1 0 0 1 1 7 Z'
  }

  // bezier t 파라미터 (0~1) · x 위치 기준
  const t = (pct - 1) / 96

  // de Casteljau 분할 (cubic bezier)
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

  // 우측 rounded 캡 · 반지름 = 지금 위치에서 wedge 두께 절반
  const yTop = q3y
  const yBot = 16 - yTop
  const capR = (yBot - yTop) / 2

  // 하단 bezier · 대칭 (y' = 16 - y)
  return `M 1 7 C ${q1x} ${q1y} ${q2x} ${q2y} ${q3x} ${yTop} A ${capR} ${capR} 0 0 1 ${q3x} ${yBot} C ${q2x} ${16 - q2y} ${q1x} ${16 - q1y} 1 9 A 1 1 0 0 1 1 7 Z`
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

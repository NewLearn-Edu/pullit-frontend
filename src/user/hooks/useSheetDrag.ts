import { useRef, useState } from 'react'

/** 전체 거리 퇴장 시간 — .unitSheet/.infoSheet 의 transform 트랜지션(220ms)과 같은 값 */
const EXIT_MS = 220
/** 남은 거리가 아주 짧아도 이보다 빨리 끊지 않는다 (딤 페이드가 보일 최소 시간) */
const EXIT_MIN_MS = 120

/**
 * 바텀시트 "아래로 스와이프 닫기" 공용 제스처.
 * - 8px 이동 임계값으로 탭과 드래그 구분
 * - 드래그 중 손가락 1:1 추종 — React 리렌더 없이 CSS 변수(--drag-y)를 DOM 에 직접 기록
 *   (setState 로 하면 pointermove 마다 페이지 전체가 리렌더돼 프레임이 밀리고 잔상이 생긴다)
 * - threshold 초과 후 놓으면 시트가 화면 아래로 슬라이드 아웃한 뒤 onClose (즉시 언마운트 금지)
 * - 미달이면 복귀 트랜지션으로 제자리
 * - 딤 탭·닫기 버튼은 close() 로 같은 슬라이드 아웃을 재생한 뒤 닫는다
 * - 드래그로 끝난 제스처의 잔여 click 무시 (시트 안 버튼 오발동 방지)
 * - disabled() 가 true 면 제스처 비활성 (예: 웹에서 사이드 패널/다이얼로그로 배치될 때)
 *
 * 사용: <div {...sheetProps} className={clsx(styles.sheet, dragging && styles.sheetDragging)}>
 * 시트 CSS 에서 transform: translateY(var(--drag-y, 0px)) + 복귀 트랜지션을 선언할 것.
 * 딤에는 className={clsx(styles.dim, closing && styles.dimOut)} style={{ '--sheet-exit-ms': `${exitMs}ms` }}
 * 로 퇴장 페이드를 시트와 같은 시간에 맞춘다.
 */
export function useSheetDrag(
  onClose: () => void,
  options: { threshold?: number; disabled?: () => boolean } = {},
) {
  const { threshold = 96, disabled } = options

  const elRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  /** 퇴장 중 — 딤이 시트와 같은 시간에 걸쳐 사라지도록 부모가 클래스로 쓴다 */
  const [closing, setClosing] = useState(false)
  /** 이번 퇴장에 걸리는 시간(ms) — 딤 페이드 길이(--sheet-exit-ms)로 넘긴다 */
  const [exitMs, setExitMs] = useState(EXIT_MS)
  const drag = useRef<{ startY: number; id: number; active: boolean } | null>(null)
  const dragged = useRef(false)
  const closingRef = useRef(false)
  /** 마지막으로 기록한 --drag-y — 퇴장 시 남은 거리 계산용 */
  const currentY = useRef(0)

  const setY = (y: number) => {
    currentY.current = y
    elRef.current?.style.setProperty('--drag-y', `${y}px`)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation() // 뒤 레이어(캔버스 팬·딤)로 전파 금지
    if (disabled?.() || closingRef.current) return
    drag.current = { startY: e.clientY, id: e.pointerId, active: false }
    dragged.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id || closingRef.current) return
    const dy = e.clientY - d.startY
    if (!d.active && dy > 8) {
      d.active = true
      dragged.current = true
      setDragging(true)
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    }
    if (d.active) setY(Math.max(0, dy))
  }

  /**
   * 슬라이드 아웃 후 닫기 — 즉시 언마운트하면 시트가 뚝 사라진다.
   * 드래그로 놓았을 때뿐 아니라 딤 탭·닫기 버튼도 이 퇴장 연출을 공유한다.
   * 웹(disabled)은 바텀시트가 아니라 우측 패널·다이얼로그라 아래로 내려갈 자리가
   * 없다 — CSS 도 transform: none 이므로 지연 없이 바로 닫는다.
   *
   * 퇴장 시간은 남은 거리에 비례한다 (2026-09-04): 드래그로 이미 많이 내려온 상태에서 놓으면
   * 남은 몇십 px 을 고정 220ms 로 끌어 시트는 첫 100ms 에 다 내려가고 나머지 시간 동안 멈춘 채
   * 딤만 남다가 언마운트 순간 한 번에 꺼졌다 (iPad 녹화: 3 프레임 이동 → 4 프레임 정지 → 팝).
   * 딤(closing · exitMs)도 같은 시간에 걸쳐 사라진다.
   */
  const close = () => {
    if (closingRef.current) return
    if (disabled?.()) return onClose()

    closingRef.current = true
    setDragging(false)
    const el = elRef.current
    const distance = el ? el.offsetHeight + 40 : window.innerHeight
    const remaining = Math.max(0, distance - currentY.current)
    const ms = Math.round(Math.max(EXIT_MIN_MS, Math.min(EXIT_MS, (EXIT_MS * remaining) / distance)))
    setClosing(true)
    setExitMs(ms)
    if (el) el.style.transitionDuration = `${ms}ms`
    requestAnimationFrame(() => setY(distance))
    window.setTimeout(() => {
      closingRef.current = false
      if (el) el.style.transitionDuration = ''
      setY(0)
      setClosing(false)
      setExitMs(EXIT_MS)
      onClose()
    }, ms + 20)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d?.active || closingRef.current) return
    setDragging(false) // 복귀/퇴장 트랜지션 재활성

    if (e.clientY - d.startY > threshold) close()
    else setY(0)
  }

  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault()
      e.stopPropagation()
      dragged.current = false
    }
  }

  return {
    dragging,
    closing,
    exitMs,
    /** 딤 탭·닫기 버튼에서 호출 — 슬라이드 아웃 뒤 onClose */
    close,
    sheetProps: {
      ref: elRef,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  }
}

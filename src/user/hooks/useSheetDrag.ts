import { useRef, useState } from 'react'

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
 */
export function useSheetDrag(
  onClose: () => void,
  options: { threshold?: number; disabled?: () => boolean } = {},
) {
  const { threshold = 96, disabled } = options

  const elRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startY: number; id: number; active: boolean } | null>(null)
  const dragged = useRef(false)
  const closing = useRef(false)

  const setY = (y: number) => {
    elRef.current?.style.setProperty('--drag-y', `${y}px`)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation() // 뒤 레이어(캔버스 팬·딤)로 전파 금지
    if (disabled?.() || closing.current) return
    drag.current = { startY: e.clientY, id: e.pointerId, active: false }
    dragged.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id || closing.current) return
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
   */
  const close = () => {
    if (closing.current) return
    if (disabled?.()) return onClose()

    closing.current = true
    setDragging(false)
    const el = elRef.current
    const distance = el ? el.offsetHeight + 40 : window.innerHeight
    requestAnimationFrame(() => setY(distance))
    window.setTimeout(() => {
      closing.current = false
      setY(0)
      onClose()
    }, 240)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d?.active || closing.current) return
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

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 시험지 스케일 프레임 (2026-08-26 확정) — 문제·해설 조판의 단일 크기 정책.
 *
 * 내용을 기준 폭(base=500 — 이 폭에서 본문 15px·패딩 16px 24px)으로 고정 조판해 두고,
 * 컨테이너 폭에 비례해 이미지처럼 통째로 확대/축소한다.
 * → 폭이 달라져도 줄바꿈이 절대 변하지 않는다 (어드민 검수 = 학생 화면, 배율만 다름).
 *
 * 배율은 transform: scale 로 건다 (2026-09-03 — 원래 zoom 이었음).
 * WebKit(사파리·아이패드 전 브라우저)은 zoom 을 "글꼴 크기를 다시 계산해 재조판" 으로 처리해서
 * 배율마다 글자 폭이 반올림되어 줄바꿈이 흔들리고, 배율이 작으면 최소 글꼴 크기(9px)에 걸려
 * 아예 다시 흐른다. transform 은 조판이 끝난 결과를 그대로 늘이고 줄이므로 어느 엔진에서도
 * 줄바꿈이 변하지 않는다. 대신 transform 은 레이아웃 크기에 반영되지 않아 바깥 박스 높이를
 * 안쪽 조판 높이 × 배율로 직접 맞춘다 (KaTeX 지연 렌더 등 높이 변화는 ResizeObserver 로 추종).
 */
export function ExamScaleFrame({
  base = 500,
  className,
  children,
}: {
  /** 기준 조판 폭(px) — 이 폭에서 배율 1 */
  base?: number
  className?: string
  children: ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [innerHeight, setInnerHeight] = useState(0)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    // 본문 캔버스(DrawingCanvas)와 같은 정수 clientWidth 기준 — 소수 폭을 쓰면 필기와 본문이 어긋난다
    const updateScale = () => setScale(outer.clientWidth / base)
    // offsetHeight 는 transform 이 적용되기 전 조판 높이 — 배율과 무관하게 안정적
    const updateHeight = () => setInnerHeight(inner.offsetHeight)
    updateScale()
    updateHeight()
    const outerRo = new ResizeObserver(updateScale)
    const innerRo = new ResizeObserver(updateHeight)
    outerRo.observe(outer)
    innerRo.observe(inner)
    return () => {
      outerRo.disconnect()
      innerRo.disconnect()
    }
  }, [base])

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ width: '100%', height: innerHeight * scale, overflow: 'visible' }}
    >
      <div
        ref={innerRef}
        data-exam-scale={scale}
        style={{ width: base, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}

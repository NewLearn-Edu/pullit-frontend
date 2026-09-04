import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { flushSync } from 'react-dom'

/**
 * 스크롤 컨테이너 안 "카드" 하나를 두 손가락으로 확대·이동 (2026-09-03).
 * 문제 카드(main > problemCard)와 해설 패널(body > drawWrap) 둘 다 이 훅으로 움직인다.
 *
 * 브라우저 페이지 확대(툴바·답안 바까지 커지고 iOS 는 viewport 설정에 따라 막힘) 대신 카드 폭을
 * `기본 폭 × zoom` 으로 키운다 — 본문(ExamScaleFrame)과 필기 캔버스(DrawingCanvas)는 둘 다 "컨테이너 폭 ÷
 * 기준 폭" 으로 배율을 잡으므로 폭만 키우면 글자·수식·필기가 같은 비율로 정확히 따라온다.
 * 기본 폭 = 컨테이너 안쪽 폭(패딩 제외), 옵션 maxBaseWidth 로 상한(문제 카드 500px).
 *
 * 제스처 중에는 폭을 건드리지 않는다 — 폭이 바뀌면 본문 재배율·필기 전체 재래스터가 손가락이 움직일 때마다
 * 일어나 끊긴다. 대신 카드에 CSS transform(GPU) 만 걸어 보여주고, 손을 떼는 순간 한 번만 실제 폭·위치로
 * 확정한다. 확정 전엔 살짝 흐릿할 수 있지만 그 프레임만이다.
 *
 * 확정 위치 — "손가락 사이 중점이 가리키던 본문 지점이 손을 뗀 자리에 그대로" 가 원칙.
 * - 세로: 스크롤 컨테이너의 scrollTop. 내용이 짧으면 카드가 min-height:100% 로 컨테이너에 딱 맞아
 *   스크롤 범위가 0 이다 — 목표 scrollTop 에 모자란 만큼 CSS 변수 --pinch-slack 으로 카드 최소 높이를 늘려
 *   (카드 min-height: calc(100% + var(--pinch-slack))) 범위를 만든다.
 *   카드 위쪽 가장자리는 컨테이너 위에 붙인다(가로 가장자리와 같은 규칙) — 축소하며 카드가 내려와야 할 땐 위로 붙는다
 * - 가로: 항상 카드 margin-left (음수 허용) 로 놓고 컨테이너 가로 스크롤은 닫는다.
 *   scrollLeft 를 쓰면 (1) 카드가 컨테이너보다 좁을 땐 스크롤 범위가 0 이라 못 맞추고 — 아이패드처럼 컨테이너가
 *   500px 보다 훨씬 넓으면 1~2 배 구간이 전부 해당 — (2) 넓을 때도 iOS 는 스크롤 위치를 UI 프로세스가 비동기로
 *   관리해 "방금 넓어진" 카드에 바로 넣은 scrollLeft 가 옛 범위로 잘려 0 이 된다. 둘 다 카드가 왼쪽 끝으로 튀는
 *   증상. 가로 이동은 두 손가락 끌기가 담당하므로 네이티브 가로 스크롤을 잃어도 없어지는 기능은 없다.
 * - 확정 렌더는 flushSync 로 동기 처리 — transform 을 지운 뒤 다음 프레임에 폭이 바뀌면 1 배로 한 프레임
 *   튕겨 보인다
 *
 * - 두 손가락 벌리기/오므리기 = 확대·축소 (1 ~ MAX), 두 손가락 끌기 = 이동
 * - 두 손가락이 모두 카드 위에서 시작해야 한다 — 카드 옆 배경(아이패드에서 카드 밖 회색 영역)에서 시작한 핀치는 무시.
 *   페이지 나머지(헤더·필기 도구·배경)의 브라우저 확대는 useBlockNativePinch 가 막는다
 * - 한 손가락·펜은 건드리지 않는다 (필기·손가락 스크롤은 DrawingCanvas 가 처리)
 * - 1 배 아래로는 못 내려간다 — 원래 폭(맞춤)이 최소. 1 배로 돌아오면 기본 레이아웃으로 복귀
 * - 요소는 ref 가 아니라 state 로 추적한다 — 페이지가 문제 로딩 전엔 null 을 반환해 첫 effect 때 컨테이너가 없고,
 *   ref 객체만 deps 에 있으면 요소가 생겨도 effect 가 다시 돌지 않아 리스너가 영영 붙지 않았다
 * - 훅 state 가 바뀌면 호출한 컴포넌트가 리렌더된다. MathJax 처럼 리렌더에 약한 내용을 담는 곳(해설 패널)은
 *   PinchZoomScroller 로 감싸 state 를 격리한다
 */
const MAX_ZOOM = 3
/** 두 손가락 끌기만 했을 때 거리 떨림으로 배율이 미세하게 바뀌어 폭 재계산·재래스터가 도는 것을 막는 여유 */
const SCALE_DEADZONE = 0.01

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Layout = {
  zoom: number
  /** 확대 상태에서 카드 margin-left(px) — 카드가 컨테이너보다 넓으면 음수 */
  left: number
  /** 세로 스크롤 여유(px) — 카드 min-height 를 100% + slack 으로 */
  slack: number
  /** 하단 바 자리 — 카드의 "보이는 구간" 폭과 컨테이너 border-box 기준 왼쪽 offset, 컨테이너의 뷰포트 왼쪽 */
  barWidth: number
  barOffset: number
  mainLeft: number
}
const INITIAL: Layout = { zoom: 1, left: 0, slack: 0, barWidth: 0, barOffset: 0, mainLeft: 0 }

type Padding = { l: number; r: number; t: number; b: number }

export function usePinchZoom(
  scrollerRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
  { maxBaseWidth = Infinity }: { maxBaseWidth?: number } = {},
) {
  const [layout, setLayout] = useState<Layout>(INITIAL)
  const zoomRef = useRef(1)
  // 실제 DOM 요소 — 매 렌더 후 ref 를 읽어 동기화 (같은 요소면 setState 는 no-op)
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  const [card, setCard] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setScroller(scrollerRef.current)
    setCard(cardRef.current)
  })
  // 1 배 때 카드 폭 = 컨테이너 안쪽 폭(패딩 제외), 상한 maxBaseWidth — px 로 직접 계산해 넣는다.
  // `calc(min(100%, 500px) * zoom)` 은 데스크톱 WebKit 은 받지만 iPadOS 26 사파리가 적용하지 않았다 (2026-09-03 영상 확인)
  const [baseWidth, setBaseWidth] = useState(0)
  const baseWidthRef = useRef(0)
  const paddingRef = useRef<Padding>({ l: 0, r: 0, t: 0, b: 0 })
  useLayoutEffect(() => {
    const el = scroller
    if (!el) return
    const update = () => {
      const cs = getComputedStyle(el)
      const p = {
        l: parseFloat(cs.paddingLeft) || 0,
        r: parseFloat(cs.paddingRight) || 0,
        t: parseFloat(cs.paddingTop) || 0,
        b: parseFloat(cs.paddingBottom) || 0,
      }
      paddingRef.current = p
      const w = Math.min(el.clientWidth - p.l - p.r, maxBaseWidth)
      baseWidthRef.current = w
      setBaseWidth(w)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scroller, maxBaseWidth])
  // 확정 렌더(폭 변경) 뒤에 적용할 스크롤 목표 — 폭이 바뀌기 전에 넣으면 clamp 돼 버린다
  const pendingScrollRef = useRef<{ top: number } | null>(null)

  useLayoutEffect(() => {
    zoomRef.current = layout.zoom
    const el = scroller
    const pending = pendingScrollRef.current
    if (!el || !pending) return
    pendingScrollRef.current = null
    const apply = () => {
      el.scrollLeft = 0
      el.scrollTop = pending.top
    }
    apply()
    // 본문 배율 프레임(ExamScaleFrame)은 ResizeObserver 로 몇 프레임 뒤에 높이를 맞춘다 —
    // 그 전엔 스크롤 범위가 짧아 clamp 될 수 있어 높이가 정착할 때까지(최대 10프레임) 재적용
    let frames = 0
    let raf = requestAnimationFrame(function tick() {
      apply()
      if (++frames < 10) raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [layout, scroller])

  useLayoutEffect(() => {
    const el = scroller
    if (!el || !card) return

    let start: {
      dist: number
      /** 제스처 시작 때 카드의 화면 좌상단 */
      cardLeft: number
      cardTop: number
      /** 카드 안에서 중점이 가리키던 지점 (현재 확정 배율의 px) */
      px: number
      py: number
      /** 카드가 컨테이너 스크롤 내용 안에서 차지하는 세로 offset (패딩 포함) */
      cardOffsetTop: number
      /** 배율이 적용되는 본문(ExamScaleFrame)의 카드 안 세로 시작 — 그 위(헤더)는 배율과 무관하게 높이가 고정 */
      frameTop: number
      /** 본문(ExamScaleFrame) 현재 높이 — 배율에 비례해 커지는 유일한 부분 */
      frameHeight: number
      /** min-height 를 뺀 카드의 내용 높이 (현재 배율) */
      naturalHeight: number
      /** 컨테이너 스크롤 내용 중 카드 밖(패딩·sticky 바 등) 높이 */
      otherHeight: number
    } | null = null
    let live = { s: 1, tx: 0, ty: 0, midX: 0, midY: 0 }

    const gesture = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]]
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        midX: (a.clientX + b.clientX) / 2,
        midY: (a.clientY + b.clientY) / 2,
      }
    }

    const inCard = (t: Touch) => t.target instanceof Node && card.contains(t.target)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !inCard(e.touches[0]) || !inCard(e.touches[1])) {
        start = null
        return
      }
      e.preventDefault()
      const g = gesture(e)
      // 내용만의 높이 — min-height 를 잠깐 풀어 측정 (제스처 시작 1회 reflow). transform 이 걸리기 전이라 정확.
      // 카드가 짧아지는 순간 컨테이너 스크롤이 clamp 되므로 측정 뒤 스크롤을 되돌리고 나서 나머지를 잰다
      const savedScrollTop = el.scrollTop
      const savedScrollLeft = el.scrollLeft
      const prevMin = card.style.minHeight
      const prevSlack = card.style.getPropertyValue('--pinch-slack')
      card.style.minHeight = '0'
      card.style.setProperty('--pinch-slack', '0px') // 지난 확정의 여유(padding)도 빼고 순수 내용 높이만
      const naturalHeight = card.getBoundingClientRect().height
      card.style.minHeight = prevMin
      if (prevSlack) card.style.setProperty('--pinch-slack', prevSlack)
      else card.style.removeProperty('--pinch-slack')
      el.scrollTop = savedScrollTop
      el.scrollLeft = savedScrollLeft
      const cr = card.getBoundingClientRect()
      const mr = el.getBoundingClientRect()
      const frame = card.querySelector('[data-exam-scale]')
      const frameOuter = frame?.parentElement ?? null
      start = {
        frameHeight: frameOuter ? frameOuter.getBoundingClientRect().height : 0,
        naturalHeight,
        otherHeight: el.scrollHeight - cr.height,
        dist: g.dist,
        cardLeft: cr.left,
        cardTop: cr.top,
        px: g.midX - cr.left,
        py: g.midY - cr.top,
        cardOffsetTop: cr.top - mr.top + el.scrollTop,
        frameTop: frame ? frame.getBoundingClientRect().top - cr.top : 0,
      }
      live = { s: 1, tx: 0, ty: 0, midX: g.midX, midY: g.midY }
      card.style.transformOrigin = '0 0'
      card.style.willChange = 'transform'
    }

    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return
      e.preventDefault()
      const g = gesture(e)
      const committed = zoomRef.current
      // 상대 배율 — 확정 배율과 곱해 1 ~ MAX 안에 머물도록 clamp
      const s = clamp(g.dist / start.dist, 1 / committed, MAX_ZOOM / committed)
      // 시작 때 중점 아래 있던 카드 지점(px,py)이 지금 중점 자리에 오도록: cardLeft + tx + px·s = midX
      const tx = g.midX - start.cardLeft - start.px * s
      const ty = g.midY - start.cardTop - start.py * s
      live = { s, tx, ty, midX: g.midX, midY: g.midY }
      card.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`
    }

    const onEnd = (e: TouchEvent) => {
      if (!start || e.touches.length >= 2) return
      const st = start
      start = null
      const committed = zoomRef.current
      const s = Math.abs(live.s - 1) < SCALE_DEADZONE ? 1 : live.s
      const next = clamp(committed * s, 1, MAX_ZOOM)
      const ratio = next / committed
      const mr = el.getBoundingClientRect()
      const pad = paddingRef.current
      const innerW = el.clientWidth - pad.l - pad.r
      // 확정 레이아웃의 카드 폭 — cardStyle 과 같은 식 (1 배면 기본 폭)
      const width = Math.round(baseWidthRef.current * next)

      // 중점 아래 있던 카드 지점이 손을 뗀 자리에 오려면 카드 좌상단이 컨테이너 border-box 안에서 놓여야 할 자리.
      // 세로는 헤더(frameTop 위)가 배율과 무관하므로 본문 시작점을 기준으로 배율을 곱한다 —
      // 미리보기(transform)는 카드 전체를 키우지만 확정 레이아웃은 본문만 커진다
      const wantLeft = live.midX - mr.left - st.px * ratio
      const py = st.py <= st.frameTop ? st.py : st.frameTop + (st.py - st.frameTop) * ratio
      const wantTop = live.midY - mr.top - py

      // 가로: margin-left 로 배치(패딩 안쪽 기준). 카드 가장자리가 컨테이너 안쪽으로 들어오지 않게 clamp —
      // 좁으면 [0, 남는 폭], 넓으면 [-(넘치는 폭), 0]. 1 배는 기본 레이아웃으로 복귀
      const zoomed = next > 1.001
      const left = zoomed
        ? Math.round(clamp(wantLeft - pad.l, Math.min(0, innerW - width), Math.max(0, innerW - width)))
        : 0
      // 세로: 카드 위 가장자리는 컨테이너 위에 붙인다 (음수 scrollTop 불가)
      const scrollTop = Math.max(0, st.cardOffsetTop - wantTop)
      // 목표 scrollTop 만큼 스크롤 범위가 있는지 — 확정 뒤 카드 높이 = 내용(본문만 ratio 배) vs min-height 100%(패딩 제외)
      let slack = 0
      if (zoomed && scrollTop > 0) {
        const predicted = st.naturalHeight + st.frameHeight * (ratio - 1)
        const minCardH = el.clientHeight - pad.t - pad.b
        const room = st.otherHeight + Math.max(minCardH, predicted) - el.clientHeight
        slack = Math.max(0, Math.ceil(scrollTop - room))
      }
      const nextLayout: Layout = {
        zoom: next,
        left,
        slack,
        barWidth: Math.min(width, innerW),
        barOffset: pad.l + Math.max(0, left),
        mainLeft: mr.left,
      }

      // 확정 렌더를 동기로 끝낸 뒤 transform 을 지운다 — 순서가 바뀌면 1 배로 한 프레임 튕긴다.
      // 상태가 그대로면(순수 이동·clamp) 효과가 돌지 않으니 스크롤을 여기서 직접 적용
      pendingScrollRef.current = { top: scrollTop }
      flushSync(() => {
        setLayout((prev) =>
          (Object.keys(nextLayout) as (keyof Layout)[]).every((k) => prev[k] === nextLayout[k]) ? prev : nextLayout,
        )
      })
      if (pendingScrollRef.current) {
        pendingScrollRef.current = null
        el.scrollLeft = 0
        el.scrollTop = scrollTop
      }
      card.style.transform = ''
      card.style.willChange = ''
    }

    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [scroller, card])

  const zoomed = layout.zoom > 1.001
  /** 스크롤 컨테이너 — 확대 중 가로는 margin-left 가 담당하므로 넘치는 카드를 잘라 스크롤 범위가 생기지 않게 한다.
   *  정렬은 카드(alignSelf)만 바꿔 sticky 바 등 다른 자식은 그대로 */
  const scrollerStyle: CSSProperties = zoomed ? { overflowX: 'hidden' } : {}
  /** 카드 — 기본 폭 × zoom, 왼쪽 기준 배치 + 확정한 가로 위치(margin-left, 음수 가능) + 세로 여유(--pinch-slack) */
  const cardStyle: CSSProperties = zoomed
    ? ({
        width: Math.round(baseWidth * layout.zoom),
        maxWidth: 'none',
        alignSelf: 'flex-start',
        marginLeft: layout.left,
        '--pinch-slack': `${layout.slack}px`,
      } as CSSProperties)
    : {}
  /**
   * 하단 바(답안 바·리뷰 버튼 바) — 확대해도 바는 커지지 않고, 카드의 "보이는 구간"(카드 폭과 컨테이너 폭 중 작은 쪽)을
   * 그대로 덮는다. 1 배 때처럼 카드 폭에 맞춰 두면 커진 카드 한가운데 500px 바가 떠 있게 된다.
   * - stickyBarStyle: 컨테이너 안 sticky 바 (리뷰 화면) — 카드처럼 alignSelf + margin-left
   * - fixedBarStyle: 뷰포트 fixed 바 (풀이 화면 answerBar) — transform 은 건드리지 않는다. 바에는 iOS 키보드 보정이
   *   visualViewport 이벤트마다 transform: translate(-50%, y) 를 직접 쓰므로(TrialQuizPage) 인라인 transform:none 은
   *   곧 덮어써진다 (아이패드에서 바가 절반 밀려 나가던 원인 · 2026-09-04). 대신 left 를 "바 중심" 좌표로 준다
   */
  const stickyBarStyle: CSSProperties = zoomed
    ? { width: layout.barWidth, maxWidth: 'none', alignSelf: 'flex-start', marginLeft: layout.barOffset }
    : {}
  const fixedBarStyle: CSSProperties = zoomed
    ? {
        width: layout.barWidth,
        maxWidth: 'none',
        minWidth: 0,
        // translateX(-50%) 가 유지되므로 left = 바 중심
        left: layout.mainLeft + layout.barOffset + layout.barWidth / 2,
      }
    : {}

  return { zoom: layout.zoom, zoomed, scrollerStyle, cardStyle, stickyBarStyle, fixedBarStyle }
}

/**
 * 페이지 전체의 브라우저 네이티브 확대(핀치·더블탭) 차단 (2026-09-03).
 * viewport user-scalable=no 는 iOS 사파리가 무시한다. CSS touch-action(.page: pan-x pan-y)이 1차 방어,
 * 여기서는 (1) 두 손가락 이상 touchmove 를 preventDefault — 확대 영역 밖(헤더·필기 도구·배경)에서 시작한
 * 핀치가 페이지를 키우지 않게 (2) WebKit 전용 gesturestart/gesturechange 를 preventDefault — iOS 가 핀치를
 * 제스처로 인식해 버린 뒤에도 확대를 적용하지 않게.
 * 확대 영역 안의 핀치는 usePinchZoom 이 이미 preventDefault 하므로 영향 없다. 두 손가락 스크롤은 잃지만
 * 확대 영역 밖에는 스크롤할 것이 없다.
 */
export function useBlockNativePinch() {
  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    const onGesture = (e: Event) => e.preventDefault()
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('gesturestart', onGesture)
    document.addEventListener('gesturechange', onGesture)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('gesturestart', onGesture)
      document.removeEventListener('gesturechange', onGesture)
    }
  }, [])
}

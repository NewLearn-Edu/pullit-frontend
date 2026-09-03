/**
 * 1€ (One Euro) 필터 — 펜 입력 지터 제거용 저역 필터 (Casiez et al., CHI 2012).
 *
 * 느리게 움직일 때는 컷오프를 낮춰 손떨림·센서 노이즈(±0.5~1px)를 강하게 눌러 주고,
 * 빠르게 움직일 때는 컷오프를 올려 지연(래그)이 거의 없게 한다 — 하드 이동 게이트(N px 미만 버림)처럼
 * 작은 글씨의 점을 통째로 버려 획이 각지거나 꿈틀거리는 부작용이 없다.
 *
 * 단위: 좌표는 화면 px, 시간은 ms(event.timeStamp). 파라미터 기준도 화면 px/초.
 * - minCutoff(Hz): 낮을수록 저속 떨림을 더 누른다 (지연 ↑)
 * - beta: 속도에 따른 컷오프 증가율 — 클수록 빠른 획이 덜 미끄러진다
 */
export class OneEuroFilter {
  private xPrev: number | null = null
  private dxPrev = 0
  private tPrev = 0

  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number

  constructor(minCutoff: number, beta: number, dCutoff = 1) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  reset(x: number, t: number): number {
    this.xPrev = x
    this.dxPrev = 0
    this.tPrev = t
    return x
  }

  next(x: number, t: number): number {
    if (this.xPrev == null) return this.reset(x, t)
    let dt = (t - this.tPrev) / 1000
    // 같은 타임스탬프로 묶여 온 coalesced 이벤트 — 리포트 간격(약 120~240Hz)로 가정
    if (!(dt > 0)) dt = 1 / 180
    this.tPrev = t

    const dx = (x - this.xPrev) / dt
    const edx = OneEuroFilter.lowPass(dx, this.dxPrev, OneEuroFilter.alpha(dt, this.dCutoff))
    this.dxPrev = edx

    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    const filtered = OneEuroFilter.lowPass(x, this.xPrev, OneEuroFilter.alpha(dt, cutoff))
    this.xPrev = filtered
    return filtered
  }

  private static alpha(dt: number, cutoff: number): number {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  private static lowPass(x: number, prev: number, a: number): number {
    return a * x + (1 - a) * prev
  }
}

/** x·y 를 각각 1€ 로 거르는 2D 포인트 필터 */
export class OneEuroPointFilter {
  private readonly fx: OneEuroFilter
  private readonly fy: OneEuroFilter

  /**
   * 펜 필기 기본값 (2026-09-03 · 합성 궤적 실험으로 조정).
   * 반경 6px 원을 60px/s 로 그릴 때(작은 글씨) 방향 변화 합이 필터 없음 대비 약 1/5, 펜촉 지연 0.8px.
   * 600px/s 보통 속도에서 지연 약 3px(1프레임 미만), 2000px/s 빠른 획에서 약 4px.
   * minCutoff 를 낮추면 느린 글씨가 더 매끈해지지만 빠른 획이 뒤따라오는 느낌이 커진다.
   */
  constructor(minCutoff = 3, beta = 0.2, dCutoff = 1) {
    this.fx = new OneEuroFilter(minCutoff, beta, dCutoff)
    this.fy = new OneEuroFilter(minCutoff, beta, dCutoff)
  }

  reset(x: number, y: number, t: number): [number, number] {
    return [this.fx.reset(x, t), this.fy.reset(y, t)]
  }

  next(x: number, y: number, t: number): [number, number] {
    return [this.fx.next(x, t), this.fy.next(y, t)]
  }
}

/**
 * 수학 약점 지도 그래프 (Figma 2370-9041 · 2536-2709)
 *
 * 좌표는 피그마 시안의 월드 좌표를 그대로 사용 (노드 좌상단 기준).
 * POC 목 데이터 — 진단 API 연동 시 score/state/stats 만 서버 값으로 교체하면 된다.
 */

export const NODE_W = 207
export const NODE_H = 99

export type MapNodeState = 'weak' | 'done' | 'locked'

export interface MapNode {
  id: string
  /** 대분류 (카드 좌상단 라벨) */
  cat: string
  name: string
  x: number
  y: number
  state: MapNodeState
  score?: number
  /** 진단된 노드의 학습 통계 (바텀시트) */
  stats?: { solved: number; minutes: number }
}

export interface MapEdge {
  from: string
  to: string
  /** true = 간접 단원 (점선) */
  indirect?: boolean
}

export const MATH_MAP_NODES: MapNode[] = [
  // 대수
  { id: 'exp-log', cat: '대수', name: '지수·로그', x: 236, y: 526, state: 'weak', score: 68, stats: { solved: 9, minutes: 48 } },
  { id: 'exp-log-fn', cat: '대수', name: '지수·로그함수', x: 236, y: 684, state: 'done', score: 89, stats: { solved: 12, minutes: 72 } },
  { id: 'trig', cat: '대수', name: '삼각함수', x: 463, y: 526, state: 'locked' },
  { id: 'sine-cosine', cat: '대수', name: '사인·코사인법칙', x: 463, y: 684, state: 'locked' },
  { id: 'seq', cat: '대수', name: '등차·등비수열', x: 690, y: 526, state: 'locked' },
  { id: 'seq-sum', cat: '대수', name: '수열의 합', x: 690, y: 684, state: 'locked' },
  { id: 'induction', cat: '대수', name: '수학적 귀납법', x: 690, y: 842, state: 'locked' },
  // 미적분 I
  { id: 'limit', cat: '미적분 I', name: '함수의 극한', x: 1111, y: 526, state: 'locked' },
  { id: 'continuity', cat: '미적분 I', name: '함수의 연속', x: 1111, y: 684, state: 'locked' },
  { id: 'diff-coef', cat: '미적분 I', name: '미분계수', x: 1111, y: 842, state: 'locked' },
  { id: 'derivative', cat: '미적분 I', name: '도함수', x: 1111, y: 1000, state: 'locked' },
  { id: 'derivative-use', cat: '미적분 I', name: '도함수 활용', x: 997, y: 1158, state: 'locked' },
  { id: 'antiderivative', cat: '미적분 I', name: '부정적분', x: 1224, y: 1158, state: 'locked' },
  { id: 'integral', cat: '미적분 I', name: '정적분', x: 1111, y: 1316, state: 'locked' },
  { id: 'integral-use', cat: '미적분 I', name: '정적분 활용', x: 1111, y: 1474, state: 'locked' },
  // 확률과 통계
  { id: 'perm-comb', cat: '확률과 통계', name: '순열·조합', x: 1645, y: 526, state: 'locked' },
  { id: 'binomial', cat: '확률과 통계', name: '이항정리', x: 1531, y: 684, state: 'locked' },
  { id: 'prob-meaning', cat: '확률과 통계', name: '확률의 뜻·이용', x: 1758, y: 684, state: 'locked' },
  { id: 'cond-prob', cat: '확률과 통계', name: '조건부확률', x: 1645, y: 842, state: 'locked' },
  { id: 'prob-dist', cat: '확률과 통계', name: '확률분포', x: 1645, y: 1000, state: 'locked' },
  { id: 'stat-est', cat: '확률과 통계', name: '통계적 추정', x: 1645, y: 1158, state: 'locked' },
]

export const MATH_MAP_EDGES: MapEdge[] = [
  // 대수 선후수
  { from: 'exp-log', to: 'exp-log-fn' },
  { from: 'trig', to: 'sine-cosine' },
  { from: 'seq', to: 'seq-sum' },
  { from: 'seq-sum', to: 'induction' },
  // 미적분 I 선후수
  { from: 'limit', to: 'continuity' },
  { from: 'continuity', to: 'diff-coef' },
  { from: 'diff-coef', to: 'derivative' },
  { from: 'derivative', to: 'derivative-use' },
  { from: 'derivative', to: 'antiderivative' },
  { from: 'derivative-use', to: 'integral' },
  { from: 'antiderivative', to: 'integral' },
  { from: 'integral', to: 'integral-use' },
  // 확률과 통계 선후수
  { from: 'perm-comb', to: 'binomial' },
  { from: 'perm-comb', to: 'prob-meaning' },
  { from: 'binomial', to: 'cond-prob' },
  { from: 'prob-meaning', to: 'cond-prob' },
  { from: 'cond-prob', to: 'prob-dist' },
  { from: 'prob-dist', to: 'stat-est' },
  // 간접 단원 (점선 · 영역을 건너뛰는 연계)
  { from: 'exp-log-fn', to: 'derivative-use', indirect: true },
  { from: 'induction', to: 'diff-coef', indirect: true },
  { from: 'diff-coef', to: 'perm-comb', indirect: true },
]

/** 월드 좌표 경계 (여백 포함) — fit/클램프 계산용 */
export const MAP_BOUNDS = {
  minX: 100,
  minY: 400,
  maxX: 1758 + NODE_W + 120,
  maxY: 1474 + NODE_H + 120,
}

import type { MapEdge, MapNode } from './mathWeaknessMap'

/**
 * 영어 약점 지도 그래프 (Figma 2370-9311)
 *
 * 독해 능력 4분류가 각각 한 열 — 열 안에서 유형 4개가 수직 체인으로 이어진다.
 * (수학과 달리 영역 간 교차·간접 간선 없음)
 * 좌표는 시안 그대로 · 점수는 POC 목 — 진단 API 연동 시 교체.
 */

const COL_X = [405, 701, 997, 1293]
const ROW_Y = [353, 511, 669, 827]

export const ENGLISH_MAP_NODES: MapNode[] = [
  // 내용 파악
  { id: 'en-topic', cat: '내용 파악', name: '주제', x: COL_X[0], y: ROW_Y[0], state: 'weak', score: 68, stats: { solved: 9, minutes: 41 } },
  { id: 'en-title', cat: '내용 파악', name: '제목', x: COL_X[0], y: ROW_Y[1], state: 'done', score: 89, stats: { solved: 11, minutes: 58 } },
  { id: 'en-gist', cat: '내용 파악', name: '요지', x: COL_X[0], y: ROW_Y[2], state: 'locked' },
  { id: 'en-purpose', cat: '내용 파악', name: '목적', x: COL_X[0], y: ROW_Y[3], state: 'locked' },
  // 글의 흐름
  { id: 'en-claim', cat: '글의 흐름', name: '주장', x: COL_X[1], y: ROW_Y[0], state: 'locked' },
  { id: 'en-insert', cat: '글의 흐름', name: '문장 삽입', x: COL_X[1], y: ROW_Y[1], state: 'locked' },
  { id: 'en-order', cat: '글의 흐름', name: '글의 순서', x: COL_X[1], y: ROW_Y[2], state: 'locked' },
  { id: 'en-irrelevant', cat: '글의 흐름', name: '무관한 문장', x: COL_X[1], y: ROW_Y[3], state: 'locked' },
  // 어휘·추론
  { id: 'en-blank', cat: '어휘·추론', name: '빈칸 추론', x: COL_X[2], y: ROW_Y[0], state: 'locked' },
  { id: 'en-summary', cat: '어휘·추론', name: '요약문', x: COL_X[2], y: ROW_Y[1], state: 'locked' },
  { id: 'en-voca01', cat: '어휘·추론', name: '어휘 의미 01', x: COL_X[2], y: ROW_Y[2], state: 'locked' },
  { id: 'en-voca04', cat: '어휘·추론', name: '어휘 의미 04', x: COL_X[2], y: ROW_Y[3], state: 'locked' },
  // 정보 확인
  { id: 'en-notice-match', cat: '정보 확인', name: '안내문 내용 일치', x: COL_X[3], y: ROW_Y[0], state: 'locked' },
  { id: 'en-notice-mismatch', cat: '정보 확인', name: '안내문 내용 불일치', x: COL_X[3], y: ROW_Y[1], state: 'locked' },
  { id: 'en-content-mismatch', cat: '정보 확인', name: '본문 내용 불일치', x: COL_X[3], y: ROW_Y[2], state: 'locked' },
  { id: 'en-chart', cat: '정보 확인', name: '도표', x: COL_X[3], y: ROW_Y[3], state: 'locked' },
]

export const ENGLISH_MAP_EDGES: MapEdge[] = [
  { from: 'en-topic', to: 'en-title' },
  { from: 'en-title', to: 'en-gist' },
  { from: 'en-gist', to: 'en-purpose' },
  { from: 'en-claim', to: 'en-insert' },
  { from: 'en-insert', to: 'en-order' },
  { from: 'en-order', to: 'en-irrelevant' },
  { from: 'en-blank', to: 'en-summary' },
  { from: 'en-summary', to: 'en-voca01' },
  { from: 'en-voca01', to: 'en-voca04' },
  { from: 'en-notice-match', to: 'en-notice-mismatch' },
  { from: 'en-notice-mismatch', to: 'en-content-mismatch' },
  { from: 'en-content-mismatch', to: 'en-chart' },
]

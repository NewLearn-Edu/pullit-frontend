import { type WrongNoteItem } from '@/user/api/attemptApi'
import { type Problem } from '@/user/data/mockProblems'
import { MATH_MAP_NODES, type MapNode } from '@/user/data/mathWeaknessMap'
import { ENGLISH_MAP_NODES } from '@/user/data/englishWeaknessMap'
import { type Subject } from '@/user/stores/trialStore'

/**
 * 오답노트 그룹핑 — 서버 오답 항목을 소단원(지도 노드) 행에 배분한다.
 *
 * 서버 skill_node 는 DB 정식 명칭("지수와 로그"), 지도 노드는 축약 표기("지수·로그")라
 * 느슨한 정규화(·/와/과/공백 제거)로 매칭한다. 어느 노드에도 안 붙는 단원은
 * DB 명칭 그대로 해당 대분류 뒤에 추가 행으로 노출 (데이터 유실 방지).
 */

export interface WrongUnitRow {
  /** 상세 라우팅 키 — 매칭된 노드 id 또는 DB skill_node 명 */
  key: string
  name: string
  cat: string
  items: WrongNoteItem[]
}

const normalize = (s: string) => s.replace(/[·\s]/g, '').replace(/와|과/g, '')

function nodesOf(subject: Subject): MapNode[] {
  return subject === 'math' ? MATH_MAP_NODES : ENGLISH_MAP_NODES
}

export function groupWrongNotes(subject: Subject, items: WrongNoteItem[]): WrongUnitRow[] {
  const nodes = nodesOf(subject)
  const rows: WrongUnitRow[] = nodes.map((n) => ({
    key: n.id,
    name: n.name,
    cat: n.cat,
    items: [],
  }))

  const extras = new Map<string, WrongUnitRow>()
  for (const item of items) {
    const skill = item.skillNode ?? ''
    const matched = rows.find((r) => normalize(r.name) === normalize(skill))
    if (matched) {
      matched.items.push(item)
      continue
    }
    // 지도에 없는 단원 — DB 명칭 그대로 대분류 뒤에 추가
    const key = `db:${skill}`
    const row = extras.get(key) ?? {
      key,
      name: skill || '기타',
      cat: item.unitLarge ?? rows[0]?.cat ?? '',
      items: [],
    }
    row.items.push(item)
    extras.set(key, row)
  }

  return [...rows, ...extras.values()]
}

/** 상세 화면용 — 라우팅 키(unit key)로 해당 행 찾기 */
export function findWrongUnit(
  subject: Subject,
  items: WrongNoteItem[],
  key: string,
): WrongUnitRow | undefined {
  return groupWrongNotes(subject, items).find((r) => r.key === key)
}

/** "2026.08.10 06:00" — 시안 타임스탬프 표기 */
export function formatWrongAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 난이도별 권장/제한 시간 (초) — recommendedTimeSec 미수신 시 폴백
const TIME_BY_DIFFICULTY: Record<string, { rec: number; max: number }> = {
  basic: { rec: 120, max: 240 },
  normal: { rec: 180, max: 300 },
  advanced: { rec: 240, max: 420 },
}

/**
 * 오답노트 항목 → 풀이 화면(Problem) 변환.
 * 서버는 정답을 목록에 내려주지 않으므로 answer 는 0 (채점은 제출 API 가 담당).
 * 시간은 문항의 recommendedTimeSec(제한 = ×3)이 정본, 없으면 난이도 폴백.
 */
export function toSolveProblem(item: WrongNoteItem, index: number): Problem {
  const time = TIME_BY_DIFFICULTY[item.difficulty?.toLowerCase() ?? ''] ?? TIME_BY_DIFFICULTY.normal
  const tRecSec = item.recommendedTimeSec && item.recommendedTimeSec > 0 ? item.recommendedTimeSec : time.rec
  const tMaxSec = item.recommendedTimeSec && item.recommendedTimeSec > 0 ? item.recommendedTimeSec * 3 : time.max
  // 배점은 소수 허용 — 로컬 Problem.points(2|3|4)는 근사값으로만 쓴다
  const score = item.score ?? 3
  const points = score >= 4 ? 4 : score >= 3 ? 3 : 2
  return {
    id: index + 1,
    serverId: item.problemId,
    subject: item.subject === 'ENGLISH' ? 'english' : 'math',
    points,
    tRecSec,
    tMaxSec,
    bodyText: item.question ?? '',
    choices: item.choices ?? [],
    glossary: item.glossary?.length ? item.glossary : undefined,
    answer: 0, // 미공개 — 서버 채점 결과(submitAttempt 응답)만 신뢰
    explanation: { intent: '', correctAnalysis: '' },
  }
}

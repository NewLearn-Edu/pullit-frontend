import { type WrongNoteItem } from '@/user/api/attemptApi'
import { MATH_MAP_NODES, type MapNode } from '@/user/data/mathWeaknessMap'
import { ENGLISH_MAP_NODES } from '@/user/data/englishWeaknessMap'
import { type Subject } from '@/user/stores/tasteStore'

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

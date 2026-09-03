import { ExplainBlocksRender, type ExplainBlock } from './ExamBlocks'
import { EnglishExplainRender, MathExplainRender } from './ExamRender'

/**
 * 해설 렌더 단일 진입점 — 어드민·학생 화면이 같은 조판을 쓰게 한다.
 *
 * 해설 원본은 세 가지 형태로 들어온다:
 * - 블록 배열 (B안 신 포맷, 2026-08-09~) — 업로드 파일에서 바로 읽은 경우
 * - 블록 배열을 담은 JSON 문자열 — 서버 TEXT 컬럼에서 내려온 경우
 * - 마크다운 문자열 (구 포맷)
 * 앞 둘은 블록 렌더러로, 마지막은 과목별 문자열 렌더러로 보낸다.
 */

/** 블록 배열로 해석되면 배열을, 아니면 null (= 구 문자열 포맷) */
export function parseExplainBlocks(raw: unknown): ExplainBlock[] | null {
  if (Array.isArray(raw)) return raw as ExplainBlock[]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  // 마크다운 해설이 '[' 로 시작하는 일은 없다 — 값싼 선판정으로 JSON.parse 비용을 아낀다
  if (!trimmed.startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    // type 문자열을 가진 객체 배열만 블록으로 인정 (숫자 배열 등 오탐 방지)
    const isBlock = (b: unknown): b is ExplainBlock =>
      !!b && typeof b === 'object' && typeof (b as ExplainBlock).type === 'string'
    return parsed.every(isBlock) ? (parsed as ExplainBlock[]) : null
  } catch {
    return null
  }
}

interface ProblemExplainProps {
  /** 블록 배열 · JSON 문자열 · 마크다운 문자열 모두 허용 */
  explanation: string | ExplainBlock[] | null | undefined
  /** 'math' | 'english' (대소문자 무관) — 구 문자열 포맷의 렌더러 선택에만 쓰인다 */
  subject?: string | null
  /** 해설이 비었을 때 보여줄 문구 */
  emptyText?: string
}

export function ProblemExplain({
  explanation,
  subject,
  emptyText = '해설이 없어요',
}: ProblemExplainProps) {
  const blocks = parseExplainBlocks(explanation)
  if (blocks) return <ExplainBlocksRender blocks={blocks} />

  const Render = String(subject ?? '').toLowerCase() === 'english'
    ? EnglishExplainRender
    : MathExplainRender
  const text = typeof explanation === 'string' && explanation.trim() ? explanation : emptyText
  return <Render text={text} />
}

/**
 * 지문 해석(영어) 블록 파싱 — 원본은 [{text}] (type 없음) 또는 [{type:'paragraph', text}] 배열,
 * 서버에서는 그 JSON 문자열. 문단 텍스트 배열로 정규화한다. 해석이 없으면 null.
 */
export function parseTranslationParagraphs(raw: unknown): string[] | null {
  let value: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (!trimmed.startsWith('[')) return [trimmed]
    try {
      value = JSON.parse(trimmed)
    } catch {
      return [trimmed]
    }
  }
  if (!Array.isArray(value)) return null
  const paragraphs = value
    .map((b) => (typeof b === 'string' ? b : b && typeof b === 'object' ? (b as { text?: unknown }).text : null))
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
  return paragraphs.length > 0 ? paragraphs : null
}

/**
 * 지문 해석 렌더 — 문단 하나씩 해설과 같은 조판(밑줄 <u> 보존 · HTML 이스케이프)으로 그린다.
 * 어드민 미리보기와 학생 해설 패널 "해석" 탭이 같은 컴포넌트를 쓴다.
 */
export function ProblemTranslation({
  translation,
  emptyText = '해석이 없어요',
}: {
  translation: string | unknown[] | null | undefined
  emptyText?: string
}) {
  const paragraphs = parseTranslationParagraphs(translation)
  if (!paragraphs) return <EnglishExplainRender text={emptyText} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {paragraphs.map((text, i) => (
        <EnglishExplainRender key={i} text={text} />
      ))}
    </div>
  )
}

/**
 * 어휘 목록 (영어) — 풀이 탭·어드민 미리보기 하단 "어휘". term 은 원문 서체, meaning 은 한국어.
 * 비어 있으면 아무것도 그리지 않는다 (섹션 타이틀은 호출부가 조건부로).
 */
export function ProblemVocabulary({ items }: { items: { term: string; meaning: string }[] | null | undefined }) {
  if (!items || items.length === 0) return null
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((v, i) => (
        <li key={`${v.term}-${i}`} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span lang="en" style={{ fontWeight: 700, flex: 'none' }}>
            {v.term}
          </span>
          <span>{v.meaning}</span>
        </li>
      ))}
    </ul>
  )
}

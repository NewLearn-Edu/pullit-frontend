import { ExamText } from './ExamText'
import { KatexText } from './KatexText'
import { EnglishProblemRender, MathProblemRender } from './ExamRender'
import './exam.css'

/**
 * question 블록 스키마 렌더러 (문제 생성 정책 · 2026-08-24 실데이터 확정 구조)
 *
 * 발문·지문·조판을 통합한 question 배열을 수능 조판으로 렌더한다.
 * 블록: prompt(발문) · paragraph(지문 단락) · box(주어진 문장·안내문 박스, 중첩 블록) ·
 *       table(도표 — headers/rows/align, 해설 table 과 동일 스키마)
 *
 * 텍스트는 ExamText 재사용 — 백틱 박스·<u>밑줄·**볼드**·KaTeX 인라인 마커가
 * 그대로 적용된다. ①~⑤(문장 삽입·무관한 문장 위치 표시)는 본문 문자 그대로 노출.
 */

export interface QuestionBlock {
  type: string
  /** prompt · paragraph */
  text?: string
  /** box — 중첩 블록 */
  blocks?: QuestionBlock[]
  /** table */
  headers?: string[]
  rows?: string[][]
  align?: string[]
}

/** 블록 배열로 해석되면 배열을, 아니면 null (= 구 문자열 본문) */
export function parseQuestionBlocks(raw: unknown): QuestionBlock[] | null {
  if (Array.isArray(raw)) return raw as QuestionBlock[]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const isBlock = (b: unknown): b is QuestionBlock =>
      !!b && typeof b === 'object' && typeof (b as QuestionBlock).type === 'string'
    return parsed.every(isBlock) ? (parsed as QuestionBlock[]) : null
  } catch {
    return null
  }
}

const ALIGN_MAP: Record<string, 'left' | 'center' | 'right'> = {
  left: 'left',
  center: 'center',
  right: 'right',
}

function renderBlock(
  b: QuestionBlock,
  key: number,
  english: boolean,
  scoreBadge?: React.ReactNode,
): React.ReactNode {
  switch (b.type) {
    case 'prompt':
      // 발문은 국문 — 영어 문항이라도 lang 을 걸지 않는다 (서체·분철 규칙).
      // 배점([N점])은 수능 지면처럼 발문 끝에 인라인으로 붙는다
      return (
        <p key={key} className="qb-prompt">
          <ExamText text={b.text ?? ''} keepChoiceMarkersInline />
          {scoreBadge && <> {scoreBadge}</>}
        </p>
      )

    case 'paragraph': {
      const body = <ExamText text={b.text ?? ''} keepChoiceMarkersInline />
      // 영어 지문 — 승인된 수능 지면 조판(STIX·양쪽 정렬·하이픈 분철, 구 .pv-passage 규칙)
      return (
        <div key={key} className={english ? 'qb-paragraph qb-en' : 'qb-paragraph'}>
          {english ? <span lang="en">{body}</span> : body}
        </div>
      )
    }

    case 'box':
      return (
        <div key={key} className="pv-box">
          {(b.blocks ?? []).map((c, j) => renderBlock(c, j, english))}
        </div>
      )

    case 'table': {
      const rows = b.rows ?? []
      if (rows.length === 0) return null
      const alignOf = (j: number): 'left' | 'center' | 'right' | undefined =>
        ALIGN_MAP[b.align?.[j] ?? '']
      return (
        <div key={key} className="exam-table-wrap">
          <table className="exam-table">
            {b.headers && b.headers.length > 0 && (
              <thead>
                <tr>
                  {b.headers.map((h, j) => (
                    <th key={j} className="exam-cell" style={{ textAlign: alignOf(j) }}>
                      <KatexText text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="exam-cell" style={{ textAlign: alignOf(c) }}>
                      <KatexText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    default:
      // 미지의 블록 타입 — 텍스트가 있으면 문단 폴백, 없으면 스킵 (렌더는 끊지 않는다)
      if (b.text) {
        return (
          <p key={key} className="qb-paragraph">
            <ExamText text={b.text} keepChoiceMarkersInline />
          </p>
        )
      }
      return null
  }
}

export function QuestionBlocksRender({
  blocks,
  subject,
  scoreBadge,
}: {
  blocks: QuestionBlock[]
  /** 'math' | 'english' (대소문자 무관) — 지문 단락의 영문 서체·분철 적용 여부 */
  subject?: string | null
  /** 배점 표기([N점]) — 첫 prompt 블록 끝에 인라인으로 붙는다 (수능 지면 규칙) */
  scoreBadge?: React.ReactNode
}) {
  const english = String(subject ?? '').toLowerCase() === 'english'
  const promptIdx = blocks.findIndex((b) => b.type === 'prompt')
  return (
    <div className="qb-root">
      {blocks.map((b, i) => renderBlock(b, i, english, i === promptIdx ? scoreBadge : undefined))}
      {/* prompt 블록이 없는 데이터 — 배점을 본문 끝에라도 남긴다 (유실 방지) */}
      {promptIdx < 0 && scoreBadge && <p className="qb-prompt">{scoreBadge}</p>}
    </div>
  )
}

/**
 * question 렌더 단일 진입점 — 어드민 미리보기·학생 화면이 같은 조판을 쓰게 한다.
 * 블록 배열·블록 직렬화 문자열은 블록 렌더러로, 구 문자열 본문은 과목별 렌더러로.
 */
export function QuestionRender({
  question,
  subject,
  scoreBadge,
}: {
  /** 블록 배열 · 블록 직렬화 문자열 · 구 문자열 본문 모두 허용 */
  question: unknown
  subject?: string | null
  /** 배점 표기([N점]) — 블록 조판은 발문 끝, 구 문자열 조판은 본문 끝에 인라인 */
  scoreBadge?: React.ReactNode
}) {
  const blocks = parseQuestionBlocks(question)
  if (blocks) return <QuestionBlocksRender blocks={blocks} subject={subject} scoreBadge={scoreBadge} />

  const text = typeof question === 'string' ? question : ''
  const body = String(subject ?? '').toLowerCase() === 'english' ? (
    <EnglishProblemRender text={text} />
  ) : (
    <MathProblemRender text={text} />
  )
  return (
    <>
      {body}
      {scoreBadge && <> {scoreBadge}</>}
    </>
  )
}

import { clsx } from 'clsx'
import { KatexText } from './KatexText'
import './exam.css'

/**
 * 해설 블록 스키마 렌더러 (2026-08-09 · B안 확정 포맷)
 *
 * AI 변환 파이프라인이 만드는 explanation 배열을 수능 조판으로 렌더한다.
 * 블록: paragraph(lead) · derivation(정렬 등식 체인) · formula(단일 식) ·
 *       cases((i)(ii) 분기) · conclusion(마무리) · note(부가 설명)
 *
 * 수식은 KatexText 재사용 — display 자동 축소(0.7~1배)·수능 보정(굵은 |·큰 ∪∩·
 * dfrac 승격)이 그대로 적용된다. derivation 의 & 정렬은 aligned 환경으로 조판.
 */

export interface ExplainBlock {
  type: string
  /** paragraph · note */
  text?: string
  /** paragraph — 뒤따르는 수식을 이끄는 문장 (수식과 밀착) */
  lead?: boolean
  /** derivation — "좌변 &= 우변" 형태의 줄들 */
  lines?: string[]
  /** formula */
  latex?: string
  /** cases */
  items?: Array<{ label: string; blocks: ExplainBlock[] }>
  /** conclusion */
  blocks?: ExplainBlock[]
}

export function ExplainBlocksRender({ blocks }: { blocks: ExplainBlock[] }) {
  return <div className="exam-blocks">{blocks.map((b, i) => renderBlock(b, i))}</div>
}

function renderBlock(b: ExplainBlock, key: number): React.ReactNode {
  switch (b.type) {
    case 'paragraph':
      return (
        <p key={key} className={clsx('xb-p', b.lead && 'xb-lead')}>
          <KatexText text={b.text ?? ''} />
        </p>
      )

    case 'derivation': {
      const lines = b.lines ?? []
      if (lines.length === 0) return null
      // & 정렬 유지 — 한 줄이어도 aligned 로 감싸 = 위치 기준을 통일
      // \\[0.5em] ≈ 8px 행간 — CSS 로 katex 내부를 건드리는 대신 조판에서 부여
      //             (수식 자동 축소 시에도 비례 유지)
      const tex = `\\begin{aligned}${lines.join(' \\\\[0.5em] ')}\\end{aligned}`
      return (
        <div key={key} className="xb-math">
          <KatexText text={`$$${tex}$$`} />
        </div>
      )
    }

    case 'formula':
      return (
        <div key={key} className="xb-math">
          <KatexText text={`$$${b.latex ?? ''}$$`} />
        </div>
      )

    case 'cases':
      return (
        <div key={key} className="xb-cases">
          {(b.items ?? []).map((item, j) => {
            // label 과 첫 paragraph 를 한 문장으로 병합 —
            // "(i) …인 경우, ~일 때 …" 수능 조판 (쉼표 시작 데이터도 자연 연결)
            const [first, ...rest] = item.blocks ?? []
            const mergeFirst = first?.type === 'paragraph'
            return (
              <div key={j} className="xb-case">
                <p className="xb-p">
                  <span className="xb-case-label">
                    <KatexText text={item.label} />
                  </span>
                  {mergeFirst && <KatexText text={first.text ?? ''} />}
                </p>
                {(mergeFirst ? rest : item.blocks ?? []).map((c, k) => (
                  <div key={k} className="xb-case-body">
                    {renderBlock(c, k)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )

    case 'conclusion':
      return (
        <div key={key} className="xb-conclusion">
          {(b.blocks ?? []).map((c, j) => renderBlock(c, j))}
        </div>
      )

    case 'note':
      return (
        <p key={key} className="xb-note">
          <KatexText text={b.text ?? ''} />
        </p>
      )

    default:
      // 미지의 블록 타입 — 텍스트가 있으면 문단 폴백, 없으면 스킵 (렌더는 끊지 않는다)
      if (b.text) {
        return (
          <p key={key} className="xb-p">
            <KatexText text={b.text} />
          </p>
        )
      }
      return null
  }
}

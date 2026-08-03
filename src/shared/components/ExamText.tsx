import { Fragment, type ReactNode } from 'react'
import { KatexText } from './KatexText'
import './exam.css'

/**
 * 수능 문제 본문 렌더러 — 문제·지문 텍스트의 마크업 3종을 처리한다.
 *
 * 1. `백틱 구간`   → 박스 (주어진 문장 · (가)(나)(다) 조건 박스). boxClassName 으로 스타일 지정
 * 2. <u>밑줄</u>   → 실제 밑줄 (어휘 · 어법 유형)
 * 3. $...$ · $$...$$ → KaTeX 수식 (KatexText 위임)
 *
 * 사용처: 어드민 문제 미리보기 · (추후) 학생 문제풀이 화면
 */
export function ExamText({
  text,
  boxClassName = 'pv-box',
}: {
  text: string
  boxClassName?: string
}) {
  const segments = String(text ?? '').split('`')
  // 박스 경계의 개행 흡수 — 데이터의 \n\n 이 빈 줄로 렌더되어 박스 마진과 겹치면
  // 박스 위아래에 큰 공백이 생긴다 (간격은 박스 CSS 마진이 담당)
  const cleaned = segments.map((segment, i) => {
    if (i % 2 === 1) return segment
    let out = segment
    if (i > 0) out = out.replace(/^[ \t]*\n+[ \t]*/, '')
    if (i < segments.length - 1) out = out.replace(/[ \t]*\n+[ \t]*$/, '')
    return out
  })
  return (
    <>
      {cleaned.map((segment, i) =>
        i % 2 === 1 ? (
          <div key={i} className={boxClassName}>
            <BoxContent text={segment} />
          </div>
        ) : (
          <UnderlinedText key={i} text={segment} />
        ),
      )}
    </>
  )
}

/**
 * 박스 내용 렌더 — (가)(나)(다) 조건 항목을 나눠 항목 사이에만 간격을 준다.
 * (한 조건이 길어 줄바꿈될 때는 일반 줄간격 유지 · 조건 마커가 없으면 그대로)
 */
function BoxContent({ text }: { text: string }) {
  const items = text.split(/\n(?=\s*\([가-힣]\))/)
  if (items.length <= 1) return <UnderlinedText text={text} />
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="pv-box-item">
          <UnderlinedText text={item.replace(/^\n+/, '')} />
        </div>
      ))}
    </>
  )
}

/** <u>...</u> 구간을 실제 밑줄로 변환하고, 나머지는 KatexText 로 넘긴다 */
function UnderlinedText({ text }: { text: string }) {
  if (!text) return null
  const parts: ReactNode[] = []
  const pattern = /<u>([\s\S]*?)<\/u>/g
  let cursor = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(<KatexText key={key++} text={text.slice(cursor, match.index)} />)
    }
    // 짧은 밑줄 구간(1~2단어)만 한 덩어리로 묶어 내부 공백 늘어남·줄바꿈을 막는다.
    // 기준을 넉넉히 잡으면 구 전체가 다음 줄로 밀리며 윗줄이 확 벌어지므로 25자로 제한.
    // 긴 구·문장 밑줄은 수능 지면처럼 정상 줄바꿈 (밑줄은 줄마다 이어짐).
    const compact = match[1].length <= 25
    parts.push(
      <u
        key={key++}
        style={{
          // 수능 지면 밑줄: g·p 꼬리에서 끊기지 않는 연속선을 꼬리 아래에 긋는다
          textDecorationSkipInk: 'none',
          textUnderlineOffset: 4,
          textDecorationThickness: 1,
          ...(compact ? { display: 'inline-block' } : {}),
        }}
      >
        <KatexText text={match[1]} />
      </u>,
    )
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    parts.push(<KatexText key={key++} text={text.slice(cursor)} />)
  }
  return <Fragment>{parts}</Fragment>
}

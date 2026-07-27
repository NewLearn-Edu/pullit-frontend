import { KatexText } from '@/shared/components/KatexText'

/**
 * 업로드 문항 본문 렌더러 (프로토타입 fmtRich 포팅).
 * $...$ 수식은 KatexText 로, 백틱(`...`)으로 감싼 블록은 조건 박스(pv-passage)로 표시.
 */
export function RichText({ text }: { text: string }) {
  const parts = String(text ?? '').split('`')
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <div key={i} className="pv-passage" style={{ margin: '12px 0' }}>
            <KatexText text={part} />
          </div>
        ) : (
          <KatexText key={i} text={part} />
        ),
      )}
    </>
  )
}

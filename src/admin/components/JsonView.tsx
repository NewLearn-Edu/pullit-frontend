import { Fragment, type ReactNode } from 'react'

/**
 * 원본 JSON 뷰 — 문항 객체를 최상위 필드별 행으로 나누고 신택스 컬러를 입힌다.
 * 값은 JSON.stringify 기준으로 표시해 원본 파일의 이스케이프(\\frac, \n 등)가
 * 그대로 보인다 — 렌더링 결과와 소스를 대조하는 용도.
 */

const INDENT = '  '

function renderValue(value: unknown, depth: number): ReactNode {
  if (value === null || value === undefined) return <span className="jv-null">null</span>
  if (typeof value === 'string') return <span className="jv-str">{JSON.stringify(value)}</span>
  if (typeof value === 'number') return <span className="jv-num">{String(value)}</span>
  if (typeof value === 'boolean') return <span className="jv-bool">{String(value)}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return (
      <>
        {'[\n'}
        {value.map((el, i) => (
          <Fragment key={i}>
            {INDENT.repeat(depth + 1)}
            {renderValue(el, depth + 1)}
            {i < value.length - 1 ? ',' : ''}
            {'\n'}
          </Fragment>
        ))}
        {INDENT.repeat(depth)}
        {']'}
      </>
    )
  }
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return '{}'
  return (
    <>
      {'{\n'}
      {entries.map(([k, v], i) => (
        <Fragment key={k}>
          {INDENT.repeat(depth + 1)}
          <span className="jv-key">{JSON.stringify(k)}</span>
          {': '}
          {renderValue(v, depth + 1)}
          {i < entries.length - 1 ? ',' : ''}
          {'\n'}
        </Fragment>
      ))}
      {INDENT.repeat(depth)}
      {'}'}
    </>
  )
}

export default function JsonView({ data }: { data: unknown }) {
  // 객체가 아니면(방어) 필드 분해 없이 통짜로
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return <pre className="json-view-pre">{renderValue(data, 0)}</pre>
  }
  return (
    <div className="json-view">
      {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
        <div className="jv-row" key={key}>
          <span className="jv-field">{key}</span>
          <pre className="json-view-pre">{renderValue(value, 0)}</pre>
        </div>
      ))}
    </div>
  )
}

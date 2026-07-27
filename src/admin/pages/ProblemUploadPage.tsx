import { useRef, useState, type DragEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { RichText } from '../components/RichText'
import { useToast } from '../components/toast'
import { IcoUpload } from '../components/icons'
import { codeToPath } from '../data/mockAdmin'

const SUBJECT_LABEL: Record<string, string> = { math: '수학', english: '영어' }

interface UploadItem {
  id?: string | number
  question?: string
  choices?: string[]
  answer_no?: number
  explanation?: string
}

export default function ProblemUploadPage() {
  const { subject = '' } = useParams()
  const label = SUBJECT_LABEL[subject]
  const toast = useToast()

  const [items, setItems] = useState<UploadItem[]>([])
  const [idx, setIdx] = useState(0)
  const [fileName, setFileName] = useState('')
  const [filePath, setFilePath] = useState('')
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!label) return <Navigate to="/admin/upload/math" replace />

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      let parsed: unknown
      try {
        const text = String(reader.result).trim()
        parsed = text.startsWith('[')
          ? JSON.parse(text)
          : text.split('\n').filter(Boolean).map((l) => JSON.parse(l))
      } catch {
        toast('파일을 읽지 못했어요 · JSON/JSONL 형식을 확인해주세요')
        return
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        toast('문항이 없는 파일이에요')
        return
      }
      setItems(parsed as UploadItem[])
      setIdx(0)
      setFileName(file.name)
      const code = file.name.replace(/\.(jsonl|json)$/i, '')
      setFilePath(codeToPath(code) ?? '단원 자동 인식 실패 — 파일명이 2022_x_x_x 형식인지 확인해주세요')
    }
    reader.readAsText(file)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files[0]
    if (f) loadFile(f)
  }

  const reset = () => {
    setItems([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const item = items[idx]

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>{label} 문제 업로드</h2>
          <p className="page-sub">JSON 파일을 올리면 파일명으로 단원이 자동 분류되고, 문제를 바로 검토할 수 있어요</p>
        </div>
      </div>

      {items.length === 0 ? (
        /* 1) 파일 선택 */
        <div className="card">
          <div
            className={clsx('dropzone', over && 'over')}
            onClick={() => fileRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setOver(true) }}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={(e) => { e.preventDefault(); setOver(false) }}
            onDrop={onDrop}
          >
            <div className="dz-ico"><IcoUpload /></div>
            <b>JSON 파일을 끌어다 놓거나 클릭해서 선택하세요</b>
            <p>파일명으로 단원이 자동 인식돼요 · 예: 2022_1_1_1.jsonl → 대수 › 지수함수와 로그함수 › 지수와로그</p>
            <div className="formats">
              <span className="chip">JSONL</span>
              <span className="chip">JSON</span>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.jsonl"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) loadFile(f)
            }}
          />
        </div>
      ) : (
        /* 2) 업로드 결과: 요약 + 렌더링 검토 */
        <div>
          <div className="card upl-summary">
            <span className="file-ico csv">{'{ }'}</span>
            <div className="t">
              <b>{fileName}</b>
              <span>{filePath}</span>
            </div>
            <span className="badge neutral">{items.length.toLocaleString()}문항</span>
            <button className="btn btn-ghost" onClick={reset}>다른 파일</button>
            <button
              className="btn btn-primary"
              onClick={() => toast(`${items.length.toLocaleString()}문항 업로드가 접수됐어요 · 검수 대기로 등록됩니다`)}
            >
              업로드하기
            </button>
          </div>

          <div className="card">
            <div className="viewer-head">
              <div className="card-title">
                문항 {idx + 1} / {items.length}{item?.id ? ` · ${item.id}` : ''}
              </div>
              <div className="viewer-nav">
                <button className="btn btn-ghost btn-sm" onClick={() => idx > 0 && setIdx(idx - 1)}>
                  ‹ 이전
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => idx < items.length - 1 && setIdx(idx + 1)}>
                  다음 ›
                </button>
              </div>
            </div>
            <div className="pv-body vw-body">
              <div className="pv-question"><RichText text={item?.question ?? ''} /></div>
              <div className="pv-choices">
                {(item?.choices ?? []).map((c, i) => (
                  <span key={i} className={clsx('choice', item?.answer_no === i + 1 && 'correct')}>
                    <span className="choice-num">{i + 1}</span>
                    <span><RichText text={c} /></span>
                  </span>
                ))}
              </div>
              {item?.answer_no != null && <div className="vw-answer">정답 {item.answer_no}번</div>}
              {/* key={idx} — 문항 이동 시 해설 접힘 상태 초기화 (프로토타입과 동일) */}
              <details key={idx} className="vw-expl">
                <summary>해설 보기</summary>
                <div className="pv-question vw-expl-body">
                  <RichText text={item?.explanation || '해설이 없어요'} />
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

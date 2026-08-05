import { useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import axios from 'axios'
import clsx from 'clsx'
import {
  EnglishExplainRender,
  EnglishProblemRender,
  MathExplainRender,
  MathProblemRender,
} from '@/shared/components/ExamRender'
import { MathExplainKatexRender } from '@/shared/components/ExamRender'
import { useToast } from '../components/toast'
import { IcoUpload } from '../components/icons'
import { codeToPath } from '../data/mockAdmin'
import { importProblemFile, type ProblemImportResult } from '../api/adminApi'

const SUBJECT_LABEL: Record<string, string> = { math: '수학', english: '영어' }

/** 배점 미리보기 — 임포터와 동일 규칙 (수학 difficulty 매핑 · 영어 2점) */
const POINTS_BY_DIFFICULTY: Record<string, number> = { basic: 2, normal: 3, advanced: 4 }

interface UploadItem {
  id?: string | number
  subject?: string
  question?: string
  passage?: string
  choices?: string[]
  answer_no?: number
  answer_text?: string
  explanation?: string
  difficulty?: string
}

export default function ProblemUploadPage() {
  const { subject: subjectParam = '' } = useParams()
  const toast = useToast()

  const [items, setItems] = useState<UploadItem[]>([])
  const [idx, setIdx] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [filePath, setFilePath] = useState('')
  const [over, setOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ProblemImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 과목 자동 감지 — 단일 "문제 업로드" 메뉴 대응. 파일 rows 의 subject 필드 우선, URL 파라미터는 폴백
  const detected =
    items[0]?.subject === 'english' ? 'english' : items[0]?.subject === 'math' ? 'math' : null
  const subject = detected ?? subjectParam
  const label = SUBJECT_LABEL[subject]

  // 검토 디바이스 프레임 — 목록 미리보기 모달과 동일 (웹/패드-드래그/모바일 375)
  const [device, setDevice] = useState<'web' | 'pad' | 'mobile'>('web')
  // 해설 엔진 비교 — mathjax(검수 도구 방식·기본) vs katex(우리 구 조판)
  const [engine, setEngine] = useState<'katex' | 'mathjax'>('mathjax')
  const [padWidth, setPadWidth] = useState(524)
  const startPadDrag = (e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = padWidth
    const onMove = (ev: MouseEvent) => {
      // 내부 문제 영역(프레임 패딩 24px 제외)이 350~500px 을 오가는 범위
      setPadWidth(Math.min(524, Math.max(374, startWidth + ev.clientX - startX)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // 알 수 없는 과목 파라미터만 리다이렉트 — 파라미터 없는 /admin/upload 는 파일에서 과목 감지
  if (subjectParam && !SUBJECT_LABEL[subjectParam]) return <Navigate to="/admin/upload" replace />

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
      setFile(file)
      setResult(null)
      setFileName(file.name)
      const code = file.name.replace(/\.(jsonl|json)$/i, '')
      setFilePath(codeToPath(code) ?? '단원 자동 인식 실패 — 파일명이 2022_x_x_x 형식인지 확인해주세요')
    }
    reader.readAsText(file)
  }

  const onUpload = async () => {
    if (!file || uploading) return
    setUploading(true)
    try {
      const r = await importProblemFile(file)
      setResult(r)
      toast(`업로드 완료 · 신규 ${r.inserted.toLocaleString()} · 갱신 ${r.updated.toLocaleString()}${r.failed > 0 ? ` · 실패 ${r.failed.toLocaleString()}` : ''}`)
    } catch (e) {
      const serverMsg = axios.isAxiosError(e) ? e.response?.data?.message : null
      toast(serverMsg ?? '업로드 실패 · 백엔드 연결과 어드민 권한을 확인해주세요')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files[0]
    if (f) loadFile(f)
  }

  const reset = () => {
    setItems([])
    setFile(null)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const item = items[idx]
  // 본문 렌더러 — 과목·용도별 4종 중 선택 (공용 ExamRender 만 사용)
  const ProblemRender = subject === 'english' ? EnglishProblemRender : MathProblemRender
  const ExplainRender = subject === 'english' ? EnglishExplainRender : MathExplainRender

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            {label ? `${label} 문제 업로드` : '문제 업로드'}
          </h2>
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
              disabled={uploading}
              onClick={onUpload}
            >
              {uploading ? '업로드 중…' : '업로드하기'}
            </button>
          </div>

          {result && (
            <div className="card upl-summary">
              <span className="badge neutral">DB 저장 완료</span>
              <div className="t">
                <b>
                  총 {result.total.toLocaleString()}문항 · 신규 {result.inserted.toLocaleString()} · 갱신 {result.updated.toLocaleString()}
                  {result.inactiveCount > 0 && ` · 비노출 ${result.inactiveCount.toLocaleString()}`}
                  {result.failed > 0 && ` · 실패 ${result.failed.toLocaleString()}`}
                </b>
                {result.errors.length > 0 && (
                  <span>
                    {result.errors.slice(0, 5).map((er) => `${er.line}행 ${er.problemId ?? ''}: ${er.reason}`).join(' · ')}
                    {result.failed > result.errors.length && ' …'}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="viewer-head">
              <div className="card-title">
                문항 {idx + 1} / {items.length}{item?.id ? ` · ${item.id}` : ''}
              </div>
              <div className="viewer-nav">
                <div className="seg pv-device-seg">
                  {([['web', '웹'], ['pad', '패드'], ['mobile', '모바일']] as const).map(([key, tabLabel]) => (
                    <button key={key} className={clsx(device === key && 'on')} onClick={() => setDevice(key)}>
                      {tabLabel}
                    </button>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => idx > 0 && setIdx(idx - 1)}>
                  ‹ 이전
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => idx < items.length - 1 && setIdx(idx + 1)}>
                  다음 ›
                </button>
              </div>
            </div>
          </div>
          {/* 문제·정답해설은 헤더 카드 밖 — 페이지 배경 위의 독립 카드 2개.
              웹·모바일은 좌우로 벌리고, 패드는 붙여서 디바이더 드래그 */}
          <div className={clsx('upl-preview', device)}>
              <div
                className={clsx('pv-device', device)}
                style={device === 'pad' ? { width: padWidth } : undefined}
              >
                <div className="pv-device-inner">
                  <div className={clsx('pv-body', subject === 'english' && 'en')}>
                    <div className="pv-question">
                      <ProblemRender text={item?.question ?? ''} />
                      {(() => {
                        const points =
                          subject === 'english' ? 2 : POINTS_BY_DIFFICULTY[item?.difficulty ?? '']
                        return points ? <> [{points}점]</> : null
                      })()}
                    </div>
                    {item?.passage && (
                      <div className="pv-passage">
                        <ProblemRender text={item.passage} />
                      </div>
                    )}
                    {(item?.choices?.length ?? 0) > 0 && (
                      <div className="pv-choices">
                        {(item?.choices ?? []).map((c, i) => {
                          const correct = item?.answer_no === i + 1
                          return (
                            <span key={i} className={clsx('choice', correct && 'correct')}>
                              {/* ①~⑤(U+2460) · 정답은 채운 원문자 ❶~❺(U+2776) */}
                              <span className="choice-num">
                                {String.fromCodePoint((correct ? 0x2775 : 0x245f) + i + 1)}
                              </span>
                              <span><ProblemRender text={c} /></span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* 패드: 가운데 디바이더 드래그로 좌우 폭 조절 */}
              {device === 'pad' && <div className="pv-divider" onMouseDown={startPadDrag} />}
              <div className={clsx('pv-modal-explain', device === 'mobile' && 'fixed-375')}>
                <p className="pv-label">정답</p>
                <div className="pv-explain-body pv-explain-answer">
                  {(item?.choices?.length ?? 0) > 0 && item?.answer_no != null ? (
                    String.fromCodePoint(0x245f + item.answer_no)
                  ) : (
                    <ExplainRender text={String(item?.answer_text ?? item?.answer_no ?? '-')} />
                  )}
                </div>
                <p className="pv-label" style={{ marginTop: 20 }}>
                  해설
                  <button
                    className="upl-engine-toggle"
                    onClick={() => setEngine(engine === 'katex' ? 'mathjax' : 'katex')}
                    title="해설 렌더 엔진 전환 (비교용)"
                  >
                    {engine === 'katex' ? 'KaTeX' : 'MathJax'}
                  </button>
                </p>
                <div className="pv-explain-body">
                  {engine === 'katex' ? (
                    <MathExplainKatexRender text={item?.explanation || '해설이 없어요'} />
                  ) : (
                    <ExplainRender text={item?.explanation || '해설이 없어요'} />
                  )}
                </div>
              </div>
            </div>
        </div>
      )}
    </section>
  )
}

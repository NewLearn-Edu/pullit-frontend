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
import { ExplainBlocksRender } from '@/shared/components/ExamBlocks'
import { useToast } from '../components/toast'
import { IcoUpload } from '../components/icons'
import { codeToPath } from '../data/mockAdmin'
import { importProblemFile, type ProblemImportResult } from '../api/adminApi'
import {
  addToReviewQueue,
  makeReviewKey,
  type ReviewEntry,
  type ReviewProblem,
} from '../data/reviewQueue'

const SUBJECT_LABEL: Record<string, string> = { math: '수학', english: '영어' }

/** 배점 미리보기 — 임포터와 동일 규칙 (수학 difficulty 매핑 · 영어 2점) */
const POINTS_BY_DIFFICULTY: Record<string, number> = { basic: 2, normal: 3, advanced: 4 }

/** 업로드 파일 1행 — 검수 큐와 같은 스키마를 쓴다 */
type UploadItem = ReviewProblem

export default function ProblemUploadPage() {
  const { subject: subjectParam = '' } = useParams()
  const toast = useToast()

  const [items, setItems] = useState<UploadItem[]>([])
  const [idx, setIdx] = useState(0)
  // 문항 번호 점프 — 입력 중인 임시값 (null 이면 현재 번호 표시)
  const [jumpDraft, setJumpDraft] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [filePath, setFilePath] = useState('')
  const [over, setOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ProblemImportResult | null>(null)
  // 검수 큐에 담을 문항 (파일 내 인덱스) · 업로드 확인 팝업
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
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
      setChecked(new Set())
      setFile(file)
      setResult(null)
      setFileName(file.name)
      const code = file.name.replace(/\.(jsonl|json)$/i, '')
      setFilePath(codeToPath(code) ?? '단원 자동 인식 실패 — 파일명이 2022_x_x_x 형식인지 확인해주세요')
    }
    reader.readAsText(file)
  }

  /** 체크한 문항을 검수 큐에 적재 — 업로드 성공 직후 1회 */
  const pushCheckedToReview = () => {
    if (checked.size === 0) return
    const entries: ReviewEntry[] = [...checked]
      .sort((a, b) => a - b)
      .map((i) => ({
        key: makeReviewKey(fileName, items[i], i),
        problemId: String(items[i]?.id ?? `${fileName}#${i + 1}`),
        fileName,
        filePath,
        subject,
        problem: items[i],
        addedAt: new Date().toISOString(),
      }))
    const { added, skipped, stored } = addToReviewQueue(entries)
    if (!stored) {
      toast('검수 목록 저장 공간이 가득 찼어요 · 검수 페이지에서 정리해주세요')
      return
    }
    toast(
      `검수 목록에 ${added}문항 담았어요${skipped > 0 ? ` · 이미 담긴 ${skipped}문항 제외` : ''}`,
    )
  }

  const onUpload = async () => {
    if (!file || uploading) return
    setConfirmOpen(false)
    setUploading(true)
    try {
      const r = await importProblemFile(file)
      setResult(r)
      toast(`업로드 완료 · 신규 ${r.inserted.toLocaleString()} · 갱신 ${r.updated.toLocaleString()}${r.failed > 0 ? ` · 실패 ${r.failed.toLocaleString()}` : ''}`)
      pushCheckedToReview()
    } catch (e) {
      const serverMsg = axios.isAxiosError(e) ? e.response?.data?.message : null
      toast(serverMsg ?? '업로드 실패 · 백엔드 연결과 어드민 권한을 확인해주세요')
    } finally {
      setUploading(false)
    }
  }

  /** 번호 입력으로 해당 문항 이동 — 범위 밖은 1~N 으로 클램프 */
  const commitJump = () => {
    if (jumpDraft == null) return
    const n = parseInt(jumpDraft, 10)
    if (!Number.isNaN(n) && items.length > 0) {
      setIdx(Math.min(items.length, Math.max(1, n)) - 1)
    }
    setJumpDraft(null)
  }

  /** 현재 문항 검수 체크 토글 */
  const toggleChecked = () => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
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
    setChecked(new Set())
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
              onClick={() => setConfirmOpen(true)}
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
              {/* 좌측 묶음 — space-between 이 체크박스·제목·배지를 흩뜨리지 않게 한 덩어리로 */}
              <div className="viewer-head-left">
                {/* 검수 체크 — 담아 두면 업로드 시 문제 검수 페이지로 넘어간다 */}
                <label className="upl-check" title="문제 검수 목록에 담기">
                  <input type="checkbox" checked={checked.has(idx)} onChange={toggleChecked} />
                  <span className="upl-check-box" aria-hidden />
                </label>
                <div className="card-title">
                  문항{' '}
                  <input
                    className="jump-input"
                    type="text"
                    inputMode="numeric"
                    value={jumpDraft ?? String(idx + 1)}
                    aria-label="문항 번호로 이동"
                    title="번호 입력 후 Enter — 해당 문항으로 이동"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setJumpDraft(e.target.value.replace(/\D/g, ''))}
                    onBlur={commitJump}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                  />{' '}
                  / {items.length}{item?.id ? ` · ${item.id}` : ''}
                </div>
                {checked.size > 0 && (
                  <span className="badge neutral upl-check-count">검수 {checked.size}</span>
                )}
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
                  {/* 블록 스키마(배열)는 전용 렌더러 고정 — 엔진 토글은 구 문자열 포맷 비교용 */}
                  {Array.isArray(item?.explanation) ? (
                    <span className="upl-engine-toggle" title="블록 스키마 해설 (B안 포맷)">
                      블록
                    </span>
                  ) : (
                    <button
                      className="upl-engine-toggle"
                      onClick={() => setEngine(engine === 'katex' ? 'mathjax' : 'katex')}
                      title="해설 렌더 엔진 전환 (비교용)"
                    >
                      {engine === 'katex' ? 'KaTeX' : 'MathJax'}
                    </button>
                  )}
                </p>
                <div className="pv-explain-body">
                  {Array.isArray(item?.explanation) ? (
                    <ExplainBlocksRender blocks={item.explanation} />
                  ) : engine === 'katex' ? (
                    <MathExplainKatexRender text={item?.explanation || '해설이 없어요'} />
                  ) : (
                    <ExplainRender text={item?.explanation || '해설이 없어요'} />
                  )}
                </div>
              </div>
            </div>
        </div>
      )}

      {/* 업로드 확인 — 되돌리기 어려운 DB 적재라 한 번 더 확인 */}
      {confirmOpen && (
        <div className="cr-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="card cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginBottom: 10 }}>업로드할까요?</h3>
            <p className="page-sub" style={{ marginBottom: 16 }}>
              아래 파일의 문항이 DB에 저장돼요. 같은 ID가 이미 있으면 갱신됩니다.
            </p>
            <div className="upl-confirm-info">
              <div>
                <span>파일</span>
                <b>{fileName}</b>
              </div>
              <div>
                <span>단원</span>
                <b>{filePath}</b>
              </div>
              <div>
                <span>문항</span>
                <b>{items.length.toLocaleString()}문항</b>
              </div>
              {checked.size > 0 && (
                <div>
                  <span>검수 목록</span>
                  <b>{checked.size}문항 담김</b>
                </div>
              )}
            </div>
            <div className="cr-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
                취소
              </button>
              <button className="btn btn-primary" disabled={uploading} onClick={onUpload}>
                업로드
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

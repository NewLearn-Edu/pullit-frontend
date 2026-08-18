import { useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
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
import JsonView from '../components/JsonView'
import { codeToPath } from '../data/mockAdmin'
import {
  importProblemFile,
  overwriteProblems,
  type DuplicateProblem,
  type ProblemImportResult,
} from '../api/adminApi'
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

  // 중복 문제 목록 — 업로드 시 건너뛴 기존 id 들. 행 클릭 = 우측 패널 미리보기, 버튼 = 덮어쓰기
  const [dups, setDups] = useState<DuplicateProblem[]>([])
  const [dupSelectedId, setDupSelectedId] = useState<string | null>(null)
  const [overwriting, setOverwriting] = useState<string | 'all' | null>(null)
  const [confirmAllOpen, setConfirmAllOpen] = useState(false)

  // 파일 원본 행을 id 로 찾는 인덱스 — 덮어쓰기 요청 body 는 원본 행 그대로 보낸다
  const rowById = useMemo(() => {
    const map = new Map<string, UploadItem>()
    items.forEach((it) => map.set(String(it.id), it))
    return map
  }, [items])

  // 과목 자동 감지 — 단일 "문제 업로드" 메뉴 대응. 파일 rows 의 subject 필드 우선, URL 파라미터는 폴백
  const detected =
    items[0]?.subject === 'english' ? 'english' : items[0]?.subject === 'math' ? 'math' : null
  const subject = detected ?? subjectParam
  const label = SUBJECT_LABEL[subject]

  // 검토 디바이스 프레임 — 목록 미리보기 모달과 동일 (웹/패드-드래그/모바일 375)
  const [device, setDevice] = useState<'web' | 'pad' | 'mobile'>('web')
  // 해설 엔진 비교 — mathjax(검수 도구 방식·기본) vs katex(우리 구 조판)
  const [engine, setEngine] = useState<'katex' | 'mathjax'>('mathjax')
  // 원본 JSON 뷰 — 렌더링 결과와 소스 대조용, 현재 문항을 따라간다
  const [showJson, setShowJson] = useState(false)
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
      setDups(r.duplicates ?? [])
      setDupSelectedId(null)
      toast(
        `업로드 완료 · 신규 ${r.inserted.toLocaleString()}${(r.duplicates?.length ?? 0) > 0 ? ` · 중복 ${r.duplicates.length.toLocaleString()}건 건너뜀` : ''}${r.failed > 0 ? ` · 실패 ${r.failed.toLocaleString()}` : ''}`,
      )
      pushCheckedToReview()
    } catch (e) {
      const serverMsg = axios.isAxiosError(e) ? e.response?.data?.message : null
      toast(serverMsg ?? '업로드 실패 · 백엔드 연결과 어드민 권한을 확인해주세요')
    } finally {
      setUploading(false)
    }
  }

  /** 중복 문제 덮어쓰기 — 단건(행 버튼) 또는 전체(우측 상단 버튼) */
  const onOverwrite = async (targets: DuplicateProblem[], key: string | 'all') => {
    if (overwriting) return
    const rows = targets.map((d) => rowById.get(d.id)).filter(Boolean)
    if (rows.length === 0) {
      toast('원본 파일 행을 찾지 못했어요 · 파일을 다시 선택해주세요')
      return
    }
    setConfirmAllOpen(false)
    setOverwriting(key)
    try {
      const r = await overwriteProblems(rows)
      const doneIds = new Set(targets.map((d) => d.id))
      setDups((prev) => prev.filter((d) => !doneIds.has(d.id)))
      setDupSelectedId((prev) => (prev != null && doneIds.has(prev) ? null : prev))
      toast(
        `덮어쓰기 완료 · ${r.updated.toLocaleString()}문항${r.failed > 0 ? ` · 실패 ${r.failed.toLocaleString()}` : ''}`,
      )
    } catch (e) {
      const serverMsg = axios.isAxiosError(e) ? e.response?.data?.message : null
      toast(serverMsg ?? '덮어쓰기 실패 · 백엔드 연결과 어드민 권한을 확인해주세요')
    } finally {
      setOverwriting(null)
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
    setDups([])
    setDupSelectedId(null)
    setConfirmAllOpen(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const item = items[idx]

  /** 현재 문항 원본 JSON 복사 */
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item, null, 2))
      toast(`문항 ${idx + 1} JSON을 복사했어요`)
    } catch {
      toast('복사하지 못했어요')
    }
  }

  // 본문 렌더러 — 과목·용도별 4종 중 선택 (공용 ExamRender 만 사용)
  const ProblemRender = subject === 'english' ? EnglishProblemRender : MathProblemRender
  const ExplainRender = subject === 'english' ? EnglishExplainRender : MathExplainRender

  // 우측 패널에 띄울 중복 문제의 새(파일) 버전
  const dupItem = dupSelectedId != null ? rowById.get(dupSelectedId) : undefined
  const dupInfo = dupSelectedId != null ? dups.find((d) => d.id === dupSelectedId) : undefined
  const answerChangedCount = dups.filter((d) => d.answerChanged).length

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
                  {(result.duplicates?.length ?? 0) > 0 && ` · 중복 건너뜀 ${result.duplicates.length.toLocaleString()}`}
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

          {/* 중복 문제 — 저장하지 않고 건너뛴 목록. 행 클릭 = 우측 패널로 새 버전 미리보기 (목록 페이지와 같은 뾰롱 팝) */}
          {/* .card 래퍼가 아니라 .card + .card 전역 간격이 안 걸림 — 위아래 16px 직접 지정 */}
          {dups.length > 0 && (
            <div className={clsx('list-layout', dupSelectedId != null && 'open')} style={{ margin: '16px 0' }}>
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title">이미 존재하는 문제 {dups.length.toLocaleString()}건</div>
                    <div className="card-sub">
                      저장하지 않고 건너뛰었어요 · 행을 누르면 파일의 새 버전을 미리 볼 수 있어요
                      {answerChangedCount > 0 && ` · 정답 변경 ${answerChangedCount}건 주의`}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={overwriting != null}
                    onClick={() => setConfirmAllOpen(true)}
                  >
                    {overwriting === 'all' ? '덮어쓰는 중…' : '전체 덮어씌우기'}
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <colgroup>
                      <col style={{ width: 170 }} />
                      <col />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 108 }} />
                      <col style={{ width: 130 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>소분류</th>
                        <th>풀이 수</th>
                        <th>정답</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {dups.map((d) => (
                        <tr
                          key={d.id}
                          className={clsx(dupSelectedId === d.id && 'selected')}
                          onClick={() => setDupSelectedId(dupSelectedId === d.id ? null : d.id)}
                        >
                          <td className="num" style={{ color: 'var(--color-muted)' }}>{d.id}</td>
                          <td className="strong">
                            {d.skillNode}
                            {d.unitMid && <span className="sub">{d.unitLarge} › {d.unitMid}</span>}
                          </td>
                          <td className="num">{d.attemptCount.toLocaleString()}회</td>
                          <td>
                            {d.answerChanged
                              ? <span className="badge pending">정답 변경</span>
                              : <span className="badge neutral">동일</span>}
                          </td>
                          <td>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={overwriting != null}
                              onClick={(e) => {
                                e.stopPropagation()
                                onOverwrite([d], d.id)
                              }}
                            >
                              {overwriting === d.id ? '쓰는 중…' : '덮어씌우기'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* 우측 미리보기 — 파일에 담긴 새 버전 렌더링 (문제·정답·해설) */}
              <aside className="preview">
                <div className="card">
                  {dupItem && (
                    <>
                      <div className="card-head" style={{ marginBottom: 10 }}>
                        <div>
                          <div className="card-title num">{dupInfo?.id}</div>
                          <div className="card-sub">
                            파일의 새 버전 · 풀이 {dupInfo?.attemptCount.toLocaleString()}회
                            {dupInfo?.answerChanged && ' · 정답 변경'}
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDupSelectedId(null)}>
                          닫기
                        </button>
                      </div>
                      <div className={clsx('pv-body', subject === 'english' && 'en')}>
                        <div className="pv-question">
                          <ProblemRender text={dupItem.question ?? ''} />
                        </div>
                        {dupItem.passage && (
                          <div className="pv-passage">
                            <ProblemRender text={dupItem.passage} />
                          </div>
                        )}
                        {(dupItem.choices?.length ?? 0) > 0 && (
                          <div className="pv-choices">
                            {(dupItem.choices ?? []).map((c, i) => {
                              const correct = dupItem.answer_no === i + 1
                              return (
                                <span key={i} className={clsx('choice', correct && 'correct')}>
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
                      <p className="pv-label" style={{ marginTop: 16 }}>정답</p>
                      <div className="pv-explain-body pv-explain-answer">
                        {(dupItem.choices?.length ?? 0) > 0 && dupItem.answer_no != null ? (
                          String.fromCodePoint(0x245f + dupItem.answer_no)
                        ) : (
                          <ExplainRender text={String(dupItem.answer_text ?? dupItem.answer_no ?? '-')} />
                        )}
                      </div>
                      <p className="pv-label" style={{ marginTop: 16 }}>해설</p>
                      <div className="pv-explain-body">
                        {Array.isArray(dupItem.explanation) ? (
                          <ExplainBlocksRender blocks={dupItem.explanation} />
                        ) : (
                          <ExplainRender text={dupItem.explanation || '해설이 없어요'} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </aside>
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
                <button
                  className={clsx('btn btn-ghost btn-sm upl-json-btn', showJson && 'on')}
                  onClick={() => setShowJson(!showJson)}
                  title="현재 문항의 원본 JSON 보기"
                >
                  {'{ }'} JSON
                </button>
              </div>
            </div>
          </div>
          {/* 문제·정답해설은 헤더 카드 밖 — 페이지 배경 위의 독립 카드 2개.
              웹·모바일은 좌우로 벌리고, 패드는 붙여서 디바이더 드래그.
              JSON 대조 모드가 켜지면 문제·해설을 왼쪽에 세로로 쌓고 오른쪽에 JSON 패널 */}
          <div className={clsx('upl-compare', showJson && 'json-on')}>
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

          {/* 원본 JSON — 오른쪽 sticky 패널, 이전/다음 이동을 따라간다 */}
          {showJson && (
            <div className="card upl-json">
              <div className="upl-json-head">
                <span className="card-title">
                  원본 JSON · 문항 {idx + 1}{item?.id ? ` · ${item.id}` : ''}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={copyJson}>복사</button>
              </div>
              <JsonView data={item} />
            </div>
          )}
          </div>
        </div>
      )}

      {/* 전체 덮어쓰기 확인 — 유저 풀이 기록이 붙은 문제가 바뀔 수 있어 한 번 더 확인 */}
      {confirmAllOpen && (
        <div className="cr-overlay" onClick={() => setConfirmAllOpen(false)}>
          <div className="card cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginBottom: 10 }}>전체 덮어씌울까요?</h3>
            <p className="page-sub" style={{ marginBottom: 16 }}>
              기존 문제 {dups.length.toLocaleString()}건이 파일의 새 버전으로 교체돼요.
              {answerChangedCount > 0 && (
                <>
                  <br />
                  <b style={{ color: 'var(--color-primary)' }}>
                    정답이 바뀌는 문제가 {answerChangedCount}건 있어요
                  </b>
                  {' '}— 이미 푼 유저의 기록과 모순이 생길 수 있어요.
                </>
              )}
            </p>
            <div className="cr-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmAllOpen(false)}>
                취소
              </button>
              <button
                className="btn btn-primary"
                disabled={overwriting != null}
                onClick={() => onOverwrite(dups, 'all')}
              >
                전체 덮어씌우기
              </button>
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
              아래 파일의 문항이 DB에 저장돼요. 같은 ID가 이미 있으면 건너뛰고
              중복 목록으로 보여드려요 — 덮어쓸지 그때 선택하면 됩니다.
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

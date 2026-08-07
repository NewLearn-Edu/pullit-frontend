import { useCallback, useEffect, useMemo, useState, useRef, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useParams } from 'react-router-dom'
import axios from 'axios'
import clsx from 'clsx'
import {
  EnglishExplainRender,
  EnglishProblemRender,
  MathExplainRender,
  MathProblemRender,
} from '@/shared/components/ExamRender'
import { useToast } from '../components/toast'
import { IcoUpload } from '../components/icons'
import {
  fetchProblemDetail,
  fetchProblemFilters,
  fetchTrialTestGroups,
  fetchTrialTestItems,
  importTrialTestFile,
  type ApiSubject,
  type FilterNode,
  type ProblemDetail,
  type ProblemStatus,
  type TrialTestGroup,
  type TrialTestItem,
} from '../api/adminApi'

const SUBJECT_LABEL: Record<string, string> = { math: '수학', english: '영어' }
const API_SUBJECT: Record<string, ApiSubject> = { math: 'MATH', english: 'ENGLISH' }

const STATUS_LABEL: Record<ProblemStatus, string> = { ACTIVE: '게시 중', INACTIVE: '비공개' }
const STATUS_BADGE: Record<ProblemStatus, string> = { ACTIVE: 'live', INACTIVE: 'hidden' }

/** 맛보기 파일명 규칙 — 백엔드와 동일 (corrected_ 접두사 허용) */
const FILENAME_PATTERN = /^(?:corrected_)?(.+)_trial-test_(\d+)\.jsonl?$/

const formatDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')

/** 트리 정렬 — 교육과정/정책 확정 순서 (문제 목록 페이지와 동일 규칙) */
const NODE_ORDER: Record<string, string[]> = {
  'MATH:': ['대수', '미적분Ⅰ', '확률과 통계'],
  'MATH:대수': ['지수함수와 로그함수', '삼각함수', '수열'],
  'MATH:미적분Ⅰ': ['함수의 극한과 연속', '미분', '적분'],
  'MATH:확률과 통계': ['경우의 수', '확률', '통계'],
  // 영어 독해 능력 4분류 (2026-08-07 정책 확정) — 기초 언어 능력(어휘 쓰임·voca03)은 서비스 제외
  'ENGLISH:': ['중심 내용 파악', '논리 구조 이해', '종합·추론 능력', '정보 확인 능력'],
  'ENGLISH:중심 내용 파악': ['주제', '제목', '요지', '목적'],
  'ENGLISH:논리 구조 이해': ['주장', '순서', '삽입', '무관한 문장'],
  'ENGLISH:종합·추론 능력': ['빈칸', '요약', '어휘 의미'],
  'ENGLISH:정보 확인 능력': ['안내문 일치', '안내문 불일치', '내용 불일치', '도표'],
}

/** 교육과정 고정 목록 + 은행 트리 병합 — 은행에 문제가 없는 단원도 항상 노출 */
function fixedNodes(subject: ApiSubject, parent: string, treeNodes: FilterNode[]): FilterNode[] {
  const names = NODE_ORDER[`${subject}:${parent}`]
  if (!names) return treeNodes
  return names.map(
    (name) => treeNodes.find((n) => n.name === name) ?? { name, count: 0, children: [] },
  )
}

interface CasSel {
  big: string | null
  mid: string | null
  small: string | null
}

const EMPTY_CAS: CasSel = { big: null, mid: null, small: null }

interface SetSel {
  groupCode: string
  setNo: number
}

interface UploadProgress {
  done: number
  total: number
  mapped: number
  failed: string[]
}

export default function TrialTestPage() {
  const { subject = '' } = useParams()
  const label = SUBJECT_LABEL[subject]
  const apiSubject = API_SUBJECT[subject]
  const toast = useToast()
  const isMath = subject === 'math'

  const [groups, setGroups] = useState<TrialTestGroup[]>([])
  const [tree, setTree] = useState<FilterNode[]>([])
  const [cas, setCas] = useState<CasSel>(EMPTY_CAS)
  const [sel, setSel] = useState<SetSel | null>(null)
  const [items, setItems] = useState<TrialTestItem[]>([])
  const [over, setOver] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 미리보기 모달 (문제 목록과 동일 UX — 디바이스 프레임 + 정답·해설)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProblemDetail | null>(null)
  const [device, setDevice] = useState<'web' | 'pad' | 'mobile'>('web')
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

  const ProblemRender = detail?.subject === 'ENGLISH' ? EnglishProblemRender : MathProblemRender
  const ExplainRender = detail?.subject === 'ENGLISH' ? EnglishExplainRender : MathExplainRender

  const loadGroups = useCallback(() => {
    if (!apiSubject) return
    fetchTrialTestGroups(apiSubject).then(setGroups).catch(() => setGroups([]))
  }, [apiSubject])

  // 과목 전환: 필터·선택·목록 초기화 후 재로드
  useEffect(() => {
    setCas(EMPTY_CAS)
    setSel(null)
    setItems([])
    setSelectedId(null)
    setDetail(null)
    loadGroups()
  }, [loadGroups])

  // 분류 트리 로드 — 문제 목록과 동일하게 문제 은행 전체 트리 사용 (세트 유무와 무관하게 항상 표시)
  useEffect(() => {
    if (!apiSubject) return
    fetchProblemFilters(apiSubject).then(setTree).catch(() => setTree([]))
  }, [apiSubject])

  // 세트 문항 로드
  useEffect(() => {
    if (!apiSubject || !sel) {
      setItems([])
      return
    }
    fetchTrialTestItems(apiSubject, sel.groupCode, sel.setNo).then(setItems).catch(() => setItems([]))
  }, [apiSubject, sel])

  // 미리보기 상세 로드
  useEffect(() => {
    if (selectedId == null) {
      setDetail(null)
      return
    }
    setDevice('web')
    fetchProblemDetail(selectedId).then(setDetail).catch(() => setDetail(null))
  }, [selectedId])

  // 미리보기 모달: ESC 닫기 + 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (selectedId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [selectedId])

  // 분류 캐스케이드 노드 — 대분류·중분류(영어: 영역·유형)는 교육과정 고정 목록으로 항상 전부 노출,
  // 소분류(수학)만 은행 트리에서 파생
  const bigNodes = useMemo(
    () => (apiSubject ? fixedNodes(apiSubject, '', tree) : []),
    [apiSubject, tree],
  )
  const midNodes = useMemo(() => {
    if (!apiSubject || !cas.big) return []
    const treeBig = tree.find((n) => n.name === cas.big)
    return fixedNodes(apiSubject, cas.big, treeBig?.children ?? [])
  }, [apiSubject, tree, cas.big])
  const smallNodes = useMemo(() => {
    if (!isMath || !cas.big || !cas.mid) return []
    const treeMid = tree
      .find((n) => n.name === cas.big)
      ?.children.find((n) => n.name === cas.mid)
    return treeMid?.children ?? []
  }, [isMath, tree, cas.big, cas.mid])
  const filteredGroups = useMemo(
    () =>
      groups.filter(
        (g) =>
          (!cas.big || g.unitLarge === cas.big) &&
          (!cas.mid || (isMath ? g.unitMid : g.skillNode) === cas.mid) &&
          (!cas.small || g.skillNode === cas.small),
      ),
    [groups, isMath, cas],
  )

  if (!label) return <Navigate to="/admin/trial-tests/math" replace />

  /** 여러 세트 파일을 순차 업로드 — 파일명 순 정렬로 세트 번호가 순서대로 들어간다 */
  const uploadFiles = async (files: File[]) => {
    const valid = files
      .filter((f) => FILENAME_PATTERN.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
    const skipped = files.length - valid.length
    if (valid.length === 0) {
      toast('맛보기 파일명 형식(*_trial-test_NN.jsonl)이 아니에요')
      return
    }
    const failed: string[] = []
    let mapped = 0
    setProgress({ done: 0, total: valid.length, mapped: 0, failed })
    for (const f of valid) {
      try {
        const r = await importTrialTestFile(f)
        mapped += r.mappedCount
      } catch (e) {
        const serverMsg = axios.isAxiosError(e) ? e.response?.data?.message : null
        failed.push(`${f.name}: ${serverMsg ?? '업로드 실패'}`)
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1, mapped, failed } : p))
    }
    toast(
      `세트 업로드 완료 · ${valid.length - failed.length}파일 · ${mapped.toLocaleString()}문항` +
        (failed.length > 0 ? ` · 실패 ${failed.length}` : '') +
        (skipped > 0 ? ` · 형식 불일치 ${skipped}건 제외` : ''),
    )
    loadGroups()
    if (fileRef.current) fileRef.current.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (progress && progress.done < progress.total) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) uploadFiles(files)
  }

  // 분류 선택: 세트·미리보기 선택 초기화
  const selectCas = (next: CasSel) => {
    setCas(next)
    setSel(null)
    setSelectedId(null)
  }

  const uploading = progress != null && progress.done < progress.total
  const totalSets = groups.reduce((n, g) => n + g.sets.length, 0)
  const totalCount = groups.reduce((n, g) => n + g.totalCount, 0)
  const selectedGroup = sel ? (groups.find((g) => g.groupCode === sel.groupCode) ?? null) : null
  const selectedSet = selectedGroup?.sets.find((s) => s.setNo === sel?.setNo) ?? null

  const groupTitle = (g: TrialTestGroup) => g.skillNode ?? g.groupCode

  const previewPath = detail
    ? [detail.unitLarge, detail.unitMid, detail.skillNode].filter(Boolean).join(' › ')
    : ''

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>{label} 맛보기 테스트</h2>
          <p className="page-sub">
            {totalSets > 0
              ? `${groups.length}개 ${isMath ? '소단원' : '유형'} · ${totalSets}개 세트 · ${totalCount.toLocaleString()}문항`
              : '아직 등록된 세트가 없어요 · 세트 파일을 업로드해주세요'}
          </p>
        </div>
      </div>

      {/* 분류 캐스케이드 — 수학: 대분류›중분류›소분류(3단) · 영어: 영역›유형(2단), 문제 목록과 동일 */}
      <div className="cascader" style={isMath ? undefined : { gridTemplateColumns: '1fr 1fr' }}>
        <div className="card cas-col">
          <div className="cas-head">{isMath ? '대분류' : '영역'}</div>
          <ul className="cas-list">
            <li className={clsx(cas.big === null && 'on')} onClick={() => selectCas(EMPTY_CAS)}>
              전체
            </li>
            {bigNodes.map((n) => (
              <li
                key={n.name}
                className={clsx(cas.big === n.name && 'on')}
                onClick={() => selectCas({ big: cas.big === n.name ? null : n.name, mid: null, small: null })}
              >
                {n.name}
              </li>
            ))}
          </ul>
        </div>
        <div className="card cas-col">
          <div className="cas-head">{isMath ? '중분류' : '유형'}</div>
          <ul className="cas-list">
            {cas.big ? (
              midNodes.map((n) => (
                <li
                  key={n.name}
                  className={clsx(cas.mid === n.name && 'on')}
                  onClick={() => selectCas({ ...cas, mid: cas.mid === n.name ? null : n.name, small: null })}
                >
                  {n.name}
                </li>
              ))
            ) : (
              <li className="cas-empty">{isMath ? '대분류를 선택하세요' : '영역을 선택하세요'}</li>
            )}
          </ul>
        </div>
        {isMath && (
          <div className="card cas-col">
            <div className="cas-head">소분류</div>
            <ul className="cas-list">
              {cas.big && cas.mid ? (
                smallNodes.map((n) => (
                  <li
                    key={n.name}
                    className={clsx(cas.small === n.name && 'on')}
                    onClick={() => selectCas({ ...cas, small: cas.small === n.name ? null : n.name })}
                  >
                    {n.name}
                  </li>
                ))
              ) : (
                <li className="cas-empty">중분류를 선택하세요</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* 세트 파일 업로드 — 여러 파일 한 번에 (파일명으로 그룹·세트 자동 인식) */}
      <div className="card">
        <div
          className={clsx('dropzone', over && 'over')}
          onClick={() => !uploading && fileRef.current?.click()}
          onDragEnter={(e) => { e.preventDefault(); setOver(true) }}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); setOver(false) }}
          onDrop={onDrop}
        >
          <div className="dz-ico"><IcoUpload /></div>
          <b>
            {uploading && progress
              ? `업로드 중… ${progress.done} / ${progress.total} 파일`
              : '맛보기 세트 파일을 끌어다 놓거나 클릭해서 선택하세요 (여러 개 가능)'}
          </b>
          <p>
            파일명으로 {isMath ? '단원' : '유형'}·세트 번호가 자동 인식돼요 · 예:{' '}
            {isMath ? '2022_1_1_1_trial-test_01.jsonl' : 'corrected_r12_blank_trial-test_01.jsonl'}
          </p>
          <div className="formats">
            <span className="chip">JSONL</span>
            <span className="chip">JSON</span>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.jsonl"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) uploadFiles(files)
          }}
        />
        {progress && progress.failed.length > 0 && (
          <p className="page-sub" style={{ marginTop: 12 }}>
            {progress.failed.slice(0, 5).join(' · ')}
            {progress.failed.length > 5 && ' …'}
          </p>
        )}
      </div>

      {/* 그룹 × 세트 목록 */}
      {groups.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                {isMath ? (
                  <tr>
                    <th style={{ width: 140 }}>대단원</th>
                    <th style={{ width: 200 }}>중단원</th>
                    <th>소단원</th>
                    <th style={{ width: 90 }}>문항 수</th>
                    <th style={{ width: 300 }}>세트</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ width: 180 }}>영역</th>
                    <th>유형</th>
                    <th style={{ width: 90 }}>문항 수</th>
                    <th style={{ width: 300 }}>세트</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredGroups.map((g) => {
                  const inactiveTotal = g.sets.reduce((n, s) => n + s.inactiveCount, 0)
                  return (
                    <tr key={g.groupCode}>
                      <td className="strong">{g.unitLarge}</td>
                      {isMath && <td>{g.unitMid}</td>}
                      <td>
                        {groupTitle(g)}
                        <span className="sub">
                          {g.groupCode}
                          {inactiveTotal > 0 && ` · 비공개 ${inactiveTotal}문항 포함`}
                        </span>
                      </td>
                      <td className="num">{g.totalCount}문항</td>
                      <td>
                        <div className="seg">
                          {g.sets.map((s) => {
                            const on = sel?.groupCode === g.groupCode && sel.setNo === s.setNo
                            return (
                              <button
                                key={s.setNo}
                                className={clsx(on && 'on')}
                                onClick={() =>
                                  setSel(on ? null : { groupCode: g.groupCode, setNo: s.setNo })
                                }
                              >
                                세트 {s.setNo} <span className="num">· {s.count}</span>
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredGroups.length === 0 && (
                  <tr>
                    <td
                      colSpan={isMath ? 5 : 4}
                      style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 32 }}
                    >
                      조건에 맞는 세트가 없어요
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 선택한 세트 문항 */}
      {sel && selectedGroup && (
        <div className="card">
          <div className="viewer-head">
            <div>
              <div className="card-title">
                {groupTitle(selectedGroup)} · 세트 {sel.setNo}
              </div>
              <div className="card-sub">
                {[selectedGroup.unitLarge, selectedGroup.unitMid].filter(Boolean).join(' › ')}
                {selectedSet && selectedSet.inactiveCount > 0 && (
                  <> · 비공개 {selectedSet.inactiveCount}문항 포함</>
                )}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>닫기</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>순서</th>
                  <th style={{ width: 210 }}>ID</th>
                  <th>{isMath ? '소단원' : '유형'}</th>
                  <th style={{ width: 70 }}>점수</th>
                  <th style={{ width: 120 }}>상태</th>
                  <th style={{ width: 120 }}>등록일</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.problem.id}
                    className={clsx(selectedId === it.problem.id && 'selected')}
                    onClick={() => setSelectedId((prev) => (prev === it.problem.id ? null : it.problem.id))}
                  >
                    <td className="num">{it.sequence}</td>
                    <td className="num" style={{ color: 'var(--color-muted)' }}>{it.problem.id}</td>
                    <td className="strong">{it.problem.skillNode}</td>
                    <td className="num">{it.problem.points}점</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[it.problem.status]}`}>
                        {STATUS_LABEL[it.problem.status]}
                      </span>
                    </td>
                    <td className="num">{formatDate(it.problem.createdAt)}</td>
                    <td><button className="btn btn-ghost btn-sm">상세</button></td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 32 }}>
                      세트 문항을 불러오는 중이에요
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 문제 미리보기 모달 — 문제 목록과 동일 (포털 + 디바이스 프레임 + 정답·해설) */}
      {selectedId != null &&
        createPortal(
          <div className="pv-modal-overlay" onClick={() => setSelectedId(null)}>
            <div className={clsx('pv-modal-wrap', device)} onClick={(e) => e.stopPropagation()}>
              <div className="seg pv-device-seg">
                {([['web', '웹'], ['pad', '패드'], ['mobile', '모바일']] as const).map(([key, tabLabel]) => (
                  <button key={key} className={clsx(device === key && 'on')} onClick={() => setDevice(key)}>
                    {tabLabel}
                  </button>
                ))}
              </div>
              <div className="pv-modal">
                <div className="pv-modal-head">
                  <div>
                    <div className="card-title">문제 미리보기</div>
                    <div className="card-sub">
                      {detail ? `${detail.id} · ${previewPath}` : '불러오는 중…'}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
                    닫기
                  </button>
                </div>
                {detail && (
                  <div className={clsx('pv-modal-body', device)}>
                    <div
                      className={clsx('pv-device', device)}
                      style={device === 'pad' ? { width: padWidth } : undefined}
                    >
                      <div className="pv-device-inner">
                        <div className={clsx('pv-body', detail.subject === 'ENGLISH' && 'en')}>
                          {/* 수능 지면 순서: 발문 [N점] → 지문 → 단어 주석 → 선택지 */}
                          <div className="pv-question">
                            <ProblemRender text={detail.question} /> [{detail.points}점]
                          </div>
                          {detail.passage && (
                            <div className="pv-passage">
                              <ProblemRender text={detail.passage} />
                            </div>
                          )}
                          {Object.keys(detail.glossary).length > 0 && (
                            <div className="pv-glossary">
                              {Object.entries(detail.glossary)
                                .map(([word, meaning], i) => `${'*'.repeat(i + 1)} ${word}: ${meaning}`)
                                .join('   ')}
                            </div>
                          )}
                          {detail.choices.length > 0 && (
                            <div className="pv-choices">
                              {detail.choices.map((c, i) => {
                                const correct = detail.answerNumber === i + 1
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
                    {device === 'pad' && <div className="pv-divider" onMouseDown={startPadDrag} />}
                    <div className={clsx('pv-modal-explain', device === 'mobile' && 'fixed-375')}>
                      <p className="pv-label">정답</p>
                      <div className="pv-explain-body pv-explain-answer">
                        {detail.choices.length > 0 ? (
                          String.fromCodePoint(0x245f + detail.answerNumber)
                        ) : (
                          <ExplainRender text={detail.answerText} />
                        )}
                      </div>
                      <p className="pv-label" style={{ marginTop: 20 }}>해설</p>
                      <div className="pv-explain-body">
                        <ExplainRender text={detail.explanation} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.querySelector('.admin-root') ?? document.body,
        )}
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  EnglishExplainRender,
  EnglishProblemRender,
  MathExplainRender,
  MathProblemRender,
} from '@/shared/components/ExamRender'
import { IcoSearch } from '../components/icons'
import {
  fetchProblemDetail,
  fetchProblemFilters,
  fetchProblems,
  type ApiSubject,
  type Difficulty,
  type FilterNode,
  type ProblemDetail,
  type ProblemPage,
  type ProblemStatus,
} from '../api/adminApi'

const SUBJECT_LABEL: Record<string, string> = { math: '수학', english: '영어' }
const API_SUBJECT: Record<string, ApiSubject> = { math: 'MATH', english: 'ENGLISH' }

const STATUS_LABEL: Record<ProblemStatus, string> = { ACTIVE: '게시 중', INACTIVE: '비공개' }
const STATUS_BADGE: Record<ProblemStatus, string> = { ACTIVE: 'live', INACTIVE: 'hidden' }

const PAGE_SIZE = 30

/** 트리 정렬 — 교육과정/정책 확정 순서 (API 는 가나다순이라 화면에서 재정렬) */
const NODE_ORDER: Record<string, string[]> = {
  'MATH:': ['대수', '미적분Ⅰ', '확률과 통계'],
  'MATH:대수': ['지수함수와 로그함수', '삼각함수', '수열'],
  'MATH:미적분Ⅰ': ['함수의 극한과 연속', '미분', '적분'],
  'MATH:확률과 통계': ['경우의 수', '확률', '통계'],
  'ENGLISH:': ['중심 내용 파악', '논리 구조 이해', '종합·추론 능력', '정보 확인 능력', '기초 언어 능력'],
  'ENGLISH:중심 내용 파악': ['주제', '제목', '요지', '목적'],
  'ENGLISH:논리 구조 이해': ['주장', '순서', '삽입', '무관한 문장'],
  'ENGLISH:종합·추론 능력': ['요약', '빈칸', '어휘 의미'],
  'ENGLISH:정보 확인 능력': ['안내문 일치', '안내문 불일치', '내용 불일치', '도표'],
  'ENGLISH:기초 언어 능력': ['어휘 쓰임'],
}

function sortNodes(subject: ApiSubject, parent: string, nodes: FilterNode[]): FilterNode[] {
  const order = NODE_ORDER[`${subject}:${parent}`]
  if (!order) return nodes
  return [...nodes].sort((a, b) => {
    const ai = order.indexOf(a.name)
    const bi = order.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

const formatDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.')

/** 영어 유형 영문 표기 (13유형 분류표 기준) — 목록에서 한글명 아래 보조 표시 */
const EN_TYPE_LABEL: Record<string, string> = {
  주제: 'Topic',
  제목: 'Title',
  요지: 'Gist',
  주장: 'Claim',
  순서: 'Order',
  삽입: 'Insertion',
  요약: 'Summary',
  빈칸: 'Blank',
  '안내문 일치': 'Notice Match',
  '안내문 불일치': 'Notice Mismatch',
  '내용 불일치': 'Content Mismatch',
  목적: 'Purpose',
  '어휘 의미': 'Vocabulary (Meaning)',
  '어휘 쓰임': 'Vocabulary (Usage)',
  도표: 'Chart',
  '무관한 문장': 'Irrelevant Sentence',
}

interface CasSel {
  big: string | null
  mid: string | null
  small: string | null
}

const EMPTY_CAS: CasSel = { big: null, mid: null, small: null }

export default function ProblemListPage() {
  const { subject = '' } = useParams()
  const label = SUBJECT_LABEL[subject]
  const apiSubject = API_SUBJECT[subject]

  const [tree, setTree] = useState<FilterNode[]>([])
  const [cas, setCas] = useState<CasSel>(EMPTY_CAS)
  const [status, setStatus] = useState<'' | ProblemStatus>('')
  const [difficulty, setDifficulty] = useState<'' | Difficulty>('')
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<ProblemPage | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProblemDetail | null>(null)
  // 미리보기 디바이스 프레임 — 문제 영역 폭: min 350px · max 500px (실서비스 규칙)
  const [device, setDevice] = useState<'web' | 'pad' | 'mobile'>('web')
  // 패드: 맛보기와 동일하게 가운데 디바이더 드래그로 문제 패널 폭 조절
  const [padWidth, setPadWidth] = useState(524)

  const startPadDrag = (e: React.MouseEvent) => {
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

  const isMath = subject === 'math'
  // 본문 렌더러 — 과목·용도별 4종 중 선택 (공용 ExamRender 만 사용)
  const ProblemRender = detail?.subject === 'ENGLISH' ? EnglishProblemRender : MathProblemRender
  const ExplainRender = detail?.subject === 'ENGLISH' ? EnglishExplainRender : MathExplainRender

  // 과목 전환: 필터·선택 전부 초기화
  useEffect(() => {
    setCas(EMPTY_CAS)
    setStatus('')
    setDifficulty('')
    setQInput('')
    setQ('')
    setPage(0)
    setSelectedId(null)
    setDetail(null)
  }, [subject])

  // 분류 트리 로드
  useEffect(() => {
    if (!apiSubject) return
    fetchProblemFilters(apiSubject).then(setTree).catch(() => setTree([]))
  }, [apiSubject])

  // 검색 디바운스 (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput)
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [qInput])

  // 목록 로드
  useEffect(() => {
    if (!apiSubject) return
    fetchProblems({
      subject: apiSubject,
      unitLarge: cas.big ?? undefined,
      unitMid: isMath ? (cas.mid ?? undefined) : undefined,
      skillNode: (isMath ? cas.small : cas.mid) ?? undefined,
      status: status || undefined,
      difficulty: difficulty || undefined,
      q: q || undefined,
      page,
      size: PAGE_SIZE,
    })
      .then(setData)
      .catch(() => setData(null))
  }, [apiSubject, isMath, cas, status, difficulty, q, page])

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

  const bigNodes = useMemo(() => (apiSubject ? sortNodes(apiSubject, '', tree) : []), [apiSubject, tree])
  const selectedBig = useMemo(() => tree.find((n) => n.name === cas.big) ?? null, [tree, cas.big])
  const midNodes = useMemo(
    () => (apiSubject && selectedBig ? sortNodes(apiSubject, selectedBig.name, selectedBig.children) : []),
    [apiSubject, selectedBig],
  )
  const selectedMid = useMemo(
    () => (isMath ? (selectedBig?.children.find((n) => n.name === cas.mid) ?? null) : null),
    [isMath, selectedBig, cas.mid],
  )
  const smallNodes = useMemo(
    () => (apiSubject && selectedMid ? sortNodes(apiSubject, selectedMid.name, selectedMid.children) : []),
    [apiSubject, selectedMid],
  )

  if (!label) return <Navigate to="/admin/problems/math" replace />

  const rows = data?.content ?? []
  const total = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 0

  const selectCas = (next: CasSel) => {
    setCas(next)
    setPage(0)
    setSelectedId(null)
  }
  const toggleRow = (id: string) => setSelectedId((prev) => (prev === id ? null : id))

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)

  // 페이지 버튼 윈도우 (최대 5개)
  const pageButtons: number[] = []
  const windowStart = Math.max(0, Math.min(page - 2, totalPages - 5))
  for (let i = windowStart; i < Math.min(windowStart + 5, totalPages); i++) pageButtons.push(i)

  const previewPath = detail
    ? [detail.unitLarge, detail.unitMid, detail.skillNode].filter(Boolean).join(' › ')
    : ''

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>{label} 문제 목록</h2>
          <p className="page-sub">전체 {total.toLocaleString()}문제</p>
        </div>
      </div>

      {/* 분류 캐스케이드 — 수학: 대분류›중분류›소분류(3단) · 영어: 영역›유형(2단) */}
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

      <div>
        <div className="card">
          <div className="toolbar">
            <div className="search-box">
              <IcoSearch />
              <input
                type="text"
                placeholder="문제 ID, 발문으로 검색"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
            </div>
            <select
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as '' | ProblemStatus)
                setPage(0)
              }}
            >
              <option value="">전체 상태</option>
              <option value="ACTIVE">게시 중</option>
              <option value="INACTIVE">비공개</option>
            </select>
            {isMath && (
              <select
                className="select"
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value as '' | Difficulty)
                  setPage(0)
                }}
              >
                <option value="">전체 난이도</option>
                <option value="BASIC">쉬움 (2점)</option>
                <option value="NORMAL">보통 (3점)</option>
                <option value="ADVANCED">어려움 (4점)</option>
              </select>
            )}
            <div className="spacer" />
            <div className="toolbar-pg">
              <span className="info num">
                {rangeStart}–{rangeEnd} / {total.toLocaleString()}건
              </span>
              <div className="pages">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
                {pageButtons.map((p) => (
                  <button key={p} className={clsx('num', p === page && 'on')} onClick={() => setPage(p)}>
                    {p + 1}
                  </button>
                ))}
                <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                {isMath ? (
                  <tr>
                    <th style={{ width: 150 }}>ID</th>
                    <th style={{ width: 150 }}>대단원</th>
                    <th style={{ width: 210 }} className="col-mid">중단원</th>
                    <th style={{ width: 210 }}>소단원</th>
                    <th style={{ width: 70 }}>점수</th>
                    <th style={{ width: 120 }}>상태</th>
                    <th style={{ width: 120 }} className="col-date">등록일</th>
                    <th style={{ width: 80 }} />
                  </tr>
                ) : (
                  <tr>
                    <th style={{ width: 210 }}>ID</th>
                    <th style={{ width: 180 }}>영역</th>
                    <th style={{ width: 160 }}>유형</th>
                    <th style={{ width: 70 }}>점수</th>
                    <th style={{ width: 120 }}>상태</th>
                    <th style={{ width: 120 }} className="col-date">등록일</th>
                    <th style={{ width: 80 }} />
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    className={clsx(selectedId === p.id && 'selected')}
                    onClick={() => toggleRow(p.id)}
                  >
                    <td className="num" style={{ color: 'var(--color-muted)' }}>{p.id}</td>
                    <td className="strong">{p.unitLarge}</td>
                    {isMath && <td className="col-mid">{p.unitMid}</td>}
                    <td>
                      {p.skillNode}
                      {!isMath && EN_TYPE_LABEL[p.skillNode] && (
                        <span className="sub">{EN_TYPE_LABEL[p.skillNode]}</span>
                      )}
                    </td>
                    <td className="num">{p.points}점</td>
                    <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                    <td className="num col-date">{formatDate(p.createdAt)}</td>
                    <td><button className="btn btn-ghost btn-sm">상세</button></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--color-muted)', textAlign: 'center', padding: 32 }}>
                      조건에 맞는 문제가 없어요
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 문제 미리보기 모달 — 문제 영역 500px 고정(실서비스 렌더 폭 검증) + 우측 해설.
          .view 진입 애니메이션의 transform 이 fixed 기준점을 바꾸므로 포털로 밖에 렌더 (항상 화면 정중앙).
          어드민 CSS 변수가 .admin-root 스코프라 포털 대상도 .admin-root */}
      {selectedId != null &&
        createPortal(
        <div className="pv-modal-overlay" onClick={() => setSelectedId(null)}>
          <div className={clsx('pv-modal-wrap', device)} onClick={(e) => e.stopPropagation()}>
            {/* 디바이스 토글 — 팝업 카드 바깥 상단 */}
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
              <div className="pv-modal-body">
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
                {/* 패드: 맛보기와 동일한 드래그 디바이더 (좌우 폭 조절) */}
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

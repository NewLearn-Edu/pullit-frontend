import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import clsx from 'clsx'
import {
  EnglishExplainRender,
  EnglishProblemRender,
  MathExplainRender,
  MathProblemRender,
} from '@/shared/components/ExamRender'
import { ProblemExplain } from '@/shared/components/ProblemExplain'
import { useToast } from '../components/toast'
import {
  clearReviewQueue,
  readReviewQueue,
  removeFromReviewQueue,
  type ReviewEntry,
} from '../data/reviewQueue'

/** 배점 미리보기 — 임포터와 동일 규칙 (업로드 화면과 같은 표) */
const POINTS_BY_DIFFICULTY: Record<string, number> = { basic: 2, normal: 3, advanced: 4 }

/**
 * 문제 검수 (/admin/review)
 *
 * 업로드 화면에서 체크해 담아 둔 문항을 업로드 화면과 같은 조판으로 한 문항씩 본다.
 * 이전/다음으로 넘기며 렌더가 깨진 곳을 훑고, [검수 완료] 로 목록에서 뺀다.
 */
export default function ProblemReviewPage() {
  const toast = useToast()
  const [entries, setEntries] = useState<ReviewEntry[]>(() => readReviewQueue())
  const [idx, setIdx] = useState(0)

  // 검토 디바이스 프레임 — 업로드 화면과 동일 (웹/패드-드래그/모바일 375)
  const [device, setDevice] = useState<'web' | 'pad' | 'mobile'>('web')
  const [padWidth, setPadWidth] = useState(524)
  const startPadDrag = (e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = padWidth
    const onMove = (ev: MouseEvent) => {
      setPadWidth(Math.min(524, Math.max(374, startWidth + ev.clientX - startX)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // 목록이 줄어들면 마지막 문항으로 당긴다 (검수 완료로 뒤쪽이 사라지는 경우)
  useEffect(() => {
    if (idx > 0 && idx >= entries.length) setIdx(Math.max(0, entries.length - 1))
  }, [entries.length, idx])

  // ← → 로도 넘길 수 있게 (문항을 빠르게 훑는 검수 작업)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(entries.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entries.length])

  const entry = entries[idx]

  const completeCurrent = () => {
    if (!entry) return
    removeFromReviewQueue(entry.key)
    setEntries(readReviewQueue())
    toast('검수 완료 · 목록에서 뺐어요')
  }

  const clearAll = () => {
    if (!window.confirm('검수 목록을 모두 비울까요? 문제 데이터는 그대로예요.')) return
    clearReviewQueue()
    setEntries([])
    setIdx(0)
    toast('검수 목록을 비웠어요')
  }

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>
            문제 검수
          </h2>
          <p className="page-sub">
            업로드 화면에서 체크해 담은 문항이에요 · 이전/다음(← →)으로 넘기며 확인하세요
          </p>
        </div>
        {entries.length > 0 && (
          <button className="btn btn-ghost" onClick={clearAll}>
            전체 비우기
          </button>
        )}
      </div>

      {!entry ? (
        <div className="card rv-empty">
          <b>담아 둔 검수 문항이 없어요</b>
          <p>문제 업로드 화면에서 문항 왼쪽 체크박스를 켜고 업로드하면 여기에 모여요</p>
        </div>
      ) : (
        <div>
          <div className="card upl-summary">
            <span className="file-ico csv">{'{ }'}</span>
            <div className="t">
              <b>{entry.fileName}</b>
              <span>{entry.filePath}</span>
            </div>
            <span className="badge neutral">{entries.length.toLocaleString()}문항 대기</span>
            <button className="btn btn-primary" onClick={completeCurrent}>
              검수 완료
            </button>
          </div>

          <div className="card">
            <div className="viewer-head">
              <div className="viewer-head-left">
                <div className="card-title">
                  검수 {idx + 1} / {entries.length} · {entry.problemId}
                </div>
              </div>
              <div className="viewer-nav">
                <div className="seg pv-device-seg">
                  {([['web', '웹'], ['pad', '패드'], ['mobile', '모바일']] as const).map(
                    ([key, tabLabel]) => (
                      <button
                        key={key}
                        className={clsx(device === key && 'on')}
                        onClick={() => setDevice(key)}
                      >
                        {tabLabel}
                      </button>
                    ),
                  )}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={idx === 0}
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                >
                  ‹ 이전
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={idx >= entries.length - 1}
                  onClick={() => setIdx((i) => Math.min(entries.length - 1, i + 1))}
                >
                  다음 ›
                </button>
              </div>
            </div>
          </div>

          <ReviewPreview entry={entry} device={device} padWidth={padWidth} onPadDrag={startPadDrag} />
        </div>
      )}
    </section>
  )
}

/** 문제(좌) · 정답/해설(우) — 업로드 미리보기와 동일 조판 */
function ReviewPreview({
  entry,
  device,
  padWidth,
  onPadDrag,
}: {
  entry: ReviewEntry
  device: 'web' | 'pad' | 'mobile'
  padWidth: number
  onPadDrag: (e: ReactMouseEvent) => void
}) {
  const { problem, subject } = entry
  const ProblemRender = subject === 'english' ? EnglishProblemRender : MathProblemRender
  const ExplainRender = subject === 'english' ? EnglishExplainRender : MathExplainRender
  const points = subject === 'english' ? 2 : POINTS_BY_DIFFICULTY[problem.difficulty ?? '']

  return (
    <div className={clsx('upl-preview', device)}>
      <div
        className={clsx('pv-device', device)}
        style={device === 'pad' ? { width: padWidth } : undefined}
      >
        <div className="pv-device-inner">
          <div className={clsx('pv-body', subject === 'english' && 'en')}>
            <div className="pv-question">
              <ProblemRender text={problem.question ?? ''} />
              {points ? <> [{points}점]</> : null}
            </div>
            {problem.passage && (
              <div className="pv-passage">
                <ProblemRender text={problem.passage} />
              </div>
            )}
            {(problem.choices?.length ?? 0) > 0 && (
              <div className="pv-choices">
                {(problem.choices ?? []).map((c, i) => {
                  const correct = problem.answer_no === i + 1
                  return (
                    <span key={i} className={clsx('choice', correct && 'correct')}>
                      {/* ①~⑤(U+2460) · 정답은 채운 원문자 ❶~❺(U+2776) */}
                      <span className="choice-num">
                        {String.fromCodePoint((correct ? 0x2775 : 0x245f) + i + 1)}
                      </span>
                      <span>
                        <ProblemRender text={c} />
                      </span>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 패드: 가운데 디바이더 드래그로 좌우 폭 조절 */}
      {device === 'pad' && <div className="pv-divider" onMouseDown={onPadDrag} />}

      <div className={clsx('pv-modal-explain', device === 'mobile' && 'fixed-375')}>
        <p className="pv-label">정답</p>
        <div className="pv-explain-body pv-explain-answer">
          {(problem.choices?.length ?? 0) > 0 && problem.answer_no != null ? (
            String.fromCodePoint(0x245f + problem.answer_no)
          ) : (
            <ExplainRender text={String(problem.answer_text ?? problem.answer_no ?? '-')} />
          )}
        </div>
        <p className="pv-label" style={{ marginTop: 20 }}>
          해설
        </p>
        <div className="pv-explain-body">
          <ProblemExplain explanation={problem.explanation} subject={subject} />
        </div>
      </div>
    </div>
  )
}

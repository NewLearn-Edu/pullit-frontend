import { clsx } from 'clsx'
import { useEffect, useRef, useState, type Ref } from 'react'
import type { Problem } from '@/user/data/mockProblems'
import { MathExplainRender } from '@/shared/components/ExamRender'
import {
  ProblemExplain,
  ProblemTranslation,
  ProblemVocabulary,
  parseExplainBlocks,
  parseTranslationParagraphs,
} from '@/shared/components/ProblemExplain'
import { ExamScaleFrame } from '@/shared/components/ExamScaleFrame'
import { PinchZoomScroller } from '@/user/components/quiz/PinchZoomScroller'
import type { DrawingCanvasHandle, EraserMode, StrokeTool } from '@/user/components/quiz/DrawingCanvas'
import { ProblemNoteCanvas } from '@/user/components/quiz/ProblemNoteCanvas'
import styles from './styles/ExplainPanel.module.scss'

/** 해설 위 필기 옵션 — 페이지의 공용 툴바 상태를 그대로 받는다 (리뷰 화면용) */
export interface ExplainDrawing {
  tool: StrokeTool
  color: string
  size: number
  eraserMode?: EraserMode
  disabled?: boolean
  allowFinger?: boolean
  canvasRef?: Ref<DrawingCanvasHandle>
  /** 이 캔버스에 포인터가 닿을 때 — 페이지가 undo/clear 라우팅 대상을 추적한다 */
  onActivate?: () => void
}

interface ExplainPanelProps {
  open: boolean
  onClose: () => void
  problem: Problem
  /** 서버 정답 번호(주관식은 값) — 서버 세트 문항은 로컬 answer 가 0 이라 이걸 우선 사용 */
  answerNo?: number | null
  /** 서버가 내려준 해설 — 있으면 목 데이터 대신 이걸 어드민과 같은 조판으로 렌더 */
  serverExplanation?: string | null
  /** 서버가 내려준 지문 해석(영어) — 있으면 "해석 / 풀이" 두 탭, 없으면 해설 단일 뷰 */
  serverTranslation?: string | null
  /** 서버가 내려준 어휘(영어) — 풀이 탭 해설 아래 "어휘" 목록 */
  serverVocabulary?: { term: string; meaning: string }[] | null
  revealed: boolean
  /** md+ 에서 사용자가 divider 로 조절한 폭 (px) */
  width: number
  /** divider 드래그 중 · true 면 width transition off (매끄러운 드래그) */
  resizing: boolean
  /** 있으면 해설 본문 위에 필기 캔버스를 얹는다 */
  drawing?: ExplainDrawing
}

type ExplainTab = 'translation' | 'explain'

/**
 * 우측 사이드 패널 — 해설 뷰.
 * 영어처럼 지문 해석이 있으면 헤더에 "해석 / 풀이" 탭 (2026-09-03) — 해석 탭은 지문 번역 문단,
 * 풀이 탭은 "정답" · "해설" 섹션. 해석이 없으면(수학) 탭 없이 해설 단일 뷰.
 * 필기 캔버스는 탭마다 따로 저장한다 (target: translation / explanation).
 * - 데스크탑 · 태블릿 (md+): inline 사이드바 · 문제 카드를 밀어내며 나타남 (width transition)
 * - 모바일 (< md): 전체 화면 슬라이드 인 · overlay backdrop
 * revealed=false 이면 블러 처리 (답 선택 안 한 상태에서 잠깐 노출된 케이스)
 */
export function ExplainPanel({
  open,
  onClose,
  problem,
  answerNo,
  serverExplanation,
  serverTranslation,
  serverVocabulary,
  revealed,
  width,
  resizing,
  drawing,
}: ExplainPanelProps) {
  // 해석 — 서버 응답 우선, 없으면 세트 문항에 실려 온 값. 문단으로 해석되지 않으면 탭을 만들지 않는다
  const translation = serverTranslation ?? problem.translation ?? null
  const vocabulary = serverVocabulary?.length ? serverVocabulary : problem.vocabulary?.length ? problem.vocabulary : null
  const hasTranslation = problem.subject === 'english' && parseTranslationParagraphs(translation) !== null
  const problemKey = problem.serverId ?? String(problem.id)
  // 탭 — 해석이 있으면 해석부터 (지문을 이해한 뒤 풀이). 문제가 바뀌면 다시 첫 탭으로
  const [tab, setTab] = useState<ExplainTab>(hasTranslation ? 'translation' : 'explain')
  useEffect(() => {
    setTab(hasTranslation ? 'translation' : 'explain')
  }, [problemKey, hasTranslation])
  const activeTab: ExplainTab = hasTranslation ? tab : 'explain'

  // 정답 표시 — 객관식은 원문자, 주관식은 값 그대로. 확인 불가(-)는 서버 응답 전
  const resolvedAnswer = answerNo ?? (problem.answer !== 0 ? problem.answer : null)
  const isShortAnswer = problem.choices.length === 0
  const answerDisplay =
    resolvedAnswer == null
      ? '-'
      : isShortAnswer
        ? String(resolvedAnswer)
        : ['①', '②', '③', '④', '⑤'][resolvedAnswer - 1] ?? '-'

  // 복원한 해설 필기의 세로 끝(px)만큼 drawWrap 을 늘린다 — 짧은 해설이라도 아래쪽 필기가 안 잘리게.
  // state 가 아니라 style 직접 — 획마다 패널이 다시 그려지면 MathJax 조판이 풀린다
  // (React 19 는 리렌더마다 dangerouslySetInnerHTML 을 재설정해 typeset 결과를 지운다)
  const drawWrapRef = useRef<HTMLDivElement>(null)
  const applyNoteHeight = (px: number) => {
    const el = drawWrapRef.current
    // + var(--pinch-slack): 두 손가락 확대의 세로 여유(.drawWrap 기본 min-height 와 같은 규칙)를 유지한 채 필기 끝까지
    if (el) el.style.minHeight = px > 0 ? `calc(max(100%, ${px}px) + var(--pinch-slack, 0px))` : ''
  }

  const cssVars = {
    // md+ 에서 사용될 width · 인라인으로 --pw 주입
    // 닫힘 애니메이션 중에도 inner 는 마지막 사용자 값 유지 → 텍스트 리플로우 방지
    '--pw': open ? `${width}px` : '0px',
  } as React.CSSProperties

  return (
    <>
      {/* 모바일용 backdrop */}
      {open && <div className={styles.backdrop} onClick={onClose} />}

      <aside
        className={clsx(
          styles.aside,
          open && styles.open,
          !resizing && styles.asideAnimated,
          !open && styles.asideClosedDesktop,
        )}
        style={cssVars}
      >
        <div className={styles.inner} style={{ '--pw': `${width}px` } as React.CSSProperties}>
          <div className={styles.header}>
            <div className={styles.tabs} role={hasTranslation ? 'tablist' : undefined}>
              {hasTranslation ? (
                (
                  [
                    ['translation', '해석'],
                    ['explain', '풀이'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === key}
                    onClick={() => setTab(key)}
                    className={clsx(styles.tabButton, activeTab === key && styles.tabButtonActive)}
                  >
                    {label}
                  </button>
                ))
              ) : (
                <span className={clsx(styles.tabButton, styles.tabButtonActive)}>해설</span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {/* body(스크롤) + drawWrap(카드) — 두 손가락 확대·이동. 해설·해석 탭 모두 drawWrap 안이라 같이 커진다.
              drawWrap: 필기 오버레이 기준 컨테이너 — 스크롤 내용과 같이 움직이고,
              해설이 짧아도 패널 높이만큼은 채워 아래 여백에도 쓸 수 있다 */}
          <PinchZoomScroller className={styles.body} cardClassName={styles.drawWrap} cardRef={drawWrapRef}>
            {/* 500px 기준 고정 조판 → 패널 폭 비례 확대 (줄바꿈 불변 · 문제 본문과 동일 정책) */}
            <ExamScaleFrame>
            <div className={clsx(!revealed && styles.bodyBlurred)}>
              {activeTab === 'translation' ? (
                <>
                  {/* 해석 탭 — 지문 번역 문단 (밑줄 <u> 는 지문과 같은 위치에 보존) */}
                  <p className={styles.answerLabel}>해석</p>
                  <div style={{ marginTop: 12 }} className={styles.sections}>
                    <ProblemTranslation translation={translation} />
                  </div>
                </>
              ) : (
              <>
              {/* 정답 — 어드민 pv-label 구성과 동일하게 타이틀 + 값 */}
              <p className={styles.answerLabel}>정답</p>
              <p className={styles.answerValue}>{answerDisplay}</p>

              {/* 해설 */}
              <p className={styles.answerLabel} style={{ marginTop: 28 }}>
                해설
              </p>
              <div style={{ marginTop: 12 }}>
                {serverExplanation ? (
                  /* 서버 해설 — 어드민 업로드·검수 화면과 동일 렌더러 */
                  <div className={styles.sections}>
                    <ProblemExplain explanation={serverExplanation} subject={problem.subject} />
                  </div>
                ) : parseExplainBlocks(problem.explanation.correctAnalysis) ? (
                  /* 맛보기(익명) 서버 문항 — 로컬 채점용으로 받은 해설이 블록 직렬화 문자열 */
                  <div className={styles.sections}>
                    <ProblemExplain
                      explanation={problem.explanation.correctAnalysis}
                      subject={problem.subject}
                    />
                  </div>
                ) : (
                  <div className={styles.sections}>
                    <Section
                      title="정답 분석"
                      body={problem.explanation.correctAnalysis}
                    />
                    {problem.explanation.wrongAnalysis && (
                      <Section
                        title="오답 분석"
                        body={problem.explanation.wrongAnalysis}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* 어휘 — 영어 지문 핵심 단어 (풀이 탭 하단) */}
              {vocabulary && (
                <>
                  <p className={styles.answerLabel} style={{ marginTop: 28 }}>
                    어휘
                  </p>
                  <div style={{ marginTop: 12 }} className={styles.sections}>
                    <ProblemVocabulary items={vocabulary} />
                  </div>
                </>
              )}
              </>
              )}
            </div>
            </ExamScaleFrame>

            {drawing && (
              <div
                className={styles.drawOverlay}
                onPointerDownCapture={drawing.onActivate}
              >
                {/* 탭별 필기 — 풀이 탭은 explanation.pnk, 해석 탭은 translation.pnk.
                    key 에 탭을 넣어 탭 전환 때 이전 탭 필기를 저장하고 새 탭 필기를 복원한다 */}
                <ProblemNoteCanvas
                  key={`${problemKey}:${activeTab}`}
                  ref={drawing.canvasRef}
                  problemCode={problem.serverId}
                  target={activeTab === 'translation' ? 'translation' : 'explanation'}
                  tool={drawing.tool}
                  color={drawing.color}
                  size={drawing.size}
                  eraserMode={drawing.eraserMode}
                  disabled={drawing.disabled}
                  allowFinger={drawing.allowFinger}
                  onContentHeight={applyNoteHeight}
                />
              </div>
            )}
          </PinchZoomScroller>
        </div>
      </aside>
    </>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className={styles.sectionTitle}>{title}</p>
      <div className={styles.sectionBody}>
        <MathExplainRender text={body} />
      </div>
    </div>
  )
}

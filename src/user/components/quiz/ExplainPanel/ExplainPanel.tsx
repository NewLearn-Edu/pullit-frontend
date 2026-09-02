import { clsx } from 'clsx'
import type { Ref } from 'react'
import type { Problem } from '@/user/data/mockProblems'
import { MathExplainRender } from '@/shared/components/ExamRender'
import { ProblemExplain, parseExplainBlocks } from '@/shared/components/ProblemExplain'
import { ExamScaleFrame } from '@/shared/components/ExamScaleFrame'
import {
  DrawingCanvas,
  type DrawingCanvasHandle,
  type StrokeTool,
} from '@/user/components/quiz/DrawingCanvas'
import styles from './styles/ExplainPanel.module.scss'

/** 해설 위 필기 옵션 — 페이지의 공용 툴바 상태를 그대로 받는다 (리뷰 화면용) */
export interface ExplainDrawing {
  tool: StrokeTool
  color: string
  size: number
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
  revealed: boolean
  /** md+ 에서 사용자가 divider 로 조절한 폭 (px) */
  width: number
  /** divider 드래그 중 · true 면 width transition off (매끄러운 드래그) */
  resizing: boolean
  /** 있으면 해설 본문 위에 필기 캔버스를 얹는다 */
  drawing?: ExplainDrawing
}

/**
 * 우측 사이드 패널 — 해설 단일 뷰 (2026-08-26 탭 제거).
 * 본문에 "정답" · "해설" 섹션 타이틀을 두고 위→아래로 읽는다 (어드민 pv-label 구성과 동일).
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
  revealed,
  width,
  resizing,
  drawing,
}: ExplainPanelProps) {
  // 정답 표시 — 객관식은 원문자, 주관식은 값 그대로. 확인 불가(-)는 서버 응답 전
  const resolvedAnswer = answerNo ?? (problem.answer !== 0 ? problem.answer : null)
  const isShortAnswer = problem.choices.length === 0
  const answerDisplay =
    resolvedAnswer == null
      ? '-'
      : isShortAnswer
        ? String(resolvedAnswer)
        : ['①', '②', '③', '④', '⑤'][resolvedAnswer - 1] ?? '-'

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
            <div className={styles.tabs}>
              <span className={clsx(styles.tabButton, styles.tabButtonActive)}>해설</span>
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

          <div className={styles.body}>
            {/* drawWrap: 필기 오버레이 기준 컨테이너 — 스크롤 내용과 같이 움직이고,
                해설이 짧아도 패널 높이만큼은 채워 아래 여백에도 쓸 수 있다 */}
            <div className={styles.drawWrap}>
            {/* 500px 기준 고정 조판 → 패널 폭 비례 확대 (줄바꿈 불변 · 문제 본문과 동일 정책) */}
            <ExamScaleFrame>
            <div className={clsx(!revealed && styles.bodyBlurred)}>
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
            </div>
            </ExamScaleFrame>

            {drawing && (
              <div
                className={styles.drawOverlay}
                onPointerDownCapture={drawing.onActivate}
              >
                <DrawingCanvas
                  ref={drawing.canvasRef}
                  tool={drawing.tool}
                  color={drawing.color}
                  size={drawing.size}
                  disabled={drawing.disabled}
                  allowFinger={drawing.allowFinger}
                />
              </div>
            )}
            </div>
          </div>
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

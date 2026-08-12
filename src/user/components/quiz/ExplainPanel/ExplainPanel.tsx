import { clsx } from 'clsx'
import type { Problem } from '@/user/data/mockProblems'
import { MathExplainRender } from '@/shared/components/ExamRender'
import { ProblemExplain } from '@/shared/components/ProblemExplain'
import styles from './styles/ExplainPanel.module.scss'

interface ExplainPanelProps {
  open: boolean
  onClose: () => void
  tab: 'answer' | 'explanation'
  onTabChange: (t: 'answer' | 'explanation') => void
  problem: Problem
  /** 서버가 내려준 해설 — 있으면 목 데이터 대신 이걸 어드민과 같은 조판으로 렌더 */
  serverExplanation?: string | null
  revealed: boolean
  /** md+ 에서 사용자가 divider 로 조절한 폭 (px) */
  width: number
  /** divider 드래그 중 · true 면 width transition off (매끄러운 드래그) */
  resizing: boolean
}

/**
 * 우측 사이드 패널 - 정답 · 해설
 * - 데스크탑 · 태블릿 (md+): inline 사이드바 · 문제 카드를 밀어내며 나타남 (width transition)
 * - 모바일 (< md): 전체 화면 슬라이드 인 · overlay backdrop
 * revealed=false 이면 블러 처리 (답 선택 안 한 상태에서 잠깐 노출된 케이스)
 */
export function ExplainPanel({
  open,
  onClose,
  tab,
  onTabChange,
  problem,
  serverExplanation,
  revealed,
  width,
  resizing,
}: ExplainPanelProps) {
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
              <button
                type="button"
                onClick={() => onTabChange('answer')}
                className={clsx(styles.tabButton, tab === 'answer' && styles.tabButtonActive)}
              >
                정답
              </button>
              <button
                type="button"
                onClick={() => onTabChange('explanation')}
                className={clsx(
                  styles.tabButton,
                  tab === 'explanation' && styles.tabButtonActive,
                )}
              >
                해설
              </button>
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
            <div className={clsx(!revealed && styles.bodyBlurred)}>
              {tab === 'answer' ? (
                <div>
                  <p className={styles.answerLabel}>정답</p>
                  <p className={styles.answerValue}>
                    {['①', '②', '③', '④', '⑤'][problem.answer - 1]}
                  </p>
                </div>
              ) : serverExplanation ? (
                /* 서버 해설 — 어드민 업로드·검수 화면과 동일 렌더러 */
                <div className={styles.sections}>
                  <ProblemExplain explanation={serverExplanation} subject={problem.subject} />
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

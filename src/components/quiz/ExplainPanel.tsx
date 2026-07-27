import { clsx } from 'clsx'
import type { Problem } from '@/data/mockProblems'
import { KatexText } from './KatexText'

interface ExplainPanelProps {
  open: boolean
  onClose: () => void
  tab: 'answer' | 'explanation'
  onTabChange: (t: 'answer' | 'explanation') => void
  problem: Problem
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
  revealed,
  width,
  resizing,
}: ExplainPanelProps) {
  return (
    <>
      {/* 모바일용 backdrop · 데스크탑에서는 숨김 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* 패널 wrapper · 반응형 스타일 분기
          md+ 폭: CSS 변수 --pw 로 주입 → tailwind `md:w-[var(--pw)]` 로 적용
          모바일 폭: w-full max-w-md · CSS 변수 무시됨 */}
      <aside
        className={clsx(
          // 공통
          'flex flex-col bg-canvas',
          // 모바일: 우측 fixed slide-in
          'fixed right-0 top-0 z-40 h-dvh w-full max-w-md border-l border-line shadow-2xl transition-transform',
          open ? 'translate-x-0' : 'translate-x-full',
          // 데스크탑 (md+): inline · width 는 CSS 변수 · 드래그 중엔 transition off
          'md:static md:z-auto md:h-auto md:max-w-none md:shadow-none md:translate-x-0 md:overflow-hidden',
          'md:w-[var(--pw,0px)]',
          !resizing && 'md:transition-[width] md:duration-300',
          !open && 'md:border-l-0',
        )}
        style={
          {
            '--pw': open ? `${width}px` : '0px',
          } as React.CSSProperties
        }
      >
        {/* 내부 컨텐츠 · md+ 에서 폭이 0 으로 축소될 때 컨텐츠가 뭉개지지 않도록 CSS 변수와 같은 폭 강제 */}
        <div
          className="flex h-full w-full flex-col md:w-[var(--pw,420px)]"
          style={
            {
              // 닫힘 애니메이션 중에도 내부 컨텐츠 폭은 마지막 사용자 값 유지 → 텍스트 리플로우 방지
              '--pw': `${width}px`,
            } as React.CSSProperties
          }
        >
          <div className="flex h-12 flex-none items-center justify-between border-b border-line px-lg">
            <div className="flex items-center gap-md">
              <TabButton
                active={tab === 'answer'}
                onClick={() => onTabChange('answer')}
              >
                정답
              </TabButton>
              <TabButton
                active={tab === 'explanation'}
                onClick={() => onTabChange('explanation')}
              >
                해설
              </TabButton>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-body hover:bg-surface"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-lg py-lg">
            <div className={clsx(!revealed && 'select-none blur-sm')}>
              {tab === 'answer' ? (
                <div>
                  <p className="text-body-sm text-muted">정답</p>
                  <p className="mt-md text-h2 font-bold text-primary">
                    {['①', '②', '③', '④', '⑤'][problem.answer - 1]}
                  </p>
                </div>
              ) : (
                <div className="space-y-lg">
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'text-body-sm font-semibold transition-colors',
        active ? 'text-primary' : 'text-muted hover:text-body',
      )}
    >
      {children}
    </button>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-body-sm font-semibold text-muted">{title}</p>
      <div className="mt-xs text-body text-foreground">
        <KatexText text={body} />
      </div>
    </div>
  )
}

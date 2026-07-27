interface GuessCheckPopupProps {
  open: boolean
  /** 문제를 푸는 데 걸린 시간 (초) · 팝업에 표시 */
  elapsedSec: number
  /** "맞아" · 실제로 풀었다 */
  onSolved: () => void
  /** "아니야" · 사실 찍었다 */
  onGuessed: () => void
}

/**
 * 10초 안에 정답을 맞혔을 때 표시되는 확인 팝업.
 * "찍은 것 같은데 · 너가 푼 거 맞아?" 로 사용자 자기평가 유도.
 *
 * Figma 디자인 참조 → 흰 카드 · 굵은 제목 · 본문 · 하단 2버튼 (아니야 · 맞아)
 */
export function GuessCheckPopup({
  open,
  elapsedSec,
  onSolved,
  onGuessed,
}: GuessCheckPopupProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-lg">
      {/* Backdrop · 다른 상호작용 차단 · 클릭으로 닫히지 않음 (반드시 선택 필요) */}
      <div className="absolute inset-0 bg-foreground/40" aria-hidden />
      {/* 카드 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guess-check-title"
        className="relative w-full max-w-[380px] rounded-btn-xl bg-canvas px-xl py-xl shadow-[0_16px_40px_rgba(18,12,11,0.24)]"
      >
        {/* 제목 자리에 걸린 시간 · 숫자만 primary 강조 · 왜 팝업 떴는지 즉시 어필 */}
        <h3
          id="guess-check-title"
          className="text-center text-h3 font-bold text-foreground"
        >
          걸린 시간{' '}
          <span className="tabular-nums text-primary">{elapsedSec}초</span>
        </h3>
        <p className="mt-md text-center text-body leading-relaxed text-body">
          찍은 것 같은데,
          <br />
          너가 푼 거 맞아?
        </p>
        <div className="mt-xl flex items-center gap-md">
          <button
            type="button"
            onClick={onGuessed}
            className="flex h-12 flex-1 items-center justify-center rounded-btn-md bg-surface text-body-sm font-semibold text-body transition-colors hover:bg-line active:scale-[0.98]"
          >
            아니야
          </button>
          <button
            type="button"
            onClick={onSolved}
            className="flex h-12 flex-1 items-center justify-center rounded-btn-md bg-primary text-body-sm font-semibold text-white transition-colors hover:bg-primary-hover active:scale-[0.98]"
          >
            맞아
          </button>
        </div>
      </div>
    </div>
  )
}

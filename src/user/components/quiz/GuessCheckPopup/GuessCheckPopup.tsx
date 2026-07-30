import { clsx } from 'clsx'
import styles from './styles/GuessCheckPopup.module.scss'

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
 */
export function GuessCheckPopup({
  open,
  elapsedSec,
  onSolved,
  onGuessed,
}: GuessCheckPopupProps) {
  if (!open) return null
  return (
    <div className={styles.backdrop}>
      {/* Backdrop · 다른 상호작용 차단 · 클릭으로 닫히지 않음 (반드시 선택 필요) */}
      <div className={styles.backdropOverlay} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guess-check-title"
        className={styles.card}
      >
        <h3 id="guess-check-title" className={styles.title}>
          걸린 시간 <span className={styles.titleTime}>{elapsedSec}초</span>
        </h3>
        <p className={styles.body}>
          찍은 것 같은데,
          <br />
          너가 푼 거 맞아?
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onGuessed}
            className={clsx(styles.button, styles.buttonSecondary)}
          >
            아니야
          </button>
          <button
            type="button"
            onClick={onSolved}
            className={clsx(styles.button, styles.buttonPrimary)}
          >
            맞아
          </button>
        </div>
      </div>
    </div>
  )
}

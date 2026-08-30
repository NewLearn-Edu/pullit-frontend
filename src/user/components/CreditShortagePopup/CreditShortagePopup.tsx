import { useState } from 'react'
import coinSvg from '@/assets/coin-reward.svg'
import styles from './styles/CreditShortagePopup.module.scss'

interface CreditShortagePopupProps {
  /** 이 동작에 필요한 크레딧 개수 — 본문 문구에 들어간다 */
  required: number
  onClose: () => void
}

/**
 * 크레딧 부족 팝업 (Figma 2856-17959) — 세트 시작 시 크레딧이 모자랄 때.
 *
 * 진입점(홈 시작 시트 · 추천 리빌 · 잠금해제 시트)이 버튼을 비활성하는 대신
 * 눌리게 두고 이 팝업으로 안내한다 — 왜 못 가는지와 얻는 방법을 함께 말해준다.
 *
 * 초대하기 — 전용 초대 플로우(카카오 공유·보상 지급)가 아직 없어 서비스 링크
 * 공유로 잠정 처리: 모바일은 OS 공유 시트(navigator.share), 그 외엔 클립보드 복사.
 */
export function CreditShortagePopup({ required, onClose }: CreditShortagePopupProps) {
  const [copied, setCopied] = useState(false)

  const invite = async () => {
    const url = window.location.origin
    const text = '풀잇 — 매일 4문제로 수능 약점 찾기'
    try {
      if (navigator.share) {
        await navigator.share({ title: '풀잇', text, url })
        onClose()
        return
      }
    } catch {
      return // 공유 시트를 사용자가 닫음 — 팝업은 유지
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* 클립보드 권한 거부 — 조용히 무시 */
    }
  }

  return (
    <div className={styles.dim} onClick={onClose}>
      <div
        role="alertdialog"
        aria-label="크레딧 부족"
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.coinArea}>
          <img src={coinSvg} alt="" className={styles.coin} />
        </div>

        <p className={styles.title}>크레딧 부족</p>

        <p className={styles.desc}>
          문제 풀려면 크레딧 {required}개가 필요해
          <br />
          친구를 초대하면 크레딧을 받을 수 있어
        </p>

        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={styles.cancel}>
            취소
          </button>
          <button type="button" onClick={invite} className={styles.invite}>
            {copied ? '링크 복사됨' : '초대하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

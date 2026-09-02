import { useEffect, useState } from 'react'
import coinSvg from '@/assets/coin-reward.svg'
import { fetchInviteCode } from '@/user/api/authApi'
import { buildInviteUrl } from '@/user/services/referral'
import { InviteShareSheet } from '@/user/components/InviteShareSheet/InviteShareSheet'
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
 * 초대하기 — 공유 시트(카카오톡 / 링크복사)를 띄워 유저가 채널을 직접 고른다.
 * 링크엔 내 초대 코드(?invite=)가 실려, 친구가 그 링크로 가입하면 크레딧 +5.
 */
export function CreditShortagePopup({ required, onClose }: CreditShortagePopupProps) {
  // 내 초대 코드가 실린 공유 링크 (prod 고정). 코드 조회 전엔 코드 없는 /start 로 폴백
  const [inviteUrl, setInviteUrl] = useState<string>(() => buildInviteUrl(null))
  const [shareOpen, setShareOpen] = useState(false)

  // 팝업이 뜨면 내 초대 코드를 받아 링크를 완성한다 (없으면 서버가 이때 발급)
  useEffect(() => {
    let alive = true
    fetchInviteCode()
      .then((code) => {
        if (alive && code) setInviteUrl(buildInviteUrl(code))
      })
      .catch(() => {
        /* 조회 실패 — 코드 없는 /start 로 유지 (공유 자체는 되게) */
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
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
            <button type="button" onClick={() => setShareOpen(true)} className={styles.invite}>
              초대하기
            </button>
          </div>
        </div>
      </div>

      {/* 공유 시트 — 크레딧 팝업과 형제로 띄운다 (dim 클릭 버블링으로 팝업까지 닫히지 않게) */}
      {shareOpen && <InviteShareSheet url={inviteUrl} onClose={() => setShareOpen(false)} />}
    </>
  )
}

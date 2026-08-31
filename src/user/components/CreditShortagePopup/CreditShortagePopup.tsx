import { useEffect, useState } from 'react'
import coinSvg from '@/assets/coin-reward.svg'
import { shareToKakao } from '@/user/services/kakaoShare'
import { fetchInviteCode, recordInviteShared } from '@/user/api/authApi'
import { buildInviteUrl } from '@/user/services/referral'
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
 * 초대하기 — 카카오톡 공유(Kakao.Share)로 곧장 친구에게 링크를 보낸다. 카카오 SDK 를
 * 못 쓰는 환경(키·도메인 미설정, 로드 실패)에선 OS 공유 시트(navigator.share) →
 * 클립보드 복사 순으로 폴백한다. 링크엔 내 초대 코드(?invite=)가 실려, 친구가 가입하면 +5.
 */
export function CreditShortagePopup({ required, onClose }: CreditShortagePopupProps) {
  const [copied, setCopied] = useState(false)
  // 내 초대 코드가 실린 공유 링크 (prod 고정). 코드 조회 전엔 코드 없는 /start 로 폴백
  const [inviteUrl, setInviteUrl] = useState<string>(() => buildInviteUrl(null))

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

  const invite = async () => {
    // 초대하기 누른 순간 시도 기록 (fire-and-forget — 실패해도 공유는 진행)
    void recordInviteShared().catch(() => {})
    const url = inviteUrl
    const text = '풀잇 — 매일 4문제로 수능 약점 찾기'
    // 1순위: 카카오톡 공유 (앱 고르는 단계 없이 바로 카톡 공유 창 · 썸네일 feed 카드)
    if (
      await shareToKakao({
        title: '풀잇 · 매일 4문제로 수능 약점 찾기',
        description: '내 약점만 콕 집어 추천. 지금 시작하고 크레딧 받아가!',
        url,
      })
    ) {
      onClose()
      return
    }
    // 2순위: OS 공유 시트 (모바일)
    try {
      if (navigator.share) {
        await navigator.share({ title: '풀잇', text, url })
        onClose()
        return
      }
    } catch {
      return // 공유 시트를 사용자가 닫음 — 팝업은 유지
    }
    // 3순위: 클립보드 복사
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

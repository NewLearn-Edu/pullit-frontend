import { useState } from 'react'
import { shareToKakao } from '@/user/services/kakaoShare'
import { recordInviteShared } from '@/user/api/authApi'
import styles from './styles/InviteShareSheet.module.scss'

interface InviteShareSheetProps {
  /** 공유할 초대 링크 (내 코드 ?invite= 포함) */
  url: string
  onClose: () => void
}

const SHARE_TITLE = '풀잇 · 매일 4문제로 수능 약점 찾기'
const SHARE_DESC = '내 약점만 콕 집어 추천. 지금 시작하고 크레딧 받아가!'

/**
 * 초대 공유 시트 — "카카오톡 / 링크복사" 명시적 선택 (자동 폴백 대신 유저가 채널 고름).
 * 채널을 실제로 고른 순간을 초대 "시도"로 기록한다 (recordInviteShared).
 */
export function InviteShareSheet({ url, onClose }: InviteShareSheetProps) {
  const [copied, setCopied] = useState(false)

  const shareKakao = async () => {
    void recordInviteShared().catch(() => {})
    const ok = await shareToKakao({ title: SHARE_TITLE, description: SHARE_DESC, url })
    if (ok) {
      onClose()
      return
    }
    // 카카오 SDK 미가용(도메인 미등록·로드 실패 등) — 링크 복사로 폴백
    await copyLink(false)
  }

  const copyLink = async (record = true) => {
    if (record) void recordInviteShared().catch(() => {})
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
      <div role="dialog" aria-label="공유하기" className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>공유하기</span>
          <button type="button" aria-label="닫기" onClick={onClose} className={styles.close}>
            ×
          </button>
        </div>

        <div className={styles.options}>
          <button type="button" onClick={shareKakao} className={styles.option}>
            <span className={`${styles.icon} ${styles.iconKakao}`} aria-hidden>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4C7 4 3 7.2 3 11.1c0 2.5 1.7 4.7 4.2 5.9-.2.7-.7 2.5-.8 2.9 0 0 0 .3.2.3.1 0 .2 0 .3-.1.4-.3 2.6-1.8 3.6-2.5.4 0 .9.1 1.3.1 5 0 9-3.2 9-7.1S17 4 12 4Z"
                  fill="#181600"
                />
              </svg>
            </span>
            <span className={styles.label}>카카오톡</span>
          </button>

          <button type="button" onClick={() => copyLink()} className={styles.option}>
            <span className={`${styles.icon} ${styles.iconLink}`} aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 15l6-6M10.5 6.5l1.2-1.2a4 4 0 0 1 5.7 5.7l-2.4 2.4M13.5 17.5l-1.2 1.2a4 4 0 0 1-5.7-5.7l2.4-2.4"
                  stroke="#3d3f43"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className={styles.label}>{copied ? '복사됨' : '링크복사'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

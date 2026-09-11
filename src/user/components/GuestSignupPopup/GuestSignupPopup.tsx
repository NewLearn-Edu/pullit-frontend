import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import coinSvg from '@/assets/coin-reward.svg'
import styles from '@/user/components/CreditShortagePopup/styles/CreditShortagePopup.module.scss'

/** 회원가입 축하 크레딧 — 백엔드 CreditCommandService.SIGNUP_WELCOME_REWARD 와 동일 */
const SIGNUP_WELCOME_REWARD = 3

function CheckIcon() {
  return (
    <span className={styles.check} aria-hidden="true">
      <svg viewBox="0 0 12 12" fill="none">
        <path d="M2 6.2 4.8 9 10 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

interface GuestSignupPopupProps {
  /** 이 동작에 필요한 크레딧 개수 — 부제에 들어간다 (세트 시작 = 3) */
  required: number
  onClose: () => void
}

/**
 * 게스트 가입 유도 팝업 (2026-09-07) — 게스트에겐 친구 초대가 없다. 크레딧이 모자랄 때(부족 팝업)와
 * 홈 크레딧 배지를 눌렀을 때(충전 안내 자리) 모두 이 한 장을 띄운다.
 *
 * "부족" 보다 "가입하면 바로 이어서" 를 앞세우고, 혜택 3줄(즉시 +3 · 약점 맞춤 추천 · 기록 보존)을
 * 체크리스트로 보여준 뒤 브랜드 컬러 CTA 로 /signup 에 보낸다 (돌아올 경로를 state 로 실어 준다).
 * 조판은 크레딧 부족 팝업(Figma 2856-17959)의 카드·딤을 그대로 쓴다.
 */
export function GuestSignupPopup({ required, onClose }: GuestSignupPopupProps) {
  const navigate = useNavigate()
  const goSignup = () => {
    onClose()
    navigate('/signup', { state: { from: window.location.pathname + window.location.search } })
  }

  return (
    <div className={styles.dim} onClick={onClose}>
      <div
        role="alertdialog"
        aria-label="가입하고 크레딧 받기"
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={clsx(styles.coinArea, styles.coinAreaGuest)}>
          <img src={coinSvg} alt="" className={styles.coin} />
          <span className={styles.coinBadge}>+{SIGNUP_WELCOME_REWARD}</span>
        </div>

        <p className={styles.title}>가입하면 바로 이어서 풀 수 있어</p>
        <p className={styles.subtitle}>문제를 풀려면 크레딧 {required}개가 필요해</p>

        <ul className={styles.benefits}>
          <li className={styles.benefit}>
            <CheckIcon />
            <span>
              <span className={styles.benefitStrong}>크레딧 {SIGNUP_WELCOME_REWARD}개 즉시 지급</span>
              <span className={styles.benefitNote}> · 세트 1개 분량</span>
            </span>
          </li>
          <li className={styles.benefit}>
            <CheckIcon />
            <span>내 약점에 딱 맞는 문제 추천</span>
          </li>
          <li className={styles.benefit}>
            <CheckIcon />
            <span>진단·풀이 기록이 사라지지 않아</span>
          </li>
        </ul>

        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={styles.cancel}>
            나중에
          </button>
          <button type="button" onClick={goSignup} className={styles.signup}>
            가입하고 성적 올리기
          </button>
        </div>
      </div>
    </div>
  )
}

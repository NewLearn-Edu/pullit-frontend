import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { logout } from '@/user/api/authApi'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import styles from './styles/MyPage.module.scss'

/** 학습 통계 목 — 진단/기록 API 연동 시 교체 (Figma 2627-2336 예시값) */
const MOCK_STATS = { solved: 128, accuracy: 76, streak: 5 }

const APP_VERSION = 'v1.0.0'

/**
 * 마이페이지 (/my · Figma 2627-2336)
 * 프로필 카드 + 학습 통계 + 메뉴 리스트(학습 관리·계정) + 로그아웃.
 * 리포트·크레딧 내역·설정·공지·고객센터는 페이지 준비 전 (POC 시각만).
 */
export default function MyPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const clearSession = useUserStore((s) => s.clear)
  const [signingOut, setSigningOut] = useState(false)

  // 세션(게스트·회원) 필요 — 재발급까지 끝났는데 없으면 로그인으로
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true })
  }, [sessionStatus, navigate])

  const isGuest = me?.type === 'GUEST'

  const handleLogout = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await logout().catch(() => {}) // 서버 실패해도 프론트 세션은 정리하고 나간다
      clearSession()
      navigate('/', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className={styles.page}>
      <UserNav active="my" />

      <main className={styles.main}>
        {/* 프로필 카드 */}
        <section className={styles.profileCard}>
          <div className={styles.profileInfo}>
            <span className={styles.avatar}>🦊</span>
            <div className={styles.userDetails}>
              <p className={styles.userName}>
                {isGuest ? me?.nickname ?? '게스트' : me?.name ?? '이름 없음'}
              </p>
              <p className={styles.userEmail}>
                {isGuest ? '가입하면 푼 기록이 그대로 저장돼요' : me?.email ?? ''}
              </p>
            </div>
          </div>
          {isGuest ? (
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className={clsx(styles.editButton, styles.signupButton)}
            >
              10초만에 가입하기
            </button>
          ) : (
            // 프로필 편집 화면은 준비 전 — POC 시각만
            <button type="button" className={styles.editButton}>
              프로필 편집
            </button>
          )}
        </section>

        {/* 학습 통계 */}
        <section className={styles.statsCard}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>풀은 문제</span>
            <span className={styles.statValue}>{MOCK_STATS.solved}개</span>
          </div>
          <span className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statLabel}>정답률</span>
            <span className={styles.statValue}>{MOCK_STATS.accuracy}%</span>
          </div>
          <span className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statLabel}>연속 학습</span>
            <span className={clsx(styles.statValue, styles.statValueRed)}>
              {MOCK_STATS.streak}일
            </span>
          </div>
        </section>

        {/* 학습 관리 */}
        <section className={styles.menuSection}>
          <p className={styles.menuLabel}>학습 관리</p>
          <div className={styles.menuCard}>
            <MenuItem label="학습 리포트" />
            <MenuItem label="오답 노트" onClick={() => navigate('/wrong-note')} />
            <MenuItem label="크레딧 내역" last />
          </div>
        </section>

        {/* 계정 */}
        <section className={styles.menuSection}>
          <p className={styles.menuLabel}>계정</p>
          <div className={styles.menuCard}>
            <MenuItem label="설정" />
            <MenuItem label="공지사항" />
            <MenuItem label="고객센터" last />
          </div>
        </section>

        {/* 로그아웃 · 버전 */}
        <div className={styles.footerActions}>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className={styles.logoutLink}
          >
            {signingOut ? '로그아웃 중…' : '로그아웃'}
          </button>
          <span className={styles.version}>{APP_VERSION}</span>
        </div>
      </main>
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  last,
}: {
  label: string
  onClick?: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(styles.menuItem, last && styles.menuItemLast)}
    >
      {label}
      <ChevronIcon />
    </button>
  )
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b0b8c1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

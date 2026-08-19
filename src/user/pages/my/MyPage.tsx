import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { logout, updateMarketingConsent, withdrawAccount } from '@/user/api/authApi'
import { fetchStudyStats, type StudyStats } from '@/user/api/attemptApi'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import styles from './styles/MyPage.module.scss'

const APP_VERSION = 'v1.0.0'
const SUPPORT_EMAIL = 'newlearnsoft@gmail.com'

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
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  const isGuest = me?.type === 'GUEST'
  const loadMe = useUserStore((s) => s.loadMe)

  // 학습 통계 — 실데이터 (로딩 전엔 "—")
  const [stats, setStats] = useState<StudyStats | null>(null)
  useEffect(() => {
    if (sessionStatus !== 'ready') return
    fetchStudyStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [sessionStatus])

  // 준비 전 메뉴 안내용 미니 토스트
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])
  const comingSoon = () => setToast('아직 준비 중이에요')

  // 마케팅 수신동의 토글 — 진실원은 me.marketingConsentAt, 저장 중엔 잠금
  const marketingOn = !!me?.marketingConsentAt
  const [consentSaving, setConsentSaving] = useState(false)
  const toggleMarketing = async () => {
    if (consentSaving) return
    setConsentSaving(true)
    const next = !marketingOn
    try {
      await updateMarketingConsent(next)
      await loadMe(true) // marketingConsentAt 갱신 반영
      setToast(next ? '마케팅 정보 수신에 동의했어요' : '마케팅 수신동의를 철회했어요')
    } catch {
      setToast('변경에 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setConsentSaving(false)
    }
  }

  /**
   * 이 브라우저에 남는 개인 흔적 정리 — 로그아웃·탈퇴 공용.
   * 특히 풀이 재전송 큐를 안 지우면 같은 브라우저에서 다른 계정으로
   * 로그인했을 때 이전 사람의 풀이가 새 계정으로 전송된다.
   */
  const clearLocalTraces = () => {
    localStorage.removeItem('pullit_trial_progress')
    ;[
      'pullit_trial_session',
      'pullit_attempt_queue',
      'pullit_signup_form', // 가입 폼 보존분 (이름·생년월일·전화번호)
      'pullit_post_login_redirect',
      'pullit_oauth_state_naver',
      'pullit_oauth_state_google',
    ].forEach((key) => sessionStorage.removeItem(key))
  }

  const handleLogout = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await logout().catch(() => {}) // 서버 실패해도 프론트 세션은 정리하고 나간다
      clearLocalTraces()
      clearSession()
      // 전체 리로드 — zustand 메모리 상태(trialStore 등)가 스토리지를 다시 쓰지 않게
      window.location.replace('/')
    } finally {
      setSigningOut(false)
    }
  }

  // 회원탈퇴 — 확인 다이얼로그를 거쳐 서버 탈퇴 후 로컬 학습 데이터까지 정리
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState(false)
  const handleWithdraw = async () => {
    if (withdrawing) return
    setWithdrawing(true)
    setWithdrawError(false)
    try {
      await withdrawAccount()
      clearLocalTraces()
      clearSession()
      // 전체 리로드 — zustand 메모리 상태가 스토리지를 다시 쓰지 않게
      window.location.replace('/')
    } catch {
      setWithdrawing(false)
      setWithdrawError(true)
    }
  }

  return (
    <div className={styles.page}>
      <UserNav active="my" />

      <main className={styles.main}>
        <PageHeader backTo="history" />

        <div className={styles.content}>
        {/* 프로필 카드 */}
        <section className={styles.profileCard}>
          <div className={styles.profileInfo}>
            <span className={styles.avatar}>🦊</span>
            <div className={styles.userDetails}>
              <p className={styles.userName}>
                {isGuest ? me?.nickname ?? '게스트' : me?.name ?? '이름 없음'}
              </p>
              <p className={styles.userEmail}>
                {isGuest ? '기록은 7일 뒤 사라져요 · 가입하면 그대로 저장돼요' : me?.email ?? ''}
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
            // 프로필 편집 화면은 준비 전
            <button type="button" onClick={comingSoon} className={styles.editButton}>
              프로필 편집
            </button>
          )}
        </section>

        {/* 학습 통계 — GET /api/attempts/me/stats 실데이터 (풀이 없으면 0 · —) */}
        <section className={styles.statsCard}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>풀은 문제</span>
            <span className={styles.statValue}>
              {stats ? `${stats.solvedCount.toLocaleString()}개` : '—'}
            </span>
          </div>
          <span className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statLabel}>정답률</span>
            <span className={styles.statValue}>
              {stats?.accuracyPct != null ? `${stats.accuracyPct}%` : '—'}
            </span>
          </div>
          <span className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statLabel}>연속 학습</span>
            <span className={clsx(styles.statValue, styles.statValueRed)}>
              {stats ? `${stats.streakDays}일` : '—'}
            </span>
          </div>
        </section>

        {/* 학습 관리 */}
        <section className={styles.menuSection}>
          <p className={styles.menuLabel}>학습 관리</p>
          <div className={styles.menuCard}>
            <MenuItem label="오답 노트" onClick={() => navigate('/wrong-note')} />
            <MenuItem label="학습 리포트" onClick={comingSoon} />
            <MenuItem label="크레딧 내역" onClick={comingSoon} last />
          </div>
        </section>

        {/* 계정 */}
        <section className={styles.menuSection}>
          <p className={styles.menuLabel}>계정</p>
          <div className={styles.menuCard}>
            {/* 마케팅 수신동의 — 문서에 "언제든 철회 가능"을 명시했으므로 철회 수단 필수 */}
            {!isGuest && (
              <div className={styles.menuItem}>
                <span>마케팅 정보 수신 동의</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={marketingOn}
                  onClick={toggleMarketing}
                  disabled={consentSaving}
                  className={clsx(styles.switch, marketingOn && styles.switchOn)}
                >
                  <span className={styles.switchKnob} />
                </button>
              </div>
            )}
            <MenuItem label="공지사항" onClick={comingSoon} />
            <MenuItem
              label="고객센터"
              onClick={() => {
                window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[풀잇 문의]')}`
              }}
              last
            />
          </div>
        </section>

        {/* 약관 — 앱 심사 요건상 서비스 내 접근 경로 필수 */}
        <section className={styles.menuSection}>
          <p className={styles.menuLabel}>약관</p>
          <div className={styles.menuCard}>
            <MenuItem label="이용약관" onClick={() => navigate('/policies/terms')} />
            <MenuItem label="개인정보 처리방침" onClick={() => navigate('/policies/privacy')} />
            <MenuItem label="마케팅 수신동의 안내" onClick={() => navigate('/policies/marketing')} last />
          </div>
        </section>

        {/* 로그아웃 · 회원탈퇴 · 버전 */}
        <div className={styles.footerActions}>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className={styles.logoutLink}
          >
            {signingOut ? '로그아웃 중…' : '로그아웃'}
          </button>
          {/* 게스트는 탈퇴 개념 없음 — 7일 미접속 시 자동 삭제 */}
          {!isGuest && (
            <button
              type="button"
              onClick={() => {
                setWithdrawError(false)
                setWithdrawOpen(true)
              }}
              className={styles.logoutLink}
            >
              회원탈퇴
            </button>
          )}
          <span className={styles.version}>{APP_VERSION}</span>
        </div>
        </div>
      </main>

      {/* 미니 토스트 — 준비 중 메뉴 · 동의 변경 결과 안내 */}
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* 회원탈퇴 확인 다이얼로그 */}
      {withdrawOpen && (
        <div className={styles.withdrawDim} onClick={() => !withdrawing && setWithdrawOpen(false)}>
          <div
            role="dialog"
            aria-label="회원탈퇴 확인"
            className={styles.withdrawCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.withdrawTitle}>정말 탈퇴할까?</h2>
            <p className={styles.withdrawDesc}>
              지금 탈퇴하면 30일 뒤 계정과 풀이 기록·크레딧이 완전히 삭제돼.
              <br />그 전에 같은 계정으로 다시 로그인하면 그대로 복구할 수 있어.
            </p>
            {withdrawError && (
              <p className={styles.withdrawError}>탈퇴에 실패했어. 잠시 후 다시 시도해줘</p>
            )}
            <div className={styles.withdrawActions}>
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawing}
                className={styles.withdrawCancel}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={withdrawing}
                className={styles.withdrawConfirm}
              >
                {withdrawing ? '탈퇴 처리 중…' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
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

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { CreditBadge } from '@/user/components/CreditBadge'
import { logout } from '@/user/api/authApi'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import styles from './styles/MyPage.module.scss'

/**
 * 마이페이지 (/my) — 뱅킹 앱 MY 문법 (2026-08-07 레퍼런스 확정):
 *   상단 브랜드 틴트 히어로 (프로필 + 요약 카드 + 퀵 액션)
 *   하단 흰 배경 섹션 리스트 (계정 정보 · 로그아웃)
 * - 회원: 계정 정보 박스 + 로그아웃
 * - 게스트: 가입 유도 카드 + 로그아웃(세션 종료)
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
        {/* ── 브랜드 틴트 히어로 ─────────────────────────────── */}
        <div className={styles.hero}>
          <header className={styles.heroTop}>
            <Link to="/home" className={styles.logo}>
              풀잇
            </Link>
            <CreditBadge credit={me?.creditBalance ?? 0} />
          </header>

          {/* 프로필 */}
          <div className={styles.profile}>
            <span className={styles.avatar}>
              <PersonIcon />
            </span>
            <div className={styles.profileNameWrap}>
              <div className={styles.profileNameRow}>
                <h1 className={styles.profileName}>
                  {isGuest ? me?.nickname ?? '게스트' : `${me?.name ?? '이름 없음'} 님`}
                </h1>
                <span className={clsx(styles.typeBadge, isGuest && styles.typeBadgeGuest)}>
                  {isGuest ? '게스트' : '회원'}
                </span>
              </div>
              <p className={styles.profileSub}>
                {isGuest ? '가입하면 푼 기록이 그대로 저장돼요' : me?.email ?? ''}
              </p>
            </div>
          </div>

          {/* 요약 카드 — 크레딧 | 쌓인 오답 (오답은 홈 학습 상태와 동일한 POC 목값) */}
          <div className={styles.statCard}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>크레딧</span>
              <span className={styles.statValue}>
                {me?.creditBalance ?? 0}
                <em>개</em>
              </span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statLabel}>쌓인 오답</span>
              <span className={styles.statValue}>
                2<em>문제</em>
              </span>
            </div>
          </div>

          {/* 퀵 액션 */}
          <div className={styles.actionCard}>
            <button type="button" onClick={() => navigate('/home')} className={styles.action}>
              <PencilIcon />
              문제 풀기
            </button>
            <button type="button" onClick={() => navigate('/wrong-note')} className={styles.action}>
              <BookmarkIcon />
              오답노트
            </button>
            <button type="button" className={styles.action}>
              <ChartIcon />
              리포트
            </button>
          </div>
        </div>

        {/* ── 하단 섹션 (흰 배경) ────────────────────────────── */}
        <div className={styles.sections}>
          {isGuest ? (
            <section className={styles.guestCard}>
              <div>
                <h3 className={styles.guestTitle}>10초만에 가입하고 약점 기록 남기기</h3>
                <p className={styles.guestDesc}>풀이 기록과 약점 진단이 계정에 저장돼요.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className={styles.guestButton}
              >
                가입하기
              </button>
            </section>
          ) : (
            me && (
              <section>
                <h2 className={styles.sectionLabel}>계정 정보</h2>
                <div className={styles.infoBox}>
                  <InfoRow label="이름" value={me.name ?? '-'} />
                  <InfoRow label="이메일" value={me.email ?? '-'} />
                  <InfoRow label="전화번호" value={me.phoneNumber ?? '-'} />
                  <InfoRow
                    label="생년월일"
                    value={me.birthDate ? me.birthDate.split('-').join('.') : '-'}
                  />
                </div>
              </section>
            )
          )}

          <section>
            <h2 className={styles.sectionLabel}>계정 관리</h2>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className={styles.linkRow}
            >
              {signingOut ? '로그아웃 중…' : '로그아웃'}
              <ChevronRightIcon />
            </button>
          </section>
        </div>
      </main>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  )
}

/* --- 인라인 SVG 아이콘 --- */

function PersonIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V13" />
      <path d="M12 21V7" />
      <path d="M19 21V3" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

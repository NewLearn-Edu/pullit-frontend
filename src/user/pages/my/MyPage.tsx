import { useEffect, useState } from 'react'
import { Toast } from '@/user/components/Toast'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { UserAvatar } from '@/user/components/UserAvatar'
import { PageHeader } from '@/user/components/PageHeader'
import { ConfirmDialog } from '@/user/components/ConfirmDialog'
import { isStandaloneApp } from '@/user/utils/standalone'
import { GRADE_LABEL, logout, updateMarketingConsent } from '@/user/api/authApi'
import { clearLocalTraces } from '@/user/utils/localTraces'
import { CreditCoin } from '@/user/components/CreditBadge/CreditBadge'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import styles from './styles/MyPage.module.scss'

const APP_VERSION = 'v1.0.0'
/**
 * 고객센터 카카오톡 채널 채팅 URL (풀잇 공식 채널 _NVnwX).
 * /chat 을 열면 채널 추가 + 1:1 채팅으로 이어진다 (모바일은 카카오톡 앱, PC 는 카카오톡 웹챗).
 */
const KAKAO_CHANNEL_CHAT_URL = 'http://pf.kakao.com/_NVnwX/chat'

/**
 * 생년월일 → 학년 라벨 (한국 나이 = 올해 − 출생년 + 1).
 * 서비스 대상(중2~고3) 밖이거나 생일 미입력이면 null — 메타 줄에서 숨긴다.
 */
function gradeLabel(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null
  const birthYear = Number(birthDate.slice(0, 4))
  if (!birthYear) return null
  const koreanAge = new Date().getFullYear() - birthYear + 1
  const map: Record<number, string> = {
    15: '중2', 16: '중3', 17: '고1', 18: '고2', 19: '고3',
  }
  return map[koreanAge] ?? null
}

/**
 * 마이페이지 (/my · Figma 2627-2336)
 * 프로필 카드 + 메뉴 리스트(계정·약관) + 로그아웃.
 * 리포트·설정은 페이지 준비 전 (POC 시각만).
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

  // 준비 전 메뉴 안내용 미니 토스트
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  // 마케팅 수신동의 토글 — 진실원은 me.marketingConsentAt, 저장 중엔 잠금
  const marketingOn = !!me?.marketingConsentAt
  const [consentSaving, setConsentSaving] = useState(false)
  // 끄기(철회)만 확인 팝업을 거친다 — 켜기는 바로 저장 (2026-09-04)
  const [consentOffOpen, setConsentOffOpen] = useState(false)
  const toggleMarketing = () => {
    if (consentSaving) return
    if (marketingOn) {
      setConsentOffOpen(true)
      return
    }
    void saveMarketing(true)
  }
  const saveMarketing = async (next: boolean) => {
    if (consentSaving) return
    setConsentSaving(true)
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

  // 로그아웃 — 확인 팝업(공용 ConfirmDialog)을 거친다 (2026-09-04)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const handleLogout = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await logout().catch(() => {}) // 서버 실패해도 프론트 세션은 정리하고 나간다
      clearLocalTraces()
      clearSession()
      // 전체 리로드 — zustand 메모리 상태(trialStore 등)가 스토리지를 다시 쓰지 않게.
      // 홈 화면 웹앱(패드·모바일)은 회원 전용이라 로그인으로, 웹은 마케팅 랜딩으로
      window.location.replace(isStandaloneApp() ? '/login' : '/')
    } finally {
      setSigningOut(false)
    }
  }

  // 회원탈퇴 — 확인 팝업(공용 ConfirmDialog) → 사유 선택 화면(/my/withdraw)에서 진행 (2026-09-04)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  return (
    <div className={styles.page}>
      <UserNav active="my" />

      <main className={styles.main}>
        {/* 뒤로가기 없음 (2026-09-06) — 마이는 하단 탭·사이드바의 최상위 진입점이라 돌아갈 "직전"이 없다 */}
        <PageHeader />

        <div className={styles.content}>
        {/* 프로필 헤더 — 토스 프로필형 세로 중앙 배치 (아바타 · 이름 · 학년|코인 메타) */}
        <section className={styles.profileCard}>
          <UserAvatar src={me?.profileImageUrl} size={72} />
          <p className={styles.userName}>
            {/* 표시명은 닉네임 우선 — 프로필 편집에서 바꾸는 값 (없으면 실명) */}
            {isGuest ? me?.nickname ?? '게스트' : me?.nickname ?? me?.name ?? '이름 없음'}
          </p>
          {isGuest ? (
            <p className={styles.profileMeta}>기록은 7일 뒤 사라져요 · 가입하면 그대로 저장돼요</p>
          ) : (
            <p className={styles.profileMeta}>
              {(me?.grade ? GRADE_LABEL[me.grade] : gradeLabel(me?.birthDate)) && (
                <>
                  <span>{me?.grade ? GRADE_LABEL[me.grade] : gradeLabel(me?.birthDate)}</span>
                  <span className={styles.metaDivider} aria-hidden />
                </>
              )}
              <span className={styles.metaCredit}>
                <CreditCoin />
                {me?.creditBalance ?? 0}
              </span>
            </p>
          )}
          {isGuest ? (
            <button
              type="button"
              // 가입을 마치면 결과 화면이 아니라 여기로 돌아온다 (퍼널 진입과 구분 · 2026-09-06)
              onClick={() => navigate('/signup', { state: { from: '/my' } })}
              className={clsx(styles.editButton, styles.signupButton)}
            >
              10초만에 가입하기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/my/profile')}
              className={styles.editButton}
            >
              프로필 편집
            </button>
          )}
        </section>

        {/* 학습 통계(푼 문제·구분·연속 학습)와 학습 관리(오답 노트·학습 기록) 영역 제거 (2026-09-06).
            풀이 수치는 학습 리포트가, 진입은 하단 네비·헤더 오답 배지가 이미 맡는다 */}

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
            <MenuItem
              label="고객센터"
              onClick={() => {
                // 카카오톡 채널 채팅으로 연결 (채널 추가 + 1:1 문의)
                window.open(KAKAO_CHANNEL_CHAT_URL, '_blank', 'noopener,noreferrer')
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
          {/* "로그아웃 | 회원탈퇴" 한 줄 — 얇은 세로 구분선, 밑줄 없는 회색 텍스트 (2026-09-04).
              게스트(비회원)에겐 둘 다 없다 — 계정이 아니라 브라우저 세션이고 7일 미접속 시 자동 삭제. 가입 전환은 위 CTA */}
          {!isGuest && (
            <div className={styles.accountLinks}>
              <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                disabled={signingOut}
                className={styles.logoutLink}
              >
                {signingOut ? '로그아웃 중…' : '로그아웃'}
              </button>
              <span className={styles.accountDivider} aria-hidden />
              <button
                type="button"
                onClick={() => setWithdrawOpen(true)}
                className={styles.logoutLink}
              >
                회원탈퇴
              </button>
            </div>
          )}
          <span className={styles.version}>{APP_VERSION}</span>
        </div>
        </div>
      </main>

      {/* 미니 토스트 — 준비 중 메뉴 · 동의 변경 결과 안내 */}
      <Toast show={!!toast} fit bottom="calc(var(--nav-bottom-h) + 24px)" className={styles.toast}>
        {toast}
      </Toast>

      {/* 마케팅 수신동의 철회 확인 — 켜기는 바로, 끄기만 묻는다 */}
      {consentOffOpen && (
        <ConfirmDialog
          title="마케팅 수신동의를 철회할까?"
          desc="철회하면 새 문제·이벤트 같은 소식을 알림톡으로 받을 수 없어. 언제든 다시 켤 수 있어."
          cancelLabel="취소"
          confirmLabel="철회하기"
          danger
          onCancel={() => setConsentOffOpen(false)}
          onConfirm={() => {
            setConsentOffOpen(false)
            void saveMarketing(false)
          }}
        />
      )}

      {/* 로그아웃 확인 — 풀이 나가기 등과 같은 공용 팝업. 확인은 파괴적 동작이라 빨강 */}
      {logoutOpen && (
        <ConfirmDialog
          title="로그아웃 할까?"
          desc="다시 로그인하면 학습 기록은 그대로 이어져."
          cancelLabel="취소"
          confirmLabel={signingOut ? '로그아웃 중…' : '로그아웃'}
          danger
          onCancel={() => !signingOut && setLogoutOpen(false)}
          onConfirm={handleLogout}
        />
      )}

      {/* 회원탈퇴 확인 — 주 버튼은 "서비스로 돌아가기", 탈퇴는 왼쪽 보조. 딤 클릭은 팝업만 닫힌다 */}
      {withdrawOpen && (
        <ConfirmDialog
          title="탈퇴 전에 꼭 확인하세요"
          desc={'탈퇴하면 30일 뒤 계정과\n풀이 기록·크레딧이 완전히 삭제돼.\n\n그 전에 다시 로그인하면\n복구할 수 있어.'}
          cancelLabel="그래도 탈퇴하기"
          confirmLabel="서비스로 돌아가기"
          accent
          onCancel={() => {
            setWithdrawOpen(false)
            navigate('/my/withdraw')
          }}
          onConfirm={() => setWithdrawOpen(false)}
          onDismiss={() => setWithdrawOpen(false)}
        />
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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { PageHeader } from '@/user/components/PageHeader'
import { Toast } from '@/user/components/Toast'
import { ConfirmDialog } from '@/user/components/ConfirmDialog'
import { updateMarketingConsent, updateStudyAlert } from '@/user/api/authApi'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import styles from './styles/MyPage.module.scss'

/**
 * 알림 설정 (/my/notifications · 2026-09-15) — 마이페이지 계정 카드에 있던 두 스위치를 한 화면으로.
 *   - 학습 알림: 매일 저녁 오늘의 문제 알림톡 (users.study_alert_enabled)
 *   - 마케팅 정보 수신 동의: 새 문제·이벤트 소식 (users.marketing_consent_at · 동의 시각이 진실원)
 * 켜기는 바로 저장, 끄기만 확인 팝업. 게스트는 마이페이지에서 이 메뉴가 안 보인다.
 * 카드·스위치·토스트 스타일은 마이페이지 모듈을 그대로 쓴다 (같은 계정 영역의 연장).
 */
export default function NotificationSettingsPage() {
  const navigate = useNavigate()
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const loadMe = useUserStore((s) => s.loadMe)

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true, state: { from: '/my/notifications' } })
  }, [sessionStatus, navigate])

  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  // 학습 알림 — 구버전 서버 응답에 값이 없으면 켜짐으로 본다
  const studyAlertOn = me?.studyAlertEnabled !== false
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertOffOpen, setAlertOffOpen] = useState(false)
  const saveStudyAlert = async (next: boolean) => {
    if (alertSaving) return
    setAlertSaving(true)
    try {
      await updateStudyAlert(next)
      await loadMe(true)
      setToast(next ? '학습 알림을 켰어요' : '학습 알림을 껐어요')
    } catch {
      setToast('변경에 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setAlertSaving(false)
    }
  }

  // 마케팅 수신동의 — 철회만 확인 (2026-09-04 규칙 그대로)
  const marketingOn = !!me?.marketingConsentAt
  const [consentSaving, setConsentSaving] = useState(false)
  const [consentOffOpen, setConsentOffOpen] = useState(false)
  const saveMarketing = async (next: boolean) => {
    if (consentSaving) return
    setConsentSaving(true)
    try {
      await updateMarketingConsent(next)
      await loadMe(true)
      setToast(next ? '마케팅 정보 수신에 동의했어요' : '마케팅 수신동의를 철회했어요')
    } catch {
      setToast('변경에 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setConsentSaving(false)
    }
  }

  const consentDate = me?.marketingConsentAt ? me.marketingConsentAt.slice(0, 10).replace(/-/g, '.') : null

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PageHeader backTo="history" center={<span className="text-[17px] font-bold text-[#121417]">알림 설정</span>} />

      <main className="mx-auto flex w-full max-w-[620px] flex-1 flex-col px-[20px] pb-[60px] pt-[16px]">
        <div className={styles.menuCard}>
          <SettingRow
            title="학습 알림"
            desc="매일 저녁, 오늘의 문제를 카카오톡으로 알려줘"
            on={studyAlertOn}
            saving={alertSaving}
            onToggle={() => (studyAlertOn ? setAlertOffOpen(true) : void saveStudyAlert(true))}
          />
          <SettingRow
            title="마케팅 정보 수신 동의"
            desc={consentDate ? `새 문제·이벤트 소식 · ${consentDate} 동의` : '새 문제·이벤트 소식을 받아'}
            on={marketingOn}
            saving={consentSaving}
            onToggle={() => (marketingOn ? setConsentOffOpen(true) : void saveMarketing(true))}
            last
          />
        </div>
      </main>

      <Toast show={!!toast} fit bottom="32px" className={styles.toast}>
        {toast}
      </Toast>

      {alertOffOpen && (
        <ConfirmDialog
          title="학습 알림을 끌까?"
          desc="끄면 학습 알림톡이 오지 않아. 언제든 다시 켤 수 있어."
          cancelLabel="취소"
          confirmLabel="끄기"
          danger
          onCancel={() => setAlertOffOpen(false)}
          onConfirm={() => {
            setAlertOffOpen(false)
            void saveStudyAlert(false)
          }}
        />
      )}
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
    </div>
  )
}

/** 제목 + 설명 한 줄 + 스위치 — 마이페이지 menuItem 규격에 설명 줄만 더한 행 */
function SettingRow({
  title,
  desc,
  on,
  saving,
  onToggle,
  last,
}: {
  title: string
  desc: string
  on: boolean
  saving: boolean
  onToggle: () => void
  last?: boolean
}) {
  return (
    <div className={clsx(styles.menuItem, last && styles.menuItemLast)}>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span>{title}</span>
        <span className="text-[13px] font-normal text-[#80858b]">{desc}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={onToggle}
        disabled={saving}
        className={clsx(styles.switch, on && styles.switchOn)}
      >
        <span className={styles.switchKnob} />
      </button>
    </div>
  )
}

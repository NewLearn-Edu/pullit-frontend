import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { PageHeader } from '@/user/components/PageHeader'
import { UserNav } from '@/user/components/UserNav'
import { CreditCoin } from '@/user/components/CreditBadge/CreditBadge'
import { Skeleton } from '@/user/components/Skeleton'
import { InviteShareSheet } from '@/user/components/InviteShareSheet/InviteShareSheet'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { fetchInviteCode } from '@/user/api/authApi'
import { buildInviteUrl } from '@/user/services/referral'
import { fetchCreditTransactions, type CreditTransaction } from '@/user/api/creditApi'
import styles from './styles/CreditHistoryPage.module.scss'

type Filter = 'all' | 'earn' | 'use'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'earn', label: '적립' },
  { key: 'use', label: '사용' },
]

/**
 * 크레딧 내역 (/my/credits · 마이페이지 › 학습 관리 › 크레딧 내역)
 * 큰 잔액 히어로 + 친구 초대 CTA · 전체/적립/사용 필터 · 날짜별 리스트 (토스 자산 내역 톤).
 * 서버 원장(credit_transactions)이 진실원 — 최신순 최근 200건.
 *
 * 원장은 사용 건도 amount 를 양수로 적으므로 부호는 종류(type)로 정한다 —
 * USE · ADMIN_DEDUCT 는 차감(−), REWARD · ADMIN_GRANT 는 적립(+).
 */
export default function CreditHistoryPage() {
  const navigate = useNavigate()
  useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const credit = useUserStore((s) => s.me?.creditBalance ?? null)

  const [items, setItems] = useState<CreditTransaction[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  // 친구 초대 — 크레딧 부족 팝업과 같은 공유 시트 (내 초대 코드 링크)
  const [inviteUrl, setInviteUrl] = useState<string>(() => buildInviteUrl(null))
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  useEffect(() => {
    if (sessionStatus !== 'ready') return
    let alive = true
    fetchCreditTransactions()
      .then((list) => {
        if (alive) setItems(list)
      })
      .catch(() => {
        if (alive) {
          setItems([])
          setFailed(true)
        }
      })
    fetchInviteCode()
      .then((code) => {
        if (alive && code) setInviteUrl(buildInviteUrl(code))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [sessionStatus])

  const filtered = useMemo(() => {
    const list = items ?? []
    if (filter === 'earn') return list.filter((tx) => signedAmount(tx) > 0)
    if (filter === 'use') return list.filter((tx) => signedAmount(tx) < 0)
    return list
  }, [items, filter])

  // 날짜별 그룹 (최신순 유지)
  const groups = useMemo(() => {
    const map = new Map<string, CreditTransaction[]>()
    for (const tx of filtered) {
      const key = dateKey(tx.createdAt)
      const list = map.get(key)
      if (list) list.push(tx)
      else map.set(key, [tx])
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div className={styles.page}>
      <UserNav active="my" />
      <div className={styles.main}>
        <PageHeader
          backTo="/my"
          center={<span className="text-[17px] font-bold text-[#121417]">크레딧 내역</span>}
        />

        <main className={styles.content}>
          {/* 잔액 히어로 */}
          <section className={styles.hero}>
            <p className={styles.heroLabel}>보유 크레딧</p>
            <p className={styles.heroValue}>
              <CreditCoin />
              {credit ?? '—'}
              <span className={styles.heroUnit}>개</span>
            </p>
            <button type="button" onClick={() => setShareOpen(true)} className={styles.inviteCta}>
              친구 초대하고 +5 받기
            </button>
          </section>

          {/* 필터 */}
          <div className={styles.filters} role="tablist" aria-label="내역 종류">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(styles.chip, filter === f.key && styles.chipActive)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {items === null ? (
            <div className={styles.skeleton}>
              <Skeleton style={{ width: '58%', height: 18 }} radius={8} />
              <Skeleton style={{ width: '42%', height: 18 }} radius={8} />
              <Skeleton style={{ width: '66%', height: 18 }} radius={8} />
            </div>
          ) : groups.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {failed
                  ? '내역을 불러오지 못했어'
                  : filter === 'all'
                    ? '아직 크레딧 내역이 없어'
                    : filter === 'earn'
                      ? '적립 내역이 없어'
                      : '사용 내역이 없어'}
              </p>
              <p className={styles.emptyDesc}>
                {failed ? '잠시 후 다시 시도해줘' : '진단을 완료하거나 친구를 초대하면 크레딧이 쌓여'}
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {groups.map(([date, list]) => (
                <section key={date}>
                  <p className={styles.dateHead}>{formatDateHeading(date)}</p>
                  {list.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </main>
      </div>

      {shareOpen && <InviteShareSheet url={inviteUrl} onClose={() => setShareOpen(false)} />}
    </div>
  )
}

function TransactionRow({ tx }: { tx: CreditTransaction }) {
  const amount = signedAmount(tx)
  const plus = amount > 0
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <p className={styles.rowTitle}>{titleOf(tx)}</p>
        <p className={styles.rowSub}>
          {formatTime(tx.createdAt)} · 잔액 {tx.balanceAfter}
        </p>
      </div>
      <p className={clsx(styles.amount, plus && styles.amountPlus)}>
        {plus ? '+' : '−'}
        {Math.abs(amount)}
      </p>
    </div>
  )
}

/** 부호는 종류로 — 원장 amount 는 사용 건도 양수 */
export function signedAmount(tx: CreditTransaction): number {
  const magnitude = Math.abs(tx.amount)
  return tx.type === 'USE' || tx.type === 'ADMIN_DEDUCT' ? -magnitude : magnitude
}

/** 표시 제목 — 보상 종류가 있으면 종류별 고정 문구, 없으면 서버 사유 */
function titleOf(tx: CreditTransaction): string {
  switch (tx.rewardType) {
    case 'TRIAL_FIRST_CLEAR':
      return '첫 진단 완료 보상'
    case 'SIGNUP_WELCOME':
      return '회원가입 축하 보상'
    case 'INVITE_FRIEND_COMPLETE':
      return '친구 초대 보상'
    default:
      break
  }
  if (tx.type === 'USE') return tx.reason === '진단 세트 시작' ? '문제 세트 시작' : tx.reason || '문제 세트 시작'
  if (tx.type === 'ADMIN_GRANT') return tx.reason ? `크레딧 지급 · ${tx.reason}` : '크레딧 지급'
  if (tx.type === 'ADMIN_DEDUCT') return tx.reason ? `크레딧 차감 · ${tx.reason}` : '크레딧 차감'
  return tx.reason || '크레딧 변동'
}

const pad = (n: number) => String(n).padStart(2, '0')

function dateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "오늘" · "어제" · "9월 1일 (화)" · 지난해는 "2025년 12월 3일 (수)" */
function formatDateHeading(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][target.getDay()]
  const year = y !== today.getFullYear() ? `${y}년 ` : ''
  return `${year}${m}월 ${d}일 (${weekday})`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

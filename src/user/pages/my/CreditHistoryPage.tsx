import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { PageHeader } from '@/user/components/PageHeader'
import { UserNav } from '@/user/components/UserNav'
import { CreditCoin } from '@/user/components/CreditBadge/CreditBadge'
import { Skeleton } from '@/user/components/Skeleton'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { fetchCreditTransactions, type CreditTransaction } from '@/user/api/creditApi'
import styles from './styles/CreditHistoryPage.module.scss'

/**
 * 크레딧 내역 (/my/credits · 마이페이지 › 학습 관리 › 크레딧 내역)
 * 잔액 카드 + 날짜별로 묶은 증감 리스트. 서버 원장(credit_transactions)이 진실원 — 최신순 최근 200건.
 * 적립은 빨강(+), 사용·차감은 파랑(−) — 점수 변동 화면과 같은 색 언어.
 */
export default function CreditHistoryPage() {
  const navigate = useNavigate()
  useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const credit = useUserStore((s) => s.me?.creditBalance ?? null)

  const [items, setItems] = useState<CreditTransaction[] | null>(null)
  const [failed, setFailed] = useState(false)

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
    return () => {
      alive = false
    }
  }, [sessionStatus])

  // 날짜별 그룹 (최신순 유지)
  const groups = useMemo(() => {
    const map = new Map<string, CreditTransaction[]>()
    for (const tx of items ?? []) {
      const key = dateKey(tx.createdAt)
      const list = map.get(key)
      if (list) list.push(tx)
      else map.set(key, [tx])
    }
    return Array.from(map.entries())
  }, [items])

  return (
    <div className={styles.page}>
      <UserNav active="my" />
      <div className={styles.main}>
        <PageHeader
          backTo="/my"
          center={<span className="text-[17px] font-bold text-[#121417]">크레딧 내역</span>}
        />

        <main className={styles.content}>
          {/* 잔액 */}
          <section className={styles.balanceCard}>
            <div>
              <p className={styles.balanceLabel}>보유 크레딧</p>
              <p className={styles.balanceHint}>친구를 초대하면 크레딧을 받을 수 있어</p>
            </div>
            <p className={styles.balanceValue}>
              <CreditCoin />
              {credit ?? '—'}
            </p>
          </section>

          {items === null ? (
            <div className={styles.skeletonCard}>
              <Skeleton style={{ width: '60%', height: 16 }} radius={8} />
              <Skeleton style={{ width: '45%', height: 16 }} radius={8} />
              <Skeleton style={{ width: '70%', height: 16 }} radius={8} />
            </div>
          ) : groups.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{failed ? '내역을 불러오지 못했어' : '아직 크레딧 내역이 없어'}</p>
              <p className={styles.emptyDesc}>
                {failed
                  ? '잠시 후 다시 시도해줘'
                  : '진단을 완료하거나 친구를 초대하면 크레딧이 쌓여'}
              </p>
            </div>
          ) : (
            groups.map(([date, list]) => (
              <section key={date} className={styles.group}>
                <p className={styles.groupDate}>{formatDateHeading(date)}</p>
                <div className={styles.groupCard}>
                  {list.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    </div>
  )
}

function TransactionRow({ tx }: { tx: CreditTransaction }) {
  const plus = tx.amount > 0
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon} aria-hidden>
        {iconOf(tx)}
      </span>
      <div className={styles.rowMain}>
        <p className={styles.rowTitle}>{titleOf(tx)}</p>
        <p className={styles.rowSub}>{formatTime(tx.createdAt)}</p>
      </div>
      <div className={styles.rowAmounts}>
        <p className={clsx(styles.amount, plus ? styles.amountPlus : styles.amountMinus)}>
          {plus ? '+' : '−'}
          {Math.abs(tx.amount)}
        </p>
        <p className={styles.after}>잔액 {tx.balanceAfter}</p>
      </div>
    </div>
  )
}

/** 표시 제목 — 보상 종류가 있으면 종류별 고정 문구, 없으면 서버 사유 그대로 */
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
  if (tx.type === 'USE') return tx.reason || '문제 세트 시작'
  if (tx.type === 'ADMIN_GRANT') return tx.reason ? `지급 · ${tx.reason}` : '크레딧 지급'
  if (tx.type === 'ADMIN_DEDUCT') return tx.reason ? `차감 · ${tx.reason}` : '크레딧 차감'
  return tx.reason || '크레딧 변동'
}

function iconOf(tx: CreditTransaction): string {
  switch (tx.rewardType) {
    case 'TRIAL_FIRST_CLEAR':
      return '🎯'
    case 'SIGNUP_WELCOME':
      return '🎉'
    case 'INVITE_FRIEND_COMPLETE':
      return '🤝'
    default:
      break
  }
  if (tx.type === 'USE') return '📘'
  return tx.amount > 0 ? '🎁' : '↩︎'
}

const pad = (n: number) => String(n).padStart(2, '0')

function dateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "오늘" · "어제" · "2026.08.31 (월)" */
function formatDateHeading(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][target.getDay()]
  return `${y}.${pad(m)}.${pad(d)} (${weekday})`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

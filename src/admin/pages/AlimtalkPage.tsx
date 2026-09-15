import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  fetchCampaignDaily,
  fetchCampaignPreview,
  fetchCampaignSends,
  type CampaignDaily,
  type CampaignKind,
  type CampaignPreview,
  type CampaignSend,
  type CampaignSendStatus,
} from '../api/adminApi'
import { StatCard } from '../components/StatCard'

const PAGE_SIZE = 20
const DAILY_DAYS = 14
/** 19:00 KST 배치 — 그 전에는 오늘 행이 "예정" 으로 보인다 */
const BATCH_HOUR = 19

type StatusFilter = 'all' | CampaignSendStatus

const STATUS_LABEL: Record<CampaignSendStatus, string> = { SENT: '성공', FAILED: '실패' }
const STATUS_BADGE: Record<CampaignSendStatus, string> = { SENT: 'badge live', FAILED: 'badge danger' }
const CAMPAIGN_LABEL: Record<CampaignKind, string> = { DAILY_PROBLEM_ALIMTALK: '알림톡', EVENING_REMINDER: '문자' }
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** KST 오늘 — 브라우저 시간대와 무관하게 서버(배치)와 같은 날짜를 본다 */
function todayKst(): { date: string; hour: number } {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return { date: kst.toISOString().slice(0, 10), hour: kst.getUTCHours() }
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

/** 2026-09-15T19:00:03 → 19:00:03 (선택한 날짜의 내역이라 시각만) */
function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(11, 19)
}

/** 09-15 (월) */
function formatDay(date: string): { md: string; wd: string } {
  const d = new Date(`${date}T00:00:00`)
  return { md: date.slice(5).replace('-', '.'), wd: WEEKDAY[d.getDay()] }
}

/** "java.lang.IllegalStateException: alimtalk rejected: E101 ..." → "alimtalk rejected: E101 ..." — 예외 클래스명은 떼고 사유만 */
function humanizeReason(reason: string | null): string {
  if (!reason) return ''
  return reason.replace(/^[\w.$]*(Exception|Error):\s*/, '')
}

function pctOf(sent: number, total: number): string {
  return total > 0 ? `${Math.round((sent / total) * 100)}%` : '—'
}

/**
 * 알림톡 — 매일 19:00 학습 알림(카카오 · PULLITNOAH01) 발송 현황 (2026-09-15).
 * sms_campaign_sends 를 날짜별로 열람한다. "성공" 은 카카오(SENS) 접수 성공이고 단말 도달은 SENS 콘솔이 관리한다.
 * 오늘 19:00 전에는 preview 로 "발송 예정 대상" 을 보여준다.
 */
export default function AlimtalkPage() {
  const { date: today, hour: nowHour } = useMemo(todayKst, [])
  const [date, setDate] = useState(today)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(0)

  const [rows, setRows] = useState<CampaignSend[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')

  const [daily, setDaily] = useState<CampaignDaily[]>([])
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  /** 선택일이 최근 14일 밖이면 성공·실패 건수를 따로 센다 */
  const [outsideCount, setOutsideCount] = useState<{ date: string; sent: number; failed: number } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    fetchCampaignDaily(DAILY_DAYS)
      .then((d) => alive && setDaily(d))
      .catch(() => {})
    fetchCampaignPreview()
      .then((p) => alive && setPreview(p))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [reloadKey])

  useEffect(() => {
    let alive = true
    setState('loading')
    fetchCampaignSends({ date, status: status === 'all' ? undefined : status, page, size: PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setRows(res.content)
        setTotal(res.totalElements)
        setTotalPages(res.totalPages)
        setState('done')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [date, status, page, reloadKey])

  const dailyRow = daily.find((d) => d.date === date) ?? null
  useEffect(() => {
    if (dailyRow || daily.length === 0) {
      setOutsideCount(null)
      return
    }
    let alive = true
    Promise.all([
      fetchCampaignSends({ date, status: 'SENT', size: 1 }),
      fetchCampaignSends({ date, status: 'FAILED', size: 1 }),
    ])
      .then(([s, f]) => alive && setOutsideCount({ date, sent: s.totalElements, failed: f.totalElements }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [date, dailyRow, daily.length, reloadKey])

  const counts = dailyRow ?? (outsideCount?.date === date ? outsideCount : null)
  const sent = counts?.sent ?? 0
  const failed = counts?.failed ?? 0
  const attempted = sent + failed
  const isToday = date === today
  /** 오늘인데 아직 기록이 없고 19:00 전 — 발송 예정 (preview 대상 수를 보여준다) */
  const pending = isToday && attempted === 0 && nowHour < BATCH_HOUR

  const pageButtons = useMemo(() => {
    const start = Math.max(0, Math.min(page - 2, totalPages - 5))
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)
  }, [page, totalPages])
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)

  const selectDate = (next: string) => {
    if (!next || next === date) return
    setDate(next)
    setPage(0)
  }

  const channelLabel = preview ? (preview.channel === 'ALIMTALK' ? '카카오 알림톡' : '광고 문자(LMS)') : '—'

  return (
    <section className="view">
      <div className="page-head">
        <div>
          <h2 className="section-title" style={{ marginBottom: 4 }}>알림톡</h2>
          <p className="page-sub">매일 19:00 학습 알림 발송 현황 · 성공은 카카오 접수 기준이에요</p>
        </div>
        <div className="alimtalk-status">
          <span>
            채널 <strong style={{ color: 'var(--color-fg)', fontWeight: 600 }}>{channelLabel}</strong>
          </span>
          <span className="sep">·</span>
          <span>
            19:00 배치{' '}
            {preview ? (
              <span className={preview.enabled ? 'on' : 'off'}>{preview.enabled ? '켜짐' : '꺼짐'}</span>
            ) : (
              '—'
            )}
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
            새로고침
          </button>
        </div>
      </div>

      {/* KPI — 선택한 날짜 기준. 오늘 19:00 전에는 "발송 예정 대상" 으로 바뀐다 */}
      <div className="kpi-problems kpi-funnel">
        <StatCard
          label={pending ? '발송 예정 대상' : '발송 대상'}
          value={pending ? (preview ? preview.targetCount.toLocaleString() : '—') : attempted.toLocaleString()}
          delta={pending ? '오늘 19:00 발송 · 아직 안 푼 학습 알림 회원' : isToday ? '오늘 발송 완료' : `${date} 발송`}
          tone="flat"
        />
        <StatCard
          label="성공"
          value={pending ? '—' : sent.toLocaleString()}
          delta={pending ? '발송 전' : '카카오 접수 성공'}
          tone={pending ? 'flat' : 'good'}
        />
        <StatCard
          label="실패"
          value={pending ? '—' : failed.toLocaleString()}
          valueColor={failed > 0 ? 'var(--color-primary)' : undefined}
          delta={pending ? '발송 전' : failed > 0 ? '실패 사유는 아래 표에서' : '실패 없음'}
          tone={failed > 0 ? 'up' : 'flat'}
        />
        <StatCard
          label="성공률"
          value={pending ? '—' : pctOf(sent, attempted)}
          delta={pending ? '발송 전' : attempted > 0 ? `${sent.toLocaleString()} / ${attempted.toLocaleString()}` : '발송 기록 없음'}
          tone={!pending && attempted > 0 && failed === 0 ? 'good' : 'flat'}
        />
      </div>

      <div className="alimtalk-layout">
        <div className="card" style={{ padding: 18 }}>
          <div className="toolbar">
            <input
              type="date"
              className={clsx('input-date', date && 'has-value')}
              value={date}
              max={today}
              onChange={(e) => selectDate(e.target.value)}
              aria-label="발송일"
            />
            <select
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter)
                setPage(0)
              }}
              aria-label="상태"
            >
              <option value="all">전체 상태</option>
              <option value="SENT">성공</option>
              <option value="FAILED">실패</option>
            </select>
            {!isToday && (
              <button type="button" className="btn btn-ghost" onClick={() => selectDate(today)}>
                오늘
              </button>
            )}
            <div className="spacer" />
            <div className="toolbar-pg">
              <span className="info num">
                {rangeStart}–{rangeEnd} / {total.toLocaleString()}건
              </span>
              <div className="pages">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
                {pageButtons.map((p) => (
                  <button key={p} className={clsx('num', p === page && 'on')} onClick={() => setPage(p)}>
                    {p + 1}
                  </button>
                ))}
                <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
              </div>
            </div>
          </div>

          {state === 'loading' && <p className="page-sub">불러오는 중…</p>}
          {state === 'error' && (
            <p className="page-sub">발송 내역을 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>
          )}
          {state === 'done' && rows.length === 0 && (
            <p className="page-sub">
              {pending
                ? '아직 발송 전이에요. 19:00 에 배치가 돌면 여기에 쌓여요.'
                : status === 'all'
                  ? '이 날짜에는 발송 기록이 없어요.'
                  : `${STATUS_LABEL[status]} 건이 없어요.`}
            </p>
          )}

          {state === 'done' && rows.length > 0 && (
            <div className="table-wrap">
              <table className="alimtalk-table">
                <thead>
                  <tr>
                    <th style={{ width: 72 }}>ID</th>
                    <th style={{ width: 132 }}>회원</th>
                    <th style={{ width: 108, textAlign: 'center' }}>채널</th>
                    <th style={{ width: 108, textAlign: 'center' }}>상태</th>
                    <th>실패 사유</th>
                    <th style={{ width: 92, textAlign: 'right' }}>발송 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="num" style={{ color: 'var(--color-muted)' }}>{r.id}</td>
                      <td className="member">
                        <div className="name">{r.userName ?? `#${r.userId}`}</div>
                        <span className="sub num">{formatPhone(r.phoneNumber)}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge neutral">{CAMPAIGN_LABEL[r.campaign] ?? r.campaign}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span>
                      </td>
                      <td className={clsx('reason', !r.failReason && 'none')} title={r.failReason ?? undefined}>
                        {r.failReason ? humanizeReason(r.failReason) : '—'}
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>{formatTime(r.sentAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 최근 14일 — 행을 누르면 그 날짜 내역으로 */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-fg)', marginBottom: 12 }}>최근 14일</div>
          <table className="alimtalk-daily">
            <thead>
              <tr>
                <th>날짜</th>
                <th style={{ textAlign: 'right' }}>성공</th>
                <th style={{ textAlign: 'right' }}>실패</th>
                <th style={{ textAlign: 'right' }}>성공률</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => {
                const { md, wd } = formatDay(d.date)
                const dTotal = d.sent + d.failed
                const dPending = d.date === today && dTotal === 0 && nowHour < BATCH_HOUR
                return (
                  <tr
                    key={d.date}
                    className={clsx(d.date === date && 'on')}
                    onClick={() => selectDate(d.date)}
                  >
                    <td className={clsx('day num', d.date === today && 'today')}>
                      {md}
                      <span className="wd">{wd}</span>
                    </td>
                    {dPending ? (
                      <td colSpan={3} style={{ textAlign: 'right', color: 'var(--warn-text)', fontSize: 12, fontWeight: 600 }}>
                        19:00 예정{preview ? ` · ${preview.targetCount.toLocaleString()}명` : ''}
                      </td>
                    ) : (
                      <>
                        <td className={clsx('num', d.sent === 0 && 'zero')} style={{ textAlign: 'right' }}>
                          {d.sent.toLocaleString()}
                        </td>
                        <td className={clsx('num', d.failed === 0 ? 'zero' : 'fail')} style={{ textAlign: 'right' }}>
                          {d.failed.toLocaleString()}
                        </td>
                        <td className={clsx('num', dTotal === 0 && 'zero')} style={{ textAlign: 'right' }}>
                          {pctOf(d.sent, dTotal)}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              {daily.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-muted)' }}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

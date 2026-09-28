import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { GRADE_LABEL, type Grade } from '@/user/api/authApi'
import {
  fetchRetentionUsers,
  type AdminUserStatus,
  type AdminUserType,
  type RetentionMetric,
  type RetentionUserRow,
  type UserRole,
} from '../api/adminApi'

/** 어느 셀을 눌렀는지 — 지표 + 날짜(+ 경과일). date = null 이면 합계 행(코호트) 이나 오늘 기준 KPI */
export interface RetentionCell {
  metric: RetentionMetric
  date: string | null
  offset?: number | null
  /** 표에 찍혀 있던 숫자 — 목록 건수와 맞는지 눈으로 대조할 수 있게 함께 보여준다 */
  expected?: number | null
  days: number
}

const TYPE_LABEL: Record<AdminUserType, string> = { USER: '회원', GUEST: '게스트' }
const TYPE_BADGE: Record<AdminUserType, string> = { USER: 'badge live', GUEST: 'badge neutral' }
const STATUS_LABEL: Record<AdminUserStatus, string> = {
  GUEST: '게스트', PENDING: '가입 중', ACTIVE: '활성', SUSPENDED: '정지', DELETED: '탈퇴 유예',
}
const STATUS_BADGE: Record<AdminUserStatus, string> = {
  GUEST: 'badge neutral', PENDING: 'badge pending', ACTIVE: 'badge live', SUSPENDED: 'badge danger', DELETED: 'badge hidden',
}
const ROLE_LABEL: Record<UserRole, string> = { USER: '유저', PAID_USER: '유료 회원', ADMIN: '관리자' }

const CLIENT_LABEL: Record<string, string> = { WEB: '웹', APP: '앱' }
const DEVICE_LABEL: Record<string, string> = {
  ANDROID_PHONE: '안드로이드 폰', ANDROID_TABLET: '안드로이드 패드',
  IOS_PHONE: '아이폰', IOS_TABLET: '아이패드', DESKTOP: 'PC', UNKNOWN: '미확인',
}

/** 셀 제목 — 표의 열 이름과 같은 말을 쓴다 */
const METRIC_TITLE: Record<RetentionMetric, string> = {
  SIGNUP_ALL: '가입 전체', STAFF: '관계자', DELETED: '탈퇴', PENDING: '가입 중', ACTIVE: 'ACTIVE',
  DAY0_SET: '가입 당일 완주', RETAINED: '리텐션',
  DAILY_LEARNER: '학습 유저 (DAU)', DAILY_NEW: '신규 학습', DAILY_RETURNING: '복귀 학습', DAILY_WAU: 'WAU',
  KPI_ACTIVE: 'ACTIVE 회원', KPI_STUDIED: '학습 1일 이상', KPI_RETURNED: '재방문 (학습 2일 이상)',
  KPI_STEADY: '이번 주 꾸준 (7일 중 3일+)', KPI_CHURNED: '이탈 중',
}

/** 판정 기준 한 줄 — "이 숫자가 무슨 조건인지" 를 화면에서 바로 읽을 수 있게 */
const METRIC_RULE: Record<RetentionMetric, string> = {
  SIGNUP_ALL: '정회원으로 가입한 전체 — 관계자·탈퇴·가입 중 포함',
  STAFF: '풀잇 관계자(팀원·테스트 계정) — 모든 집계에서 제외되는 사람',
  DELETED: '탈퇴 유예 상태',
  PENDING: '소셜 로그인만 하고 프로필을 못 끝낸 상태',
  ACTIVE: '가입 완료 · 관계자 아님 — 모든 비율의 분모',
  DAY0_SET: '가입 당일에 세트를 1개 이상 끝까지 푼 ACTIVE (진단 세트 포함)',
  RETAINED: '문제를 1개 이상 푼 ACTIVE — 크레딧 소모·세트 완주와 무관, 온보딩 맛보기 풀이는 제외',
  DAILY_LEARNER: '그날 문제를 1개 이상 푼 ACTIVE',
  DAILY_NEW: '그날 문제를 풀었고, 가입도 그날인 ACTIVE',
  DAILY_RETURNING: '그날 문제를 풀었고, 가입은 그 전인 ACTIVE',
  DAILY_WAU: '그날을 포함한 최근 7일 안에 하루라도 문제를 푼 ACTIVE',
  KPI_ACTIVE: '가입 완료 · 관계자 아님 (기간 무관 전체)',
  KPI_STUDIED: '학습일이 1일 이상인 ACTIVE',
  KPI_RETURNED: '학습일이 2일 이상인 ACTIVE',
  KPI_STEADY: '최근 7일 중 3일 이상 학습한 ACTIVE',
  KPI_CHURNED: '학습한 적은 있는데 최근 7일 학습이 0일인 ACTIVE',
}

const fmtDay = (iso: string | null | undefined) => (iso ? `${iso.slice(5, 7)}.${iso.slice(8, 10)}` : '—')
const fmtFull = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '—')
const gradeLabel = (g: string | null | undefined) => (g && g in GRADE_LABEL ? GRADE_LABEL[g as Grade] : '—')

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return phone
}

/** 웹/앱 + 기기 — 둘 다 없으면 "—" (구버전 가입자) */
function channel(client: string | null | undefined, device: string | null | undefined): string {
  const c = client ? CLIENT_LABEL[client] ?? client : null
  const d = device ? DEVICE_LABEL[device] ?? device : null
  return [c, d].filter(Boolean).join(' · ') || '—'
}

/** 게스트 출신 — 정회원이 된 시각이 계정 생성보다 늦으면 맛보기 게스트에서 승격한 사람 */
function fromGuest(createdAt: string, registeredAt: string | null | undefined): boolean {
  return !!registeredAt && registeredAt > createdAt
}

function headline(cell: RetentionCell): string {
  if (cell.metric === 'RETAINED') return `D${cell.offset ?? 0}`
  return METRIC_TITLE[cell.metric]
}

function subline(cell: RetentionCell): string {
  const rule = cell.metric === 'RETAINED'
    ? `가입일 + ${cell.offset ?? 0}일에 ${METRIC_RULE.RETAINED}`
    : METRIC_RULE[cell.metric]
  if (cell.date) {
    const when = cell.metric.startsWith('DAILY') ? `${fmtFull(cell.date)}` : `${fmtFull(cell.date)} 가입`
    return `${when} · ${rule}`
  }
  if (cell.metric.startsWith('KPI')) return `오늘 기준 · ${rule}`
  return `최근 ${cell.days}일 가입자 합계 · ${rule}`
}

/**
 * 리텐션 셀 드릴다운 팝업 (2026-09-28) — 표의 숫자 한 칸을 누르면 그 안에 든 회원을 그대로 펼친다.
 * 판정은 백엔드가 집계와 같은 조건으로 하고, 화면은 받은 목록을 회원 정보 + 학습 맥락으로 보여줄 뿐이다.
 */
export function RetentionUsersModal({ cell, onClose }: { cell: RetentionCell; onClose: () => void }) {
  const [rows, setRows] = useState<RetentionUserRow[] | null>(null)
  const [offsets, setOffsets] = useState<number[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setRows(null)
    setFailed(false)
    fetchRetentionUsers({ metric: cell.metric, date: cell.date, offset: cell.offset, days: cell.days })
      .then((res) => {
        if (!alive) return
        setRows(res.users)
        setOffsets(res.offsets)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [cell])

  // 표 위에 팝업이 떠 있는 동안 ESC 로 닫는다 (표가 넓어 닫기 버튼이 시야 밖일 수 있음)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cohort = !cell.metric.startsWith('DAILY') && !cell.metric.startsWith('KPI')

  return createPortal(
    <div className="rtu-dim" onClick={onClose}>
      <div role="dialog" aria-label={`${headline(cell)} 회원 목록`} className="rtu-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="rtu-head">
          <div className="rtu-head-text">
            <p className="card-title">
              {headline(cell)}
              <span className="rtu-count num">
                {rows ? `${rows.length.toLocaleString()}명` : '…'}
                {rows && cell.expected != null && rows.length !== cell.expected && (
                  <span className="rtu-mismatch"> (표 {cell.expected.toLocaleString()})</span>
                )}
              </span>
            </p>
            <p className="card-sub">{subline(cell)}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>닫기</button>
        </div>

        <div className="rtu-body">
          {failed && <p className="page-sub">회원 목록을 불러오지 못했습니다. 백엔드 연결을 확인하세요.</p>}
          {!failed && rows === null && <p className="page-sub">불러오는 중…</p>}
          {rows !== null && rows.length === 0 && <p className="page-sub">이 칸에 든 회원이 없습니다.</p>}
          {rows !== null && rows.length > 0 && (
            <div className="table-wrap">
              {/* 고정 레이아웃 — 배지 2개가 들어가는 칸은 80+80+간격+패딩 = 200px 이상. 합 1372 로 팝업(1440) 안에 들어간다 */}
              <table className="rtu-table" style={{ minWidth: 1372 }}>
                <thead>
                  <tr>
                    <th style={{ width: 160 }}>회원</th>
                    <th style={{ width: 200 }}>유형 · 상태</th>
                    <th style={{ width: 136 }}>학년 · 학교</th>
                    <th style={{ width: 180 }}>연락처</th>
                    <th style={{ width: 72, textAlign: 'right' }}>크레딧</th>
                    <th style={{ width: 124 }}>가입</th>
                    <th style={{ width: 152 }}>접속 (가입 · 최근)</th>
                    <th style={{ width: 112, textAlign: 'right' }}>학습일</th>
                    <th style={{ width: 236 }} title="가입일 기준 경과일 중 실제로 학습한 날">학습한 경과일</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ user: u, ...r }) => {
                    const type = (u.type ?? 'USER') as AdminUserType
                    const status = (u.status ?? 'ACTIVE') as AdminUserStatus
                    return (
                      <tr key={u.id}>
                        <td className="strong">
                          {u.name || u.nickname || '이름 없음'}
                          <span className="sub num">#{u.id}{u.nickname ? ` · ${u.nickname}` : ''}</span>
                        </td>
                        <td className="rtu-badges">
                          <span className={TYPE_BADGE[type]}>{TYPE_LABEL[type]}</span>
                          <span className={STATUS_BADGE[status]} style={{ marginLeft: 6 }}>{STATUS_LABEL[status]}</span>
                          <span className="sub">
                            {ROLE_LABEL[u.role] ?? u.role}{u.staff ? ' · 관계자' : ''}
                          </span>
                        </td>
                        <td>
                          {gradeLabel(u.grade)}
                          <span className="sub">{u.schoolName ?? (u.schoolNoneReason ? '학교 없음' : '미입력')}</span>
                        </td>
                        <td>
                          <span className="num">{formatPhone(u.phoneNumber)}</span>
                          <span className="sub">{u.email ?? '—'}</span>
                        </td>
                        <td className="num" style={{ textAlign: 'right' }}>{u.creditBalance ?? '—'}</td>
                        <td className="num">
                          {fmtFull(u.registeredAt ?? u.createdAt)}
                          <span className="sub">{fromGuest(u.createdAt, u.registeredAt) ? '게스트 출신' : '직가입'}</span>
                        </td>
                        <td>
                          {channel(u.signupClient, u.signupDevice)}
                          <span className="sub">
                            {channel(u.lastClient, u.lastDevice)}
                            {u.lastActiveAt ? ` · ${fmtDay(u.lastActiveAt)}` : ''}
                          </span>
                        </td>
                        <td className="num" style={{ textAlign: 'right' }}>
                          {r.studyDayCount.toLocaleString()}일
                          <span className="sub">
                            {r.studyDayCount > 0 ? `${fmtDay(r.firstStudyDate)} ~ ${fmtDay(r.lastStudyDate)}` : '학습 없음'}
                          </span>
                        </td>
                        <td>
                          <span className="rtu-hits">
                            {r.day0Done && <span className="rtu-hit rtu-hit-set" title="가입 당일 세트 완주">완주</span>}
                            {offsets.map((o) => (
                              <span
                                key={o}
                                className={r.hitOffsets.includes(o) ? 'rtu-hit on' : 'rtu-hit'}
                                title={`가입일 + ${o}일`}
                              >
                                D{o}
                              </span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rows !== null && rows.length > 0 && cohort && (
            <p className="retention-note">
              게스트 7일·탈퇴 30일 정리 배치가 지운 계정은 목록에 없습니다 — 오래된 코호트는 표의 숫자보다 적게 보일 수 있습니다.
            </p>
          )}
        </div>
      </div>
    </div>,
    // 토큰(--color-*)·다크모드가 .admin-root 스코프라 팝업도 그 안에 붙인다
    document.querySelector('.admin-root') ?? document.body,
  )
}

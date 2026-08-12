import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useMe } from '@/user/hooks/useMe'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useTasteStore, type Subject } from '@/user/stores/tasteStore'
import {
  computeCategoryProgress,
  EXTRA_SET_CREDIT_COST,
  selectRemainingSetsToday,
  useTrialProgressStore,
} from '@/user/stores/trialProgressStore'
import { findCategoryBySlug, UNIT_LABEL } from '@/user/data/curriculum'
import styles from './styles/UnlockProgressPage.module.scss'

/** 맛보기 세트 문항 수 — 정책 3문항 */
const SET_SIZE = 3

/**
 * 약점 그래프 잠금 해제 진행 페이지 (2026-08-12)
 *
 * 홈에서 대단원(영어는 능력)을 고르고 "내 약점 그래프 잠금 해제하기" 를 누르면 여기로 온다.
 * 유닛 카드 리스트 하나로 승부한다 — 카드 왼쪽 세로 레일이 진행 경로다.
 * 지나온 길(완료)은 primary 실선, 다음 풀 노드는 핑(파동), 남은 길은 회색 선.
 * 카드 자체는 번호·테두리 없이 상태만: 완료(기록·점수) / 다음(풀기) / 잠김(회색·자물쇠).
 *
 * 진행 규칙 (trialProgressStore 정책 주석 참고)
 *  - 유닛 1개 = 맛보기 3문제, 커리큘럼 순서대로만 열린다
 *  - 하루 1세트. 더 풀려면 크레딧으로 추가 세트를 연다
 *  - 카테고리 유닛을 전부 진단하면 약점 그래프가 열린다
 */
export default function UnlockProgressPage() {
  const navigate = useNavigate()
  const { subject: subjectParam, slug } = useParams<{ subject: Subject; slug: string }>()
  const subject: Subject = subjectParam === 'english' ? 'english' : 'math'
  const category = slug ? findCategoryBySlug(subject, slug) : undefined

  const { me } = useMe()
  const credit = me?.creditBalance ?? 0

  const diagnosed = useTrialProgressStore((s) => s.diagnosed)
  const syncDay = useTrialProgressStore((s) => s.syncDay)
  const startUnit = useTrialProgressStore((s) => s.startUnit)
  const buyExtraSet = useTrialProgressStore((s) => s.buyExtraSet)
  const setsLeft = useTrialProgressStore(selectRemainingSetsToday)

  const resetTaste = useTasteStore((s) => s.reset)
  const setLastSubject = useTasteStore((s) => s.setLastSubject)
  const setMathSkillNode = useTasteStore((s) => s.setMathSkillNode)
  const setEnglishType = useTasteStore((s) => s.setEnglishType)

  const [creditSheetOpen, setCreditSheetOpen] = useState(false)
  const creditDrag = useSheetDrag(() => setCreditSheetOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })


  // 자정을 넘겨 페이지를 계속 열어둔 경우까지 커버 (진입 시 1회 + 자정 시점 1회)
  useEffect(() => {
    syncDay()
    const timer = window.setTimeout(syncDay, msUntilMidnight())
    return () => clearTimeout(timer)
  }, [syncDay])

  // 잘못된 slug 로 들어오면 홈으로
  useEffect(() => {
    if (!category) navigate('/home', { replace: true })
  }, [category, navigate])

  const progress = useMemo(
    () => (category ? computeCategoryProgress(category, diagnosed) : null),
    [category, diagnosed],
  )

  const countdown = useMidnightCountdown()

  if (!category || !progress) return null

  const unitLabel = UNIT_LABEL[subject]
  const canStartToday = setsLeft > 0

  /** 다음 유닛 3문제 시작 — 맛보기 퀴즈 플로우를 그대로 태운다 */
  const startNextSet = () => {
    const next = progress.nextUnit
    if (!next || !canStartToday) return

    resetTaste()
    setLastSubject(subject)
    if (subject === 'math') setMathSkillNode(next.nodeId ?? 'sn-exp-log-01')
    else setEnglishType(next.nodeId ?? 'en-blank')

    startUnit({ unitName: next.name, returnTo: `/unlock/${subject}/${category.slug}` })
    navigate(`/taste/quiz/${subject}/0`)
  }

  /** 하단 진단 시작 CTA — 오늘 몫이 남았으면 바로 시작, 다 썼으면 크레딧 시트 */
  const onStartCta = () => {
    if (canStartToday) startNextSet()
    else setCreditSheetOpen(true)
  }

  const confirmBuyExtraSet = () => {
    buyExtraSet()
    setCreditSheetOpen(false)
  }

  return (
    <div className={styles.page}>
      <UserNav active="recommend" />

      <main className={styles.main}>
        <PageHeader backTo="history" right={<CreditBadge credit={credit} />} />

        <div className={styles.content}>
          {/* ── 타이틀 — 약점 그래프 공개까지 남은 개수 ─────────────────── */}
          <h1 className={styles.pageTitle}>
            {progress.unlocked ? (
              <>
                {category.name} 약점 그래프가
                <br />
                열렸어!
              </>
            ) : (
              <>
                {category.name} 약점 그래프 공개까지
                <br />
                {unitLabel} <span className={styles.pageTitleCount}>{progress.remaining}개</span>{' '}
                남았어
              </>
            )}
          </h1>

          {/* ── 유닛 리스트 — 카드 왼쪽 세로 라인이 진행 경로, 다음 노드가 핑 ── */}
          <section className={styles.listSection}>

            <ol className={styles.list}>
              {progress.rows.map((row, i) => {
                const isNext = row.state === 'next'
                // "지나온 길" 은 이어진 구간만 — 중간 유닛만 진단된 비정상 데이터가 와도
                // 잠긴 카드 쪽으로 primary 선이 뻗지 않게 양 끝 상태를 함께 본다
                const prevDone = i > 0 && progress.rows[i - 1].state === 'done'
                const nextRow = progress.rows[i + 1]
                const traveledTop = prevDone && row.state !== 'locked'
                const traveledBottom = row.state === 'done' && nextRow && nextRow.state !== 'locked'
                return (
                  <li key={row.name} className={styles.item}>
                    {/* 왼쪽 레일 — 위/아래 선 + 상태 점 */}
                    <span className={styles.rail} aria-hidden>
                      <span
                        className={clsx(
                          styles.railLine,
                          i === 0 && styles.railLineHidden,
                          traveledTop && styles.railLineDone,
                        )}
                      />
                      <span
                        className={clsx(
                          styles.dot,
                          row.state === 'done' && styles.dotDone,
                          isNext && styles.dotNext,
                        )}
                      >
                        {isNext && (
                          <>
                            <span className={styles.pulse} />
                            <span className={clsx(styles.pulse, styles.pulseLate)} />
                          </>
                        )}
                      </span>
                      <span
                        className={clsx(
                          styles.railLine,
                          i === progress.rows.length - 1 && styles.railLineHidden,
                          traveledBottom && styles.railLineDone,
                        )}
                      />
                    </span>

                    <div
                      className={clsx(
                        styles.row,
                        isNext && styles.rowNext,
                        row.state === 'locked' && styles.rowLocked,
                      )}
                    >
                      <span className={styles.rowBody}>
                        <span className={styles.rowName}>{row.name}</span>
                        {row.diagnosis && (
                          <span className={styles.rowMeta}>
                            {row.diagnosis.minutes}분 | 정답 {row.diagnosis.correct}문제
                          </span>
                        )}
                        {isNext && !canStartToday && (
                          <span className={styles.rowMeta}>{countdown} 뒤에 열려</span>
                        )}
                      </span>

                      {row.diagnosis ? (
                        <span
                          className={clsx(
                            styles.rowScore,
                            row.diagnosis.weak && styles.rowScoreWeak,
                          )}
                        >
                          {row.diagnosis.score}점
                        </span>
                      ) : isNext ? null : (
                        <span className={styles.rowLockIcon} aria-label="잠김">
                          <LockIcon />
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          {progress.unlocked && (
            <button
              type="button"
              // 보고 있던 과목·카테고리를 유지한 채 홈 그래프로
              onClick={() =>
                navigate(
                  `/home?${new URLSearchParams(
                    subject === 'math'
                      ? { cat: category.slug }
                      : { subject, cat: category.slug },
                  )}`,
                )
              }
              className={styles.primaryCta}
            >
              약점 그래프 보러가기
            </button>
          )}
        </div>

        {/* ── 하단 고정 진단 패널 (Figma 2647-13768) — 완주 전 항상 노출 ──── */}
        {!progress.unlocked && progress.nextUnit && (
          <section className={styles.dock}>
            <button type="button" onClick={onStartCta} className={styles.dockCta}>
              {SET_SIZE}문제로 진단 시작하기
            </button>

            {/* TODO: 스킵 정책 확정 전 — 동작 미연결 */}
            <button type="button" className={styles.dockSkip}>
              이 단원 아직 안배웠어요
            </button>
          </section>
        )}
      </main>

      {/* ── 크레딧 추가 세트 확인 시트 ─────────────────────────────────────── */}
      {creditSheetOpen && (
        <div className={styles.sheetDim} onClick={() => setCreditSheetOpen(false)}>
          <div
            {...creditDrag.sheetProps}
            className={clsx(styles.sheet, creditDrag.dragging && styles.sheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setCreditSheetOpen(false)}
              className={styles.sheetHandleWrap}
            >
              <span className={styles.sheetHandle} />
            </button>

            <h2 className={styles.sheetTitle}>지금 이어서 풀까?</h2>
            <p className={styles.sheetDesc}>
              크레딧 {EXTRA_SET_CREDIT_COST}개를 쓰면 다음 {unitLabel}(
              {progress.nextUnit?.name}) {SET_SIZE}문제를 바로 풀 수 있어
            </p>

            <div className={styles.sheetCard}>
              <span className={styles.sheetCardLabel}>보유 크레딧</span>
              <span className={styles.sheetCardValue}>
                {credit} → {Math.max(0, credit - EXTRA_SET_CREDIT_COST)}
              </span>
            </div>

            {credit < EXTRA_SET_CREDIT_COST ? (
              <p className={styles.sheetWarn}>크레딧이 부족해. 내일 무료 세트로 이어서 풀자</p>
            ) : null}

            <div className={styles.sheetActions}>
              <button
                type="button"
                onClick={() => setCreditSheetOpen(false)}
                className={styles.sheetCancel}
              >
                내일 할래
              </button>
              <button
                type="button"
                onClick={confirmBuyExtraSet}
                disabled={credit < EXTRA_SET_CREDIT_COST}
                className={styles.sheetConfirm}
              >
                크레딧 쓰기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 카피 · 시간 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

function msUntilMidnight(base: Date = new Date()): number {
  const midnight = new Date(base)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - base.getTime()
}

/** 자정까지 남은 시간 ("5시간 12분") — 1분마다 갱신 */
function useMidnightCountdown(): string {
  const [label, setLabel] = useState(() => formatRemain(msUntilMidnight()))

  useEffect(() => {
    const timer = window.setInterval(() => setLabel(formatRemain(msUntilMidnight())), 60_000)
    return () => clearInterval(timer)
  }, [])

  return label
}

function formatRemain(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/* --- 인라인 SVG 아이콘 --- */

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="6.5" rx="1.6" fill="currentColor" />
      <path
        d="M5.2 7V5.4a2.8 2.8 0 0 1 5.6 0V7"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  )
}

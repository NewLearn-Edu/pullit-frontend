import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { ProfileIcon } from '@/user/components/icons/NavIcons'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { type Subject } from '@/user/stores/trialStore'
import { useMe } from '@/user/hooks/useMe'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useUserStore } from '@/user/stores/userStore'
import { useSolveStore } from '@/user/stores/solveStore'
import { loadQuizProblems } from '@/user/services/problemSet'
import {
  computeCategoryProgress,
  selectRemainingSetsToday,
  useTrialProgressStore,
  type UnitProgressRow,
} from '@/user/stores/trialProgressStore'
import { CURRICULUM, UNIT_LABEL } from '@/user/data/curriculum'
import { formatShort, GradeMark } from '@/user/pages/trial/WeaknessResultPage'
import ProgressRadar from '@/user/components/WeaknessRadar/ProgressRadar'
import graphExample from '@/assets/home/graph-example.png'
import styles from './styles/HomePage.module.scss'

/** 맛보기 세트 문항 수 — 정책 3문항 */
const SET_SIZE = 3

/**
 * 메인 홈 (Figma PI-PAGE-04 · 2431-17022 · 2026-08-07 개편)
 * 약점 그래프(잠금 레이더 차트) + 대분류 칩 + 소단원 리스트.
 * 모바일 시안 기준 — 데스크탑은 사이드바 유지 + 콘텐츠 620px 중앙 정렬.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const diagnosed = useTrialProgressStore((s) => s.diagnosed)
  const syncDay = useTrialProgressStore((s) => s.syncDay)
  const hydrateFromServer = useTrialProgressStore((s) => s.hydrateFromServer)
  const setsLeftToday = useTrialProgressStore(selectRemainingSetsToday)
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const credit = me?.creditBalance ?? 0

  // 소단원 진행 상태의 진실원은 서버(trial_diagnoses) — 세션 확보 후 동기화
  useEffect(() => {
    if (sessionStatus === 'ready') hydrateFromServer()
  }, [sessionStatus, hydrateFromServer])

  // 홈은 세션(게스트·회원)이 있어야 하는 페이지 — 조회를 마쳤는데 아무 세션도 없으면 로그인으로
  useEffect(() => {
    if (sessionStatus === 'anonymous') navigate('/login', {
        replace: true,
        // 로그인 후 이 페이지로 복귀 (LoginPage 가 postLoginRedirect 로 저장)
        state: { from: window.location.pathname + window.location.search },
      })
  }, [sessionStatus, navigate])

  // 프로필 미완성 회원은 추가 정보 입력부터 (연령 게이트 — 생년월일·전화번호·약관)
  useEffect(() => {
    if (me?.type === 'USER' && (!me.phoneNumber || !me.birthDate)) {
      navigate('/signup/info', { replace: true })
    }
  }, [me, navigate])

  // 맛보기 완주 게이트는 회원 영역 공용 가드(RequireTrialDone, App.tsx)가 담당

  // 과목 탭·대분류 칩은 URL 쿼리가 진실원 — 언락 등에서 뒤로가기로 돌아와도 상태가 복원된다
  const [searchParams, setSearchParams] = useSearchParams()
  const subject: Subject = searchParams.get('subject') === 'english' ? 'english' : 'math'
  const catSlug = searchParams.get('cat') ?? CURRICULUM[subject][0].slug

  const [infoOpen, setInfoOpen] = useState(false) // 약점 그래프 예시 안내 (? 버튼)
  // 인포 시트 아래로 스와이프 닫기 — 웹은 중앙 다이얼로그라 제스처 제외
  const infoDrag = useSheetDrag(() => setInfoOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  // 진단 완료 유닛 상세 시트 — 약점지도 노드 시트와 같은 구성 (통계 · 학습 경로 · CTA)
  const [unitSheet, setUnitSheet] = useState<UnitProgressRow | null>(null)
  const unitDrag = useSheetDrag(() => setUnitSheet(null), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  // 하루 세트 카운터는 자정에 리셋 — 홈 진입 때마다 날짜를 맞춘다
  useEffect(() => {
    syncDay()
  }, [syncDay])

  // replace — 탭/칩 전환이 히스토리 스택에 쌓이지 않게 (뒤로가기 한 번에 홈 이탈)
  const changeSubject = (s: Subject) => {
    setSearchParams(s === 'math' ? {} : { subject: s }, { replace: true })
  }
  const changeCat = (slug: string) => {
    const next: Record<string, string> = slug === CURRICULUM[subject][0].slug ? {} : { cat: slug }
    if (subject !== 'math') next.subject = subject
    setSearchParams(next, { replace: true })
  }

  const categories = CURRICULUM[subject]
  const category = categories.find((c) => c.slug === catSlug) ?? categories[0]
  const progress = computeCategoryProgress(category, diagnosed)
  const unitLabel = UNIT_LABEL[subject]
  const canStartToday = setsLeftToday > 0

  /** 잠금 해제 진행 페이지 — 어디까지 왔는지·오늘 뭘 하면 되는지를 여기서 본다 */
  const openUnlock = () => navigate(`/unlock/${subject}/${category.slug}`)

  /**
   * 약점 그래프 해제 (Figma 2842-8069 · 2026-08-20 개편) —
   * 이 대단원에서 하나라도 진단했으면 그래프 공개, 아니면 잠금 오버레이.
   */
  const hasAnyDiagnosis = progress.rows.some((r) => r.diagnosis)

  /** 대단원 완주 후 CTA 용 — 이 카테고리에서 가장 약한 유닛 */
  const weakestInCategory = progress.unlocked
    ? progress.rows.reduce((a, b) =>
        (b.diagnosis?.score ?? 101) < (a.diagnosis?.score ?? 101) ? b : a,
      )
    : null

  /**
   * 자유 풀이 (2026-08-13 정책) — 대단원 진단을 모두 마쳐야(unlocked) 열린다.
   * 열려 있으면 해당 유닛 문제로 FREE 세션을 만들어 /solve 로 진입.
   */
  const startSolveSession = useSolveStore((s) => s.startSession)
  const startFreeSolve = async (row: UnitProgressRow) => {
    const problems = await loadQuizProblems(
      subject,
      row.nodeId ?? (subject === 'math' ? 'sn-exp-log-01' : 'en-blank'),
    )
    if (problems.length === 0) return
    startSolveSession({
      problems,
      source: 'FREE',
      returnTo: `/home${window.location.search}`,
    })
    navigate(`/solve/${subject}/0`)
  }

  /** 유닛 시트의 학습 경로 — 커리큘럼 순서 기준 이전 → 현재 → 다음 (약점지도와 동일) */
  const sheetIdx = unitSheet ? progress.rows.findIndex((r) => r.name === unitSheet.name) : -1
  const sheetPath =
    unitSheet && sheetIdx >= 0
      ? [progress.rows[sheetIdx - 1], progress.rows[sheetIdx], progress.rows[sheetIdx + 1]]
          .filter((r): r is UnitProgressRow => !!r)
          .map((r) => ({ name: r.name, state: r.state, current: r.name === unitSheet.name }))
      : []


  return (
    <div className={styles.page}>
      <UserNav active="recommend" />

      <main className={styles.main}>
        {/* 상단 헤더 — 크레딧 · 과목 토글 · 오답노트/마이 */}
        <PageHeader
          left={<CreditBadge credit={credit} />}
          center={<SubjectTabs pill value={subject} onChange={changeSubject} />}
          hideRightOnDesktop
          right={
            <>
              <button
                type="button"
                aria-label="오답노트"
                onClick={() => navigate('/wrong-note')}
                className={styles.iconCircle}
              >
                <WrongNoteIcon />
              </button>
              <button
                type="button"
                aria-label="마이페이지"
                onClick={() => navigate('/my')}
                className={styles.iconCircle}
              >
                <ProfileIcon size={18} />
              </button>
            </>
          }
        />

        <div className={styles.content}>
          <h1 className={styles.title}>약점 그래프</h1>

          {/* 대분류 칩 */}
          <div className={styles.chips}>
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => changeCat(c.slug)}
                className={clsx(styles.chip, category.slug === c.slug && styles.chipActive)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* 약점 그래프 카드 (Figma 2919-8728) — 흰 카드 안 레이더.
              이 대단원에서 하나도 진단 전이면 다크 잠금 오버레이 (2842-8069) */}
          <div className={styles.graphShell}>
            <ProgressRadar
              key={`${subject}:${category.slug}`} // 탭·카테고리 전환 시 리마운트 — 진입 애니메이션 재생
              units={progress.rows.map((u) => ({
                name: u.name,
                score: u.diagnosis?.score, // undefined = 미진단 (점선 슬롯 + 미진단 라벨)
              }))}
              className={styles.graphSvg}
            />

            {hasAnyDiagnosis ? (
              // 열린 그래프 — ? 안내 버튼만 우상단에
              <button
                type="button"
                aria-label="약점 그래프 안내"
                onClick={() => setInfoOpen(true)}
                className={styles.helpChip}
              >
                ?
              </button>
            ) : (
              <div className={styles.graphOverlay}>
                <button
                  type="button"
                  aria-label="약점 그래프 안내"
                  onClick={() => setInfoOpen(true)}
                  className={clsx(styles.helpChip, styles.helpChipOverlay)}
                >
                  ?
                </button>
                <div className={styles.graphOverlayBody}>
                  <LockKeyholeIcon />
                  <p className={styles.graphOverlayTitle}>약점 그래프 잠김</p>
                  <p className={styles.graphOverlayDesc}>
                    {unitLabel} 한 개만 진단하면 바로 열려
                  </p>
                </div>
                <button type="button" onClick={openUnlock} className={styles.unlockButton}>
                  약점 진단하기
                </button>
              </div>
            )}
          </div>

          {/* 소단원(수학) / 유형(영어) 카드 리스트 (Figma subject-card 3종) */}
          <section className={styles.subSection}>
            <h2 className={styles.subTitle}>{unitLabel}</h2>

            <ol className={styles.unitCards}>
              {progress.rows.map((row) => {
                if (row.diagnosis) {
                  // 진단 완료 — 흰 카드 · 메타 · 점수 + 셰브런 (상세 시트)
                  const total = row.diagnosis.items?.length ?? SET_SIZE
                  return (
                    <li key={row.name}>
                      <button
                        type="button"
                        onClick={() => setUnitSheet(row)}
                        className={clsx(styles.unitCard, styles.unitCardDone)}
                      >
                        <span className={styles.unitCardBody}>
                          <span className={styles.unitCardNameRow}>
                            <span className={styles.unitCardName}>{row.name}</span>
                            {row.diagnosis.weak && (
                              <span className={styles.unitWeakPill}>약점</span>
                            )}
                          </span>
                          <span className={styles.unitCardMeta}>
                            <CheckCircleIcon />
                            정답 {row.diagnosis.correct}/{total}개
                            <span className={styles.unitMetaDivider} />
                            <ClockIcon />
                            {row.diagnosis.minutes}분
                          </span>
                        </span>
                        <span
                          className={clsx(
                            styles.unitCardScore,
                            row.diagnosis.weak && styles.unitCardScoreWeak,
                          )}
                        >
                          {row.diagnosis.score}점
                        </span>
                        <span className={styles.unitCardChevron} aria-hidden>
                          <ChevronIcon />
                        </span>
                      </button>
                    </li>
                  )
                }
                if (row.state === 'next') {
                  // 다음 차례 — 흰 카드 + 빨간 보더 + 진단하기 버튼
                  return (
                    <li key={row.name}>
                      <div className={clsx(styles.unitCard, styles.unitCardNext)}>
                        <span className={styles.unitCardName}>{row.name}</span>
                        <button
                          type="button"
                          disabled={!canStartToday}
                          onClick={openUnlock}
                          className={styles.unitDiagnoseBtn}
                        >
                          {canStartToday ? '진단하기' : '내일 열려'}
                        </button>
                      </div>
                    </li>
                  )
                }
                // 잠김 — 회색 카드 + 자물쇠
                return (
                  <li key={row.name}>
                    <div className={clsx(styles.unitCard, styles.unitCardLocked)}>
                      <span className={styles.unitCardNameLocked}>{row.name}</span>
                      <span className={styles.unitLockIcon} aria-label="잠김">
                        <LockIcon />
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        {/* 홈 단일 CTA — 다크 시트 (Figma) · 선택한 대단원 기준 */}
        <div className={styles.solveDock}>
          {!progress.unlocked ? (
            <button
              type="button"
              className={styles.solveDockCta}
              disabled={!canStartToday}
              onClick={openUnlock}
            >
              {canStartToday ? `${category.name} 약점 진단하기` : '오늘 진단은 끝 — 내일 열려'}
            </button>
          ) : (
            <button
              type="button"
              className={styles.solveDockCta}
              onClick={() => weakestInCategory && startFreeSolve(weakestInCategory)}
            >
              약점 문제 풀기
            </button>
          )}
        </div>
      </main>

      {/* 약점 그래프 예시 안내 (Figma 2504-22065) — ? 버튼 시트 */}
      {infoOpen && (
        <div className={styles.infoDim} onClick={() => setInfoOpen(false)}>
          <div
            {...infoDrag.sheetProps}
            className={clsx(styles.infoSheet, infoDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setInfoOpen(false)}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            <h2 className={styles.infoTitle}>약점 그래프 예시</h2>
            <p className={styles.infoDesc}>
              여기까지만 하면, 다음부턴 풀잇이 알아서 해.
              <br />네 약점에 딱 맞는 {SET_SIZE}문제를 매일 아침 준비해둘게
            </p>
            <div className={styles.infoCard}>
              <img src={graphExample} alt="약점 그래프 예시" className={styles.infoImage} />
            </div>
            <button type="button" onClick={() => setInfoOpen(false)} className={styles.infoClose}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 진단 완료 유닛 상세 — 약점지도 노드 시트와 동일: 웹 우측 패널 · 모바일 바텀시트 */}
      {unitSheet?.diagnosis && (
        <div className={styles.unitDim} onClick={() => setUnitSheet(null)}>
          <div
            {...unitDrag.sheetProps}
            className={clsx(styles.unitSheet, unitDrag.dragging && styles.infoSheetDragging)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setUnitSheet(null)}
              className={styles.infoHandleWrap}
            >
              <span className={styles.infoHandle} />
            </button>
            {/* 웹(우측 패널) 전용 닫기 버튼 — 모바일은 핸들·스와이프로 닫음 */}
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setUnitSheet(null)}
              className={styles.unitClose}
            >
              ×
            </button>

            <div className={styles.unitTitleRow}>
              <h2 className={styles.unitTitle}>{unitSheet.name}</h2>
              {unitSheet.diagnosis.weak && <span className={styles.unitBadgeWeak}>약점</span>}
            </div>

            <div className={styles.unitStats}>
              <div className={styles.unitStat}>
                <span className={styles.unitStatLabel}>푼 문제</span>
                <span className={styles.unitStatValue}>
                  {unitSheet.diagnosis.items?.length ?? SET_SIZE}문제
                </span>
              </div>
              <div className={styles.unitStat}>
                <span className={styles.unitStatLabel}>점수</span>
                <span className={styles.unitStatValue}>{unitSheet.diagnosis.score}점</span>
              </div>
              <div className={clsx(styles.unitStat, styles.unitStatLast)}>
                <span className={styles.unitStatLabel}>공부 시간</span>
                <span className={styles.unitStatValue}>
                  {Math.floor(unitSheet.diagnosis.minutes / 60)}시간{' '}
                  {unitSheet.diagnosis.minutes % 60}분
                </span>
              </div>
            </div>

            {sheetPath.length > 0 && (
              <>
                <h3 className={styles.unitSection}>학습 경로</h3>
                <div className={styles.unitPathBox}>
                  {sheetPath.map((p, i) => (
                    <div key={p.name} className={styles.unitPathItem}>
                      {i > 0 && <span className={styles.unitPathLine} />}
                      <span
                        className={clsx(
                          styles.unitPathRow,
                          !p.current && p.state === 'locked' && styles.unitPathRowLocked,
                        )}
                      >
                        <i
                          className={clsx(
                            styles.unitPathDot,
                            p.current && styles.unitPathDotCurrent,
                            !p.current && p.state !== 'locked' && styles.unitPathDotDone,
                          )}
                        />
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 문항별 결과 — 진단 결과 페이지와 같은 표 (박제된 진단분에만 존재) */}
            {unitSheet.diagnosis.items && unitSheet.diagnosis.items.length > 0 ? (
              <>
                <h3 className={styles.unitSection}>문항별 결과</h3>
                <div className="flex w-full flex-col overflow-hidden rounded-[12px] border border-[#f0f1f3]">
                  <div className="flex w-full items-center bg-[#f8f8f8]">
                    {['문항', '답안', '풀이 시간', '점수'].map((label) => (
                      <div key={label} className="flex flex-1 items-center justify-center p-md">
                        <p className="whitespace-nowrap text-[13px] text-[#80858b]">{label}</p>
                      </div>
                    ))}
                  </div>

                  {unitSheet.diagnosis.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex min-h-[68px] w-full items-center border-t border-[#f0f1f3] py-md"
                    >
                      <div className="relative flex min-w-0 flex-1 items-center justify-center self-stretch px-sm">
                        <p className="whitespace-nowrap text-[15px] font-bold text-[#121417]">
                          {i + 1}번
                        </p>
                        <GradeMark
                          kind={item.correct ? (item.overTime ? 'triangle' : 'circle') : 'slash'}
                          delayMs={150 + i * 200}
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                        <p className="whitespace-nowrap text-[15px] font-medium text-[#121417]">
                          {item.short ? (
                            item.myAnswer
                          ) : (
                            <span className="text-[19px] leading-none">{item.myAnswer}</span>
                          )}
                        </p>
                        {!item.correct && (
                          <p className="flex items-center gap-[4px] whitespace-nowrap text-[14px] font-medium text-primary">
                            정답
                            {item.short ? (
                              <span className="font-semibold">{item.correctAnswer}</span>
                            ) : (
                              <span className="text-[19px] leading-none">{item.correctAnswer}</span>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                        <p className="whitespace-nowrap text-[14px] font-semibold tabular-nums text-[#121417]">
                          {formatShort(item.seconds)}
                        </p>
                        {item.overTime && (
                          <p className="whitespace-nowrap text-[13px] font-medium tabular-nums text-primary">
                            권장 {formatShort(item.recSec)}
                          </p>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-sm">
                        <p className="whitespace-nowrap text-[14px] font-bold tabular-nums text-[#121417]">
                          {Number.isInteger(item.earned) ? item.earned : item.earned.toFixed(1)}점
                        </p>
                        {item.earned < item.points && (
                          <p className="whitespace-nowrap text-[12px] tabular-nums text-[#a6abb1]">
                            배점 {item.points}점
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[#a6abb1]">
                이 진단은 문항별 기록이 저장되기 전에 진행돼서 요약만 볼 수 있어
              </p>
            )}

            {/* 자유 풀이 CTA (2026-08-17 정책) — 이 소단원의 맛보기 진단을
                마쳤으면 바로 풀 수 있다 (시트는 진단 완료 유닛에서만 열린다) */}
            <button
              type="button"
              onClick={() => {
                setUnitSheet(null)
                startFreeSolve(unitSheet)
              }}
              className={styles.unitButton}
            >
              문제 풀기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* --- 인라인 SVG 아이콘 (소단원 카드 메타 · Figma subject-card) --- */

/** 잠금 오버레이 자물쇠 (Figma lock-keyhole 80px) — 회색 고리 + 몸통 + 열쇠구멍 */
function LockKeyholeIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
      <path
        d="M25 41V30.5C25 22.4 31.7 16 40 16s15 6.4 15 14.5V41"
        stroke="#d6d8db"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="18" y="35" width="44" height="30" rx="6" fill="#80858b" />
      <circle cx="40" cy="46.5" r="4" fill="#f0f1f3" />
      <rect x="38" y="48" width="4" height="8.5" rx="2" fill="#f0f1f3" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.2 8.2 7.2 10.2 10.8 6.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.8V8.2L10.2 9.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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




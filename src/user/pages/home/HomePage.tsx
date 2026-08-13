import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { ProfileIcon } from '@/user/components/icons/NavIcons'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
import { UnitRailList } from '@/user/components/UnitRailList'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { type Subject } from '@/user/stores/tasteStore'
import { useMe } from '@/user/hooks/useMe'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useUserStore } from '@/user/stores/userStore'
import {
  computeCategoryProgress,
  selectRemainingSetsToday,
  useTrialProgressStore,
  type UnitProgressRow,
} from '@/user/stores/trialProgressStore'
import { CURRICULUM, UNIT_LABEL } from '@/user/data/curriculum'
import { formatShort, GradeMark } from '@/user/pages/taste/WeaknessResultPage'
import graphLock from '@/assets/home/graph-lock.png'
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
  const setsLeftToday = useTrialProgressStore(selectRemainingSetsToday)
  const { me } = useMe()
  const sessionStatus = useUserStore((s) => s.status)
  const credit = me?.creditBalance ?? 0

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

          {/* 약점 그래프 카드 — 카테고리 유닛을 전부 진단해야 잠금이 풀린다 */}
          <div className={styles.graphCard}>
            <RadarChart
              units={progress.rows.map((u) => ({
                name: u.name,
                score: u.diagnosis?.score,
                weak: u.diagnosis?.weak,
              }))}
            />
            {!progress.unlocked && (
              <div className={styles.graphOverlay}>
                <button
                  type="button"
                  aria-label="약점 그래프 안내"
                  onClick={() => setInfoOpen(true)}
                  className={styles.helpChip}
                >
                  ?
                </button>
                <div className={styles.graphOverlayBody}>
                  <img src={graphLock} alt="" className={styles.lockImage} />
                  <p className={styles.graphOverlayTitle}>{category.name} 약점 그래프</p>
                  <p className={styles.graphOverlayDesc}>
                    {progress.remaining === 1
                      ? `${unitLabel} 딱 하나 남았어. ${SET_SIZE}문제면 그래프가 열려`
                      : `${unitLabel} ${progress.remaining}개만 더 풀면 그래프 열어줄게`}
                  </p>
                </div>
                <button type="button" onClick={openUnlock} className={styles.unlockButton}>
                  내 약점 그래프 잠금 해제하기
                </button>
              </div>
            )}
          </div>

          {/* 소단원(수학) / 유형(영어) 리스트 — 헤드라인 + 레일 리스트 */}
          <section className={styles.subSection}>
            {/* 회의 피드백(2026-08-13) — "소단원" 라벨 대신 남은 개수가 보이는 헤드라인 */}
            <h2 className={styles.subTitle}>
              {progress.unlocked ? (
                <>{category.name} 약점 그래프가 열렸어!</>
              ) : (
                <>
                  {category.name} 약점 그래프 공개까지
                  <br />
                  {unitLabel}{' '}
                  <span className={styles.subTitleCount}>{progress.remaining}개</span> 남았어
                </>
              )}
            </h2>
            <UnitRailList
              rows={progress.rows}
              nextMeta={canStartToday ? '오늘 풀 차례' : '내일 열려'}
              onDoneClick={setUnitSheet}
            />
          </section>
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
          </div>
        </div>
      )}
    </div>
  )
}

/** 잠금 상태 실루엣용 목 점수 — 진단 전에는 오버레이 뒤에 흐리게 깔린다 */
const LOCKED_SILHOUETTE = [72, 50, 62, 40, 55, 45, 60]

/**
 * 약점 레이더 차트 (n각형 링 + 축 라벨).
 * scores 가 있으면 실제 진단 점수로 그리고, 없는 축(미진단)은 실루엣 값으로 채운다.
 * 약점(70점 미만) 꼭짓점은 점을 찍어 어디를 잡아야 하는지 바로 보이게 한다.
 */
function RadarChart({
  units,
}: {
  units: { name: string; score?: number; weak?: boolean }[]
}) {
  const labels = units.map((u) => u.name)
  const n = Math.max(labels.length, 3)
  const cx = 150
  const cy = 150
  const maxR = 95
  const rings = [0.25, 0.5, 0.75, 1]

  const point = (i: number, r: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }
  const polygon = (r: number) =>
    Array.from({ length: n }, (_, i) => point(i, r).join(',')).join(' ')

  const ratio = (i: number) => {
    const score = units[i]?.score
    return (score ?? LOCKED_SILHOUETTE[i % LOCKED_SILHOUETTE.length] ?? 50) / 100
  }
  const dataPoints = Array.from({ length: n }, (_, i) =>
    point(i, maxR * ratio(i)).join(','),
  ).join(' ')

  return (
    <svg viewBox="0 0 300 300" className={styles.radar} aria-hidden>
      {rings.map((f) => (
        <polygon key={f} points={polygon(maxR * f)} fill="none" stroke="#d6d8db" strokeWidth="1" />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = point(i, maxR)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#d6d8db" strokeWidth="1" />
      })}
      <polygon points={dataPoints} fill="rgba(255,56,92,0.25)" stroke="#ff385c" strokeWidth="1.5" />
      {units.map((u, i) => {
        if (!u.weak) return null
        const [x, y] = point(i, maxR * ratio(i))
        return <circle key={`dot-${u.name}`} cx={x} cy={y} r="3.5" fill="#ff385c" />
      })}
      {labels.map((label, i) => {
        const [x, y] = point(i, maxR + 14)
        const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'
        return (
          <text key={label} x={x} y={y} textAnchor={anchor} fontSize="9" fontWeight="700" fill="#766f73">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

/* --- 인라인 SVG 아이콘 --- */




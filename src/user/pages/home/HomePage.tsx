import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { ProfileIcon } from '@/user/components/icons/NavIcons'
import { UserNav } from '@/user/components/UserNav'
import { PageHeader } from '@/user/components/PageHeader'
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
} from '@/user/stores/trialProgressStore'
import { CURRICULUM, UNIT_LABEL } from '@/user/data/curriculum'
import graphLock from '@/assets/home/graph-lock.png'
import graphExample from '@/assets/home/graph-example.png'
import rowLock from '@/assets/home/row-lock.svg'
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
    if (sessionStatus === 'anonymous') navigate('/login', { replace: true })
  }, [sessionStatus, navigate])

  // 프로필 미완성 회원은 추가 정보 입력부터 (연령 게이트 — 생년월일·전화번호·약관)
  useEffect(() => {
    if (me?.type === 'USER' && (!me.phoneNumber || !me.birthDate)) {
      navigate('/signup/info', { replace: true })
    }
  }, [me, navigate])

  const [subject, setSubject] = useState<Subject>('math')
  const [catSlug, setCatSlug] = useState(CURRICULUM.math[0].slug)
  const [infoOpen, setInfoOpen] = useState(false) // 약점 그래프 예시 안내 (? 버튼)
  // 인포 시트 아래로 스와이프 닫기 — 웹은 중앙 다이얼로그라 제스처 제외
  const infoDrag = useSheetDrag(() => setInfoOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  // 하루 세트 카운터는 자정에 리셋 — 홈 진입 때마다 날짜를 맞춘다
  useEffect(() => {
    syncDay()
  }, [syncDay])

  const changeSubject = (s: Subject) => {
    setSubject(s)
    setCatSlug(CURRICULUM[s][0].slug)
  }

  const categories = CURRICULUM[subject]
  const category = categories.find((c) => c.slug === catSlug) ?? categories[0]
  const progress = computeCategoryProgress(category, diagnosed)
  const unitLabel = UNIT_LABEL[subject]
  const canStartToday = setsLeftToday > 0

  /** 잠금 해제 진행 페이지 — 어디까지 왔는지·오늘 뭘 하면 되는지를 여기서 본다 */
  const openUnlock = () => navigate(`/unlock/${subject}/${category.slug}`)


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
                onClick={() => setCatSlug(c.slug)}
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

          {/* 소단원(수학) / 유형(영어) 리스트 — 진단완료·풀기·잠금 3단계 (Figma 2605-5698) */}
          <section className={styles.subSection}>
            <div className={styles.subHead}>
              <h2 className={styles.subTitle}>{unitLabel}</h2>
            </div>
            <div className={styles.subList}>
              {/* 순서대로 진행 — 진단 안 된 첫 항목만 풀 수 있고 나머지는 잠김 */}
              {progress.rows.map((u) => {
                if (u.diagnosis) {
                  return (
                    <div key={u.name} className={clsx(styles.subRow, styles.subRowStatic)}>
                      <span className={styles.subBody}>
                        <span className={styles.subName}>{u.name}</span>
                        <span className={styles.subMeta}>
                          {u.diagnosis.minutes}분 | 정답 {u.diagnosis.correct}문제
                        </span>
                      </span>
                      <span className={clsx(styles.score, u.diagnosis.weak && styles.scoreWeak)}>
                        {u.diagnosis.score}점
                      </span>
                    </div>
                  )
                }
                if (u.state === 'next') {
                  // 홈 리스트는 표시 전용 — 풀이 진입은 그래프 카드의 잠금 해제 CTA 로만
                  return (
                    <div
                      key={u.name}
                      className={clsx(styles.subRow, styles.subRowStatic, styles.subRowNext)}
                    >
                      <span className={styles.subBody}>
                        <span className={styles.subName}>{u.name}</span>
                        <span className={styles.subMeta}>
                          {canStartToday ? '오늘 풀 차례' : '내일 열려'}
                        </span>
                      </span>
                    </div>
                  )
                }
                return (
                  <div key={u.name} className={clsx(styles.subRow, styles.subRowLocked)}>
                    <span className={styles.subName}>{u.name}</span>
                    <img src={rowLock} alt="잠김" className={styles.rowLock} />
                  </div>
                )
              })}
            </div>
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



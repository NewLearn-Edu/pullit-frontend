import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { WrongNoteIcon } from '@/user/components/icons/WrongNoteIcon'
import { ProfileIcon } from '@/user/components/icons/NavIcons'
import { UserNav } from '@/user/components/UserNav'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useTasteStore, type Subject } from '@/user/stores/tasteStore'
import { useMe } from '@/user/hooks/useMe'
import { useSheetDrag } from '@/user/hooks/useSheetDrag'
import { useUserStore } from '@/user/stores/userStore'
import { ENGLISH_ABILITIES } from '@/user/data/englishAbilities'
import graphLock from '@/assets/home/graph-lock.png'
import graphExample from '@/assets/home/graph-example.png'
import rowLock from '@/assets/home/row-lock.svg'
import styles from './styles/HomePage.module.scss'

// ── POC 목 데이터 · 백엔드 연동 시 API 로 대체 ────────────────────────────────

/** 상단 칩 — 수학: 대분류 (2022 교육과정) · 영어: 독해 능력 4분류 */
const CATS: Record<Subject, string[]> = {
  math: ['대수', '미적분 I', '확률과 통계'],
  english: ENGLISH_ABILITIES.map((a) => a.name),
}

interface SubUnit {
  name: string
  /** 진단 완료 시 점수 보유 — 없으면 풀기 대기/잠금 */
  score?: number
  /** 약점 판정 — 점수를 빨간색으로 강조 */
  weak?: boolean
  /** 진단 완료 행의 메타 ("24분 | 정답 2문제") */
  minutes?: number
  correct?: number
}

/** 진단 점수 목 (칩 이름 → 소단원/유형별) — 진단 API 연동 시 이 상수만 교체 */
const MOCK_SCORES: Record<string, SubUnit[]> = {
  대수: [
    { name: '지수와 로그', score: 68, weak: true, minutes: 24, correct: 2 },
    { name: '지수함수와 로그함수' },
    { name: '삼각함수' },
    { name: '사인법칙과 코사인법칙' },
    { name: '등차수열과 등비수열' },
    { name: '수열의 합' },
    { name: '수학적 귀납법' },
  ],
  '미적분 I': [
    { name: '함수의 극한' },
    { name: '함수의 연속' },
    { name: '미분계수와 도함수' },
    { name: '도함수의 활용' },
  ],
  '확률과 통계': [
    { name: '경우의 수' },
    { name: '순열과 조합' },
    { name: '확률의 뜻과 활용' },
    { name: '조건부확률' },
  ],
  // 영어 4개 능력 — 유형 목록은 englishAbilities 단일 원천에서 파생
  ...Object.fromEntries(
    ENGLISH_ABILITIES.map((a) => [a.name, a.types.map((name) => ({ name }))]),
  ),
}
// 디자인 목값: 내용 파악의 주제만 진단 완료 (82점 · 약점 아님)
MOCK_SCORES['내용 파악'][0] = { name: '주제', score: 82, minutes: 18, correct: 3 }

/**
 * 메인 홈 (Figma PI-PAGE-04 · 2431-17022 · 2026-08-07 개편)
 * 약점 그래프(잠금 레이더 차트) + 대분류 칩 + 소단원 리스트.
 * 모바일 시안 기준 — 데스크탑은 사이드바 유지 + 콘텐츠 620px 중앙 정렬.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const reset = useTasteStore((s) => s.reset)
  const setLastSubject = useTasteStore((s) => s.setLastSubject)
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
  const [cat, setCat] = useState(CATS.math[0])
  const [infoOpen, setInfoOpen] = useState(false) // 약점 그래프 예시 안내 (? 버튼)
  // 인포 시트 아래로 스와이프 닫기 — 웹은 중앙 다이얼로그라 제스처 제외
  const infoDrag = useSheetDrag(() => setInfoOpen(false), {
    disabled: () => window.matchMedia('(min-width: 1281px)').matches,
  })

  const changeSubject = (s: Subject) => {
    setSubject(s)
    setCat(CATS[s][0])
  }

  // 잠금 해제 = 문제 풀이 · POC 는 맛보기 퀴즈 플로우로 진입
  const startQuiz = () => {
    reset()
    setLastSubject(subject)
    navigate(`/taste/quiz/${subject}/0`)
  }

  const subUnits = MOCK_SCORES[cat] ?? []

  return (
    <div className={styles.page}>
      <UserNav active="recommend" />

      <main className={styles.main}>
        {/* 상단 헤더 — 크레딧 · 과목 토글 · 오답노트/마이 */}
        <header className={styles.header}>
          <CreditBadge credit={credit} />
          <SubjectTabs pill value={subject} onChange={changeSubject} />
          <div className={styles.headerIcons}>
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
          </div>
        </header>

        <div className={styles.content}>
          <h1 className={styles.title}>약점 그래프</h1>

          {/* 대분류 칩 */}
          <div className={styles.chips}>
            {CATS[subject].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={clsx(styles.chip, cat === c && styles.chipActive)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* 약점 그래프 카드 — 진단 전에는 잠금 오버레이 */}
          <div className={styles.graphCard}>
            <RadarChart labels={subUnits.map((u) => u.name)} />
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
                <p className={styles.graphOverlayTitle}>{cat} 약점 그래프</p>
                <p className={styles.graphOverlayDesc}>딱 3문제만 더 풀면 약점 그래프 열어줄게</p>
              </div>
              <button type="button" onClick={startQuiz} className={styles.unlockButton}>
                내 약점 그래프 잠금 해제하기
              </button>
            </div>
          </div>

          {/* 소단원(수학) / 유형(영어) 리스트 — 진단완료·풀기·잠금 3단계 (Figma 2605-5698) */}
          <section className={styles.subSection}>
            <div className={styles.subHead}>
              <h2 className={styles.subTitle}>{subject === 'math' ? '소단원' : '유형'}</h2>
            </div>
            <div className={styles.subList}>
              {/* 순서대로 진행 — 진단 안 된 첫 항목만 풀 수 있고 나머지는 잠김 */}
              {subUnits.map((u, i) => {
                const firstUnsolved = subUnits.findIndex((x) => x.score == null)
                if (u.score != null) {
                  // 진단완료 행은 표시 전용 — 풀이 진입은 "풀기" 행에서만
                  return (
                    <div key={u.name} className={clsx(styles.subRow, styles.subRowStatic)}>
                      <span className={styles.subBody}>
                        <span className={styles.subName}>{u.name}</span>
                        {u.minutes != null && (
                          <span className={styles.subMeta}>
                            {u.minutes}분 | 정답 {u.correct}문제
                          </span>
                        )}
                      </span>
                      <span className={clsx(styles.score, u.weak && styles.scoreWeak)}>
                        {u.score}점
                      </span>
                    </div>
                  )
                }
                if (i === firstUnsolved) {
                  return (
                    <button key={u.name} type="button" onClick={startQuiz} className={styles.subRow}>
                      <span className={styles.subName}>{u.name}</span>
                      <span className={styles.solveChip}>풀기</span>
                    </button>
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
              소단원(유형)을 다 풀면 결과가 이렇게 보여,
              <br />
              빨간색으로 표시된 부분부터 먼저 잡으면 돼
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

/**
 * 잠금 상태 배경용 레이더 차트 (n각형 링 + 축 라벨).
 * 진단 데이터 연동 전 — 오버레이 뒤에 흐리게 깔리는 시각 요소.
 */
function RadarChart({ labels }: { labels: string[] }) {
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

  // 목 데이터 폴리곤 — 오버레이 뒤 흐릿한 실루엣용
  const dataR = [0.72, 0.5, 0.62, 0.4, 0.55, 0.45, 0.6]
  const dataPoints = Array.from({ length: n }, (_, i) =>
    point(i, maxR * (dataR[i % dataR.length] ?? 0.5)).join(','),
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



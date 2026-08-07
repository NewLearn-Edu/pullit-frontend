import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { UserNav } from '@/user/components/UserNav'
import { SubjectTabs } from '@/user/components/SubjectTabs'
import { CreditBadge } from '@/user/components/CreditBadge'
import { useTasteStore, type Subject } from '@/user/stores/tasteStore'
import { useMe } from '@/user/hooks/useMe'
import { useUserStore } from '@/user/stores/userStore'
import { ENGLISH_ABILITIES } from '@/user/data/englishAbilities'
import graphLock from '@/assets/home/graph-lock.png'
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
  /** 진단 완료 시 점수 보유 — 없으면 잠금 */
  score?: number
  /** 약점 판정 (빨간 행 + 약점 라벨) */
  weak?: boolean
}

/** 진단 점수 목 (칩 이름 → 소단원/유형별) — 진단 API 연동 시 이 상수만 교체 */
const MOCK_SCORES: Record<string, SubUnit[]> = {
  대수: [
    { name: '지수와 로그', score: 68, weak: true },
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
MOCK_SCORES['내용 파악'][0] = { name: '주제', score: 82 }

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
              <BookmarkIcon />
            </button>
            <button
              type="button"
              aria-label="마이페이지"
              onClick={() => navigate('/my')}
              className={styles.iconCircle}
            >
              <PersonIcon />
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
              <button type="button" aria-label="도움말" className={styles.helpChip}>
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

          {/* 소단원(수학) / 유형(영어) 리스트 — 약점·진단완료·잠금 3단계 */}
          <section className={styles.subCard}>
            <div className={styles.subHead}>
              <h2 className={styles.subTitle}>{subject === 'math' ? '소단원' : '유형'}</h2>
              <span className={styles.subCount}>{subUnits.length}개</span>
            </div>
            <div className={styles.subList}>
              {subUnits.map((u) => (
                <button
                  key={u.name}
                  type="button"
                  onClick={startQuiz}
                  className={clsx(
                    styles.subRow,
                    u.score != null && (u.weak ? styles.subRowWeak : styles.subRowDone),
                  )}
                >
                  <span className={styles.subName}>{u.name}</span>
                  {u.score != null ? (
                    <span className={styles.subRight}>
                      {u.weak && <span className={styles.weakLabel}>약점</span>}
                      <span className={styles.score}>{u.score}점</span>
                    </span>
                  ) : (
                    <img src={rowLock} alt="잠김" className={styles.rowLock} />
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
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

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  )
}

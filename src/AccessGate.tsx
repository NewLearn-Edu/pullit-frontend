import { useState, type FormEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isEarlybird } from '@/user/services/earlybird'

/**
 * 오픈 전 접근 게이트 (테스트 배포용).
 *
 * 공개 = 얼리버드 퍼널(/earlybird 진입 → 랜딩·진단·결과·정책)뿐이고,
 * 그 외 모든 페이지(로그인·홈·마이 등)는 비밀번호를 한 번 풀어야 접근된다.
 * 통과 여부는 localStorage 에 남아 같은 브라우저에선 다시 묻지 않는다.
 *
 * 주의: 클라이언트 게이트라 보안 장치가 아니다 — 번들을 뜯으면 우회 가능.
 * 외부 배포 링크에 내부 화면이 "실수로 노출되는 것"을 막는 소프트 잠금이 목적.
 * 오픈 때 이 컴포넌트만 걷어내면 된다.
 */
const GATE_PASSWORD = 'pullit12!@'
const GATE_KEY = 'pullit_gate'

/** 얼리버드 모드에서 비밀번호 없이 허용하는 경로 (진단 퍼널 + 법적 고지문) */
const EARLYBIRD_ALLOWED = ['/start', '/trial', '/weakness', '/policies']

function isUnlocked(): boolean {
  try {
    return localStorage.getItem(GATE_KEY) === '1'
  } catch {
    return false
  }
}

export default function AccessGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [unlocked, setUnlocked] = useState(isUnlocked)

  if (unlocked) return <>{children}</>

  // 얼리버드 진입점은 항상 공개 (여기서 모드가 켜진다)
  if (pathname === '/earlybird') return <>{children}</>

  // 얼리버드 모드가 켜진 브라우저는 퍼널 경로만 통과 — 일반 랜딩(/)은 비밀번호 필요
  if (isEarlybird() && EARLYBIRD_ALLOWED.some((prefix) => pathname.startsWith(prefix))) {
    return <>{children}</>
  }

  return <PasswordScreen onUnlock={() => setUnlocked(true)} />
}

function PasswordScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value !== GATE_PASSWORD) {
      setError(true)
      return
    }
    try {
      localStorage.setItem(GATE_KEY, '1')
    } catch {
      /* storage 불가 — 이번 세션만 통과 */
    }
    onUnlock()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#131417] px-[20px]">
      <form onSubmit={submit} className="flex w-full max-w-[360px] flex-col items-center gap-[16px]">
        <p className="text-[22px] font-bold text-white">풀잇</p>
        <p className="text-center text-[14px] leading-[1.6] text-[#9aa0a8]">
          오픈 준비 중이에요.
          <br />
          접근 비밀번호를 입력해주세요.
        </p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          placeholder="비밀번호"
          className="h-[52px] w-full rounded-[12px] border border-[#2b2e34] bg-[#1e2025] px-[16px] text-center text-[16px] text-white outline-none transition-colors placeholder:text-[#6b7178] focus:border-[#ff385c]"
        />
        {error && <p className="text-[13px] text-[#ff385c]">비밀번호가 맞지 않아요</p>}
        <button
          type="submit"
          className="h-[52px] w-full rounded-[12px] bg-[#ff385c] text-[16px] font-bold text-white transition-colors hover:bg-[#e6203f]"
        >
          입장하기
        </button>
      </form>
    </div>
  )
}

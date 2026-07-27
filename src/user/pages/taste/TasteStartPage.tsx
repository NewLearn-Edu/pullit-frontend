import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '@/user/components/AppHeader'
import { useTasteStore } from '@/user/stores/tasteStore'

export default function TasteStartPage() {
  const navigate = useNavigate()
  const reset = useTasteStore((s) => s.reset)

  const handleStart = () => {
    reset()
    // POC - skill_node · 유형 선택 없이 바로 수학 첫 문제로 (지수와 로그 고정)
    navigate('/taste/quiz/math/0')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <AppHeader onClose={() => navigate('/')} />

      <main className="inner flex flex-1 flex-col justify-center py-xxl">
        <div className="mx-auto max-w-[560px] text-center">
          <p className="text-body-sm font-semibold uppercase tracking-wider text-primary">
            맛보기 테스트
          </p>
          <h1 className="mt-md text-h1 font-bold text-foreground">
            8문제로 네 약점을 찾아볼게
          </h1>
          <p className="mt-lg text-body text-body">
            수학 4문제 · 영어 4문제. 소단원 · 유형은 네가 직접 골라.
            <br />
            푸는 데 대략 <b>15 ~ 20분</b> 정도 걸려.
          </p>

          <div className="mt-xxl grid gap-md text-left">
            <StepRow index={1} title="수학 4문제 풀이" desc="지수와 로그 · 진행바 · 타이머" />
            <StepRow index={2} title="영어 4문제 풀이" desc="빈칸 추론 · 진행바 · 타이머" />
            <StepRow index={3} title="완주 · 약점 결과 공개" desc="8문제 다 풀면 잠금 해제" />
          </div>

          <div className="mt-xxl">
            <button type="button" onClick={handleStart} className="btn-xl w-full sm:w-auto">
              시작하기
            </button>
            <p className="mt-md text-body-sm text-muted">
              <Link to="/" className="underline">
                다음에 하기
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

function StepRow({ index, title, desc }: { index: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-lg rounded-btn-lg border border-line bg-surface p-lg">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-body-sm font-semibold text-white">
        {index}
      </div>
      <div>
        <p className="text-body font-semibold text-foreground">{title}</p>
        <p className="text-body-sm text-body">{desc}</p>
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'

/**
 * 랜딩 (임시 다크 히어로 placeholder)
 * 원본 다크 시네마틱 랜딩은 legacy/landing.html (구 index.html) 참고.
 * 후속 이슈로 컴포넌트화 예정.
 */
export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-dark-bg text-white">
      <header className="inner flex h-16 items-center justify-between">
        <div className="text-xl font-bold text-primary">풀잇</div>
        <Link to="/taste" className="btn-xl h-10 rounded-btn-md px-lg text-body-sm">
          무료 시작
        </Link>
      </header>

      <section className="inner grid min-h-[calc(100dvh-4rem)] items-center gap-xxl md:grid-cols-2">
        <div>
          <h1 className="text-[64px] leading-[1.05] font-extrabold text-primary md:text-[80px]">
            넌<br />문제만 풀어
          </h1>
          <p className="mt-lg text-h3 font-semibold text-white">
            1등급까지{' '}
            <span className="text-primary">풀잇</span>
            이 도와줄게
          </p>
          <p className="mt-lg text-body text-white/70">
            매일 4문제로 약점을 찾고, 지금 필요한 문제만 골라주는 AI 학습 서비스
          </p>
          <p className="mt-xl text-body-sm">
            <span className="font-semibold text-success">회원가입 없이</span>
            <span className="text-white/70"> 내 약점부터 확인</span>
          </p>
          <Link
            to="/taste"
            className="mt-xl inline-flex h-14 items-center justify-center rounded-btn-xl bg-primary px-xxl text-[17px] font-semibold text-white shadow-[0_0_40px_rgba(255,56,92,0.4)] hover:bg-primary-hover"
          >
            4문제로 약점 찾기
          </Link>
        </div>

        <div className="hidden md:block">
          <div className="rounded-btn-xl bg-white p-xxl text-foreground shadow-[0_20px_60px_rgba(255,56,92,0.15)]">
            <div className="flex items-center justify-between text-body-sm text-body">
              <span>오늘의 문제 1/4</span>
              <span>지수와 로그</span>
            </div>
            <div className="mt-md h-1 rounded-full bg-line">
              <div className="h-full w-1/4 rounded-full bg-primary" />
            </div>
            <div className="mt-xl space-y-md text-body">
              <p>최고차항의 계수가 1인 삼차함수 f(x)에 대하여 함수</p>
              <p className="text-center font-semibold">g(x)=&#123;f(x)+1&#125;2ef(x)</p>
              <p>가 다음 조건을 만족시킨다.</p>
              <div className="rounded-md bg-surface p-lg text-body-sm">
                <p>(가) 방정식 g&apos;(x)=0은 서로 다른 3개의 실근을 갖는다.</p>
                <p>(나) g(4)=4e</p>
              </div>
              <p>f(5)의 최댓값을 고르시오.</p>
            </div>
            <div className="mt-xl grid grid-cols-5 gap-md text-center text-body">
              {['① 4', '② 5', '③ 6', '④ 7', '⑤ 8'].map((c) => (
                <div key={c} className="rounded-md border border-line py-md">
                  {c}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-xl w-full rounded-btn-lg bg-primary/70 py-md text-white"
            >
              다음 문제
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

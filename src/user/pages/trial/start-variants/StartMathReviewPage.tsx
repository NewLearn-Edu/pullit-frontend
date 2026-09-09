import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrialFunnelGuard } from '@/user/hooks/useTrialFunnelGuard'
import { enterTrialFunnel } from '@/user/services/trialFunnel'
import type { StartVariantProps } from '@/user/services/startVariants'
import bgExam from '@/assets/start/math-review/bg-exam.jpg'
import img9011 from '@/assets/start/math-review/img-9011.jpg'
import img9014 from '@/assets/start/math-review/img-9014.jpg'
import img9013 from '@/assets/start/math-review/img-9013.jpg'
import img9010 from '@/assets/start/math-review/img-9010.jpg'
import img9012 from '@/assets/start/math-review/img-9012.jpg'
import img9528 from '@/assets/start/math-review/img-9528.jpg'
import avatar651 from '@/assets/start/math-review/img-651.jpg'
import avatar647 from '@/assets/start/math-review/img-647.jpg'
import avatar652 from '@/assets/start/math-review/img-652.jpg'
import radar626 from '@/assets/start/math-review/img-626.jpg'
import radar653 from '@/assets/start/math-review/img-653.png'
import problem645 from '@/assets/start/math-review/img-645.png'
import problem646 from '@/assets/start/math-review/img-646.png'

/**
 * /start 변형 · 수학 후기형 (Figma 풀잇_인스타그램 335-123 "/start-후기2" · 2026-09-09)
 *
 * 인스타 DM 캡처 콜라주 + 스토리 말풍선 → 약점 레이더 → 문제 캡처 → CTA 로 이어지는 세로 스크롤 광고 랜딩.
 * 시안이 750px 아트보드 위 절대 배치라, 아트보드를 컨테이너 쿼리 단위(cqw)로 통째로 스케일한다 —
 * 폭이 375 든 520 이든 시안 비율 그대로. 좌표·크기는 전부 시안의 750 기준 px 를 u() 로 넘긴다.
 * DM 캡처(IMG_90xx)는 폰 전체 스크린샷에서 일부만 보이는 구조라 시안의 오프셋 비율을 그대로 옮겼다.
 *
 * 퍼널 흐름은 기본 /start 와 동일 — CTA 는 /trial(과목 선택). 완주자 가드도 같다.
 */

const DESIGN_W = 750
/** 시안 px → 컨테이너 폭 비례 길이 */
const u = (n: number) => `calc(${n} * 100cqw / ${DESIGN_W})`
const box = (x: number, y: number, w: number, h: number): CSSProperties => ({
  position: 'absolute', left: u(x), top: u(y), width: u(w), height: u(h),
})
const SHADOW = '0 2px 18px rgba(0,0,0,0.25)'

/** 폰 스크린샷 일부만 보여주는 캡처 창 — 시안의 inner img 비율(%) 그대로 */
function Capture({ style, src, innerH, innerTop, innerW = '100%', innerLeft = '0', shadow = true, border, radius }: {
  style: CSSProperties; src: string; innerH: string; innerTop: string; innerW?: string; innerLeft?: string
  shadow?: boolean; border?: string; radius?: string
}) {
  return (
    <div style={{ ...style, overflow: 'hidden', boxShadow: shadow ? SHADOW : undefined, border, borderRadius: radius }}>
      <img alt="" src={src} draggable={false} style={{ position: 'absolute', maxWidth: 'none', height: innerH, top: innerTop, width: innerW, left: innerLeft }} />
    </div>
  )
}

/** 빨강→검정 그라데이션 + 흰 외곽선 헤드라인 (시안 335-127 · 128) */
function Headline({ top, children }: { top: number; children: ReactNode }) {
  const base: CSSProperties = {
    position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: u(top),
    fontSize: u(70.56), lineHeight: 1.2, fontWeight: 900, textAlign: 'center', whiteSpace: 'nowrap', wordBreak: 'keep-all',
  }
  return (
    <>
      <p aria-hidden style={{ ...base, WebkitTextStroke: `${u(7)} #ffffff`, color: '#ffffff' }}>{children}</p>
      <p style={{ ...base, backgroundImage: 'linear-gradient(to bottom, #ff0000, #000000)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
        {children}
      </p>
    </>
  )
}

/** 스토리 말풍선 — 검정 바탕 흰 글씨 (335-215 · 216 · 218) */
function Bubble({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <p style={{ position: 'absolute', left: u(x), top: u(y), padding: u(10), background: '#000', color: '#fff', fontSize: u(26.4), lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap' }}>
      {children}
    </p>
  )
}

export default function StartMathReviewPage(_props: StartVariantProps) {
  const navigate = useNavigate()
  // 맛보기를 이미 완주한 유저만 홈으로 — 기본 /start 와 같은 가드
  useTrialFunnelGuard()

  return (
    <main className="min-h-dvh bg-black" style={{ paddingBottom: 'calc(112px + env(safe-area-inset-bottom, 0px))' }}>
      {/* 아트보드 — 폭에 비례해 통째로 스케일. cqw 는 "조상" 컨테이너 기준이라 컨테이너(바깥)와 아트보드(안)를 나눈다 */}
      <div className="mx-auto w-full max-w-[520px]" style={{ containerType: 'inline-size' }}>
      <div className="relative select-none overflow-hidden" style={{ height: u(3960) }}>
        <Headline top={98}>수학 노베이스가<br />1등급 찍은 꿀팁 공개</Headline>

        {/* 시험지 사진 (9월 모평 수학 96점) */}
        <img alt="" src={bgExam} draggable={false} style={{ ...box(0, 312, 750, 897), objectFit: 'cover' }} />

        {/* 인스타 DM 캡처 콜라주 — 겹침 순서는 시안 레이어 순서 그대로 (아래 → 위): 9012 · 9010 · 9013 · 9014 · 9011 */}
        <Capture style={box(61.94, 959.93, 607.73, 220.08)} src={img9012} innerH="601.38%" innerTop="-438.99%" />
        <img alt="" src={avatar652} style={{ ...box(84.4, 1096.91, 44.91, 44.91), borderRadius: '50%', border: '0.8px solid #d9dadc', objectFit: 'cover' }} />
        <Capture style={box(348, 894, 382, 78)} src={img9010} innerH="1067.78%" innerTop="-856.02%" />
        <Capture style={box(106.53, 826, 280.85, 160)} src={img9013} innerH="383.03%" innerTop="-243.66%" />
        <img alt="" src={avatar647} style={{ ...box(117.49, 946.55, 21.92, 21.92), borderRadius: '50%', objectFit: 'cover' }} />
        <Capture style={box(382.48, 696.17, 253.66, 203.87)} src={img9014} innerH="270.46%" innerTop="-142.55%" />
        {[748.22, 832.81, 865.34].map((y) => (
          <img key={y} alt="" src={avatar647} style={{ ...box(391.16, y, 19.52, 19.52), borderRadius: '50%', objectFit: 'cover' }} />
        ))}
        <Capture style={box(68, 704, 340.6, 136.64)} src={img9011} innerH="540%" innerTop="-383.48%" />
        <img alt="" src={avatar651} style={{ ...box(81.01, 795.09, 26.03, 26.03), borderRadius: '50%', border: '0.4px solid #d9dadc', objectFit: 'cover' }} />

        <Headline top={1210}>하도 많이 물어봐서<br />내가 했던 비법 알려줌</Headline>

        {/* 스토리 — 시험지 위에 DM 카드와 말풍선 */}
        <img alt="" src={img9528} draggable={false} style={{ ...box(92, 1426, 567.6, 1008.48), objectFit: 'cover' }} />
        <div style={{ ...box(155.36, 1476.16, 455.86, 67.31), background: '#262626', borderRadius: `${u(18.36)} ${u(18.36)} 0 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: u(18.36), fontWeight: 500 }}>
          9모 기념 무물
        </div>
        <div style={{ ...box(155.36, 1543.47, 455.86, 96.37), background: '#fff', borderRadius: `0 0 ${u(18.36)} ${u(18.36)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: u(26), fontWeight: 500, whiteSpace: 'nowrap' }}>
          님 제발 수학 잘하는 방법좀 알려주셈
        </div>
        <Bubble x={176} y={1690}>일단 나는 내가 어떤 문제를 많이 틀리고<br />모르는지도 잘 모르는 상태였음 ㅜㅜ</Bubble>
        <Bubble x={111} y={1835}>근데 풀잇이라는 문제푸는 앱이 있어서<br />다운받아봤는데</Bubble>
        <Bubble x={204} y={1957}>문제 3문제만 풀어서 진단하면<br />내가 어려워하는 문제만 계속 주는거임</Bubble>
        <div style={{ ...box(115, 2100, 508, 90), background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff0000', fontSize: u(26.66), lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap' }}>
          그냥 학원갈 때 지하철에서 조금씩 풀었는데<br />맨날맨날 푸니까 점점 성적이 오르더라고?!
        </div>

        {/* 약점 레이더 캡처 2장 */}
        <Capture style={box(24, 2484, 350, 424)} src={radar626} innerH="182.89%" innerTop="-22.63%" innerW="102.22%" innerLeft="-1.11%" shadow={false} border={`${u(2)} solid #000`} />
        <Capture style={box(352, 2544, 374, 306)} src={radar653} innerH="100.42%" innerTop="-0.21%" innerW="101.6%" innerLeft="-1.6%" shadow={false} border="0.64px solid #000" />
        <p style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: u(2958), fontSize: u(48), lineHeight: 1.4, fontWeight: 600, color: '#fff', textAlign: 'center', whiteSpace: 'nowrap' }}>
          그냥 수학 단원별로<br />어디가 약한지 찾고 문제 풀었음
        </p>

        {/* 문제 캡처 2장 */}
        <img alt="" src={problem645} style={{ ...box(28, 3180, 362, 320), objectFit: 'cover', border: '0.65px solid #000' }} />
        <img alt="" src={problem646} style={{ ...box(360, 3222, 362, 320), objectFit: 'cover', border: '0.65px solid #000' }} />
        <p style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: u(3578), fontSize: u(48), lineHeight: 1.4, fontWeight: 600, color: '#fff', textAlign: 'center', whiteSpace: 'nowrap' }}>
          그리고 평가원 99.9% 반영한<br />문제로 계속 훈련함
        </p>

        <p style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: u(3840), padding: `0 ${u(13.44)}`, background: '#fff', color: '#000', fontSize: u(40.32), lineHeight: 1.4, fontWeight: 600, whiteSpace: 'nowrap' }}>
          속는셈 치고 한번 전단원 다 풀어봐👇
        </p>
      </div>
      </div>

      {/* 하단 고정 CTA — 기본 /start 와 같은 목적지(/trial) · 버튼 규격은 서비스 공통(56px · 14px 라운드) */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center bg-black px-[20px] pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-[20px]">
        <button
          type="button"
          onClick={() => navigate(enterTrialFunnel())} // 퍼널 정식 입구 — 진입 표식
          className="h-[56px] w-full max-w-[480px] rounded-[14px] bg-[#ff385c] text-[17px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="font-black">지금 0원으로</span> 수능 실전문제 풀어보기
        </button>
      </div>
    </main>
  )
}

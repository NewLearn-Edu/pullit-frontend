/**
 * 콘텐츠 규모 섹션 (ver.2 · "평가원 기조에 맞춘 문항과 해설 1.6만 개를 준비했어")
 * 수학 21개 소단원 · 영어 16개 유형 카드 — 단원·유형 명칭 정책의 표시 명칭 그대로.
 */
const MATH = {
  subject: '수학',
  chips: ['대수', '미적분 I', '확률과 통계'],
  count: 21,
  units: [
    '지수·로그', '지수·로그함수', '삼각함수',
    '사인·코사인법칙', '등차·등비수열', '수학적 귀납법',
    '수열의 합', '함수의 극한', '함수의 연속',
    '미분계수', '도함수', '도함수 활용',
    '부정적분', '정적분', '정적분 활용',
    '순열·조합', '이항정리', '확률의 뜻·이용',
    '조건부확률', '확률분포', '통계적 추정',
  ],
}

const ENGLISH = {
  subject: '영어',
  // 시안은 수학 칩이 복사돼 있어 실제 영어 영역(독해 능력 4분류)으로 교체
  chips: ['내용 파악', '글의 흐름', '어휘·추론', '정보 확인'],
  count: 16,
  units: [
    '주제', '제목', '요지',
    '목적', '주장', '문장 삽입',
    '글의 순서', '무관한 문장', '빈칸 추론',
    '요약문', '어휘 의미 01', '어휘 의미 04',
    '안내문 일치', '안내문 불일치', '본문 불일치',
    '도표',
  ],
}

function SubjectCard({ data }: { data: typeof MATH }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-[#1e2025]">
      <div className="flex flex-col gap-[20px] px-[36px] pb-[32px] pt-[36px] max-md:px-[24px]">
        <p className="text-[20px] font-bold text-white">{data.subject}</p>
        <div className="flex flex-wrap gap-[8px]">
          {data.chips.map((chip) => (
            <span key={chip} className="rounded-full bg-[#2b2e34] px-[14px] py-[7px] text-[13px] font-medium text-[#c8cbd0]">
              {chip}
            </span>
          ))}
        </div>
        <p className="text-[40px] font-bold text-white max-md:text-[32px]">
          <span className="text-primary">{data.count}</span>개 단원
        </p>
      </div>
      <div className="h-px w-full bg-[#2b2e34]" />
      <div className="grid grid-cols-3 gap-x-[20px] gap-y-[26px] px-[36px] pb-[40px] pt-[28px] max-md:grid-cols-2 max-md:px-[24px]">
        {data.units.map((unit) => (
          <span key={unit} className="whitespace-nowrap text-[15px] text-[#9aa0a8] max-md:text-[14px]">
            {unit}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function UnitsSection() {
  return (
    <section className="flex w-full flex-col items-center gap-[56px] px-[40px] py-[140px] max-xl:py-[90px] max-md:px-lg">
      <h2 className="break-keep text-center text-[24px] font-medium leading-[1.6] text-[#c8cbd0] max-md:text-[17px]">
        평가원 기조에 맞춘
        <br />
        <span className="text-[44px] font-bold leading-[1.5] text-white max-xl:text-[34px] max-md:text-[24px]">
          문항과 해설 <span className="text-primary">1.6만 개</span>를 준비했어
        </span>
      </h2>

      <div className="flex w-full max-w-[1000px] items-stretch gap-[24px] max-xl:flex-col">
        <SubjectCard data={MATH} />
        <SubjectCard data={ENGLISH} />
      </div>
    </section>
  )
}

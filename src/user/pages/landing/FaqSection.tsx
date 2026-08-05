import { useState } from 'react'

// TODO(카피 확정 필요): Q2·Q3 답변은 디자인에 없어 임시 작성 — 확정 카피로 교체할 것
const FAQS = [
  {
    question: '풀잇은 어떻게 사용하나요?',
    answer:
      '회원가입 없이 바로 약점 진단을 받고, 매일 추천되는 3문제를 풀면 돼요. 취약 단원을 집중 공략해줘요.',
  },
  {
    question: '문제는 어떤 기준으로 추천되나요?',
    answer:
      '지금까지 푼 문제 기록으로 단원별 실력을 계산하고, 수능에서 틀릴 가능성이 높은 단원의 문제부터 골라서 추천해줘요.',
  },
  {
    question: '수학·영어 둘 다 풀 수 있나요?',
    answer: '응, 수학과 영어 모두 지원해요. 약점 진단도 과목별로 받을 수 있어요.',
  },
]

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="flex w-full flex-col items-center justify-center overflow-hidden bg-[rgba(18,20,23,0.2)] py-[80px]">
      <div className="flex w-full max-w-[1280px] flex-col items-center gap-[40px] px-[40px] max-md:px-lg">
        <h2 className="pt-[8px] text-center text-[60px] font-bold text-white max-xl:text-[40px] max-md:text-[32px]">
          자주 묻는 질문
        </h2>

        <div className="flex w-full flex-col items-start gap-[12px]">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={faq.question}
                className="flex w-full flex-col gap-[18px] overflow-hidden rounded-[14px] bg-[#252021] px-[32px] py-[26px] max-md:px-lg"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-[16px] text-left"
                >
                  <span className="min-w-0 flex-1 break-keep text-[20px] text-white max-md:text-[17px]">
                    {faq.question}
                  </span>
                  <span
                    className={`shrink-0 text-[26px] font-bold ${
                      isOpen ? 'text-primary' : 'text-[#9c9493]'
                    }`}
                  >
                    {isOpen ? '–' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <>
                    <div className="h-px w-full bg-[#383439]" />
                    <p className="break-keep text-[16px] text-[#cdc6c4]">{faq.answer}</p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

import { useState } from 'react'

// 답변은 서비스 전체 톤과 같은 친근한 반말 (질문은 방문자 목소리라 존댓말 유지)
const FAQS = [
  {
    question: '풀잇은 어떻게 사용하나요?',
    answer:
      '회원가입 없이 바로 약점 진단을 받고, 매일 추천되는 3문제만 풀면 돼. 취약 단원을 집중 공략해줄게.',
  },
  {
    question: '문제는 어떤 기준으로 추천되나요?',
    answer:
      '지금까지 푼 문제 기록으로 단원별 실력을 계산하고, 수능에서 틀릴 가능성이 높은 단원의 문제부터 골라서 추천해줘.',
  },
  {
    question: '수학·영어 둘 다 풀 수 있나요?',
    answer: '응, 수학과 영어 모두 지원해. 약점 진단도 과목별로 받을 수 있어.',
  },
]

/** FAQ 아코디언 (ver.2) — 후기 바로 아래, 별도 헤딩 없이 리스트만 */
export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="flex w-full flex-col items-center px-[40px] pb-[60px] max-md:px-lg">
      <div className="flex w-full max-w-[940px] flex-col gap-[14px]">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <div key={faq.question} className="flex w-full flex-col rounded-[16px] bg-[#1e2025] px-[28px] py-[24px] max-md:px-[20px]">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-[16px] text-left"
              >
                <span className="min-w-0 flex-1 break-keep text-[17px] font-medium text-white max-md:text-[15px]">
                  {faq.question}
                </span>
                <span className="shrink-0 text-[22px] font-bold leading-none text-primary">
                  {isOpen ? '–' : '+'}
                </span>
              </button>
              {isOpen && (
                <p className="break-keep pt-[18px] text-[15px] leading-[1.7] text-[#9aa0a8]">{faq.answer}</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

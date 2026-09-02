import { useState } from 'react'

// 카피는 시안(2801-5653) 그대로 해요체 — 질문은 방문자 목소리라 존댓말
const FAQS = [
  {
    question: '풀잇은 어떻게 사용하나요?',
    answer: '회원가입 없이 바로 약점 진단을 받고, 매일 추천되는 3문제를 풀면 돼요. 취약 단원을 집중 공략해줘요.',
  },
  {
    question: '문제는 어떤 기준으로 추천되나요?',
    answer:
      '지금까지 푼 문제 기록으로 단원별 실력을 계산하고, 수능에서 틀릴 가능성이 높은 단원의 문제부터 골라서 추천해요.',
  },
  {
    question: '수학·영어 둘 다 풀 수 있나요?',
    answer: '네, 수학과 영어 모두 지원해요. 약점 진단도 과목별로 받을 수 있어요.',
  },
]

/** FAQ 아코디언 (ver.2) — 후기 바로 아래, 별도 헤딩 없이 리스트만 (첫 항목 열림) */
export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="flex w-full flex-col items-center bg-[rgba(18,20,23,0.2)] py-[80px] max-md:py-[60px]">
      <div className="flex w-full max-w-[1000px] flex-col gap-[9.4px] px-[31px]">
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <div key={faq.question} className="flex w-full flex-col gap-[14px] rounded-[20px] bg-[#23272b] px-[25px] py-[20.3px]">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-[12.5px] text-left"
              >
                <span className="min-w-0 flex-1 break-keep text-[15.6px] text-white">{faq.question}</span>
                <span className="shrink-0 text-[20.3px] font-bold leading-none text-primary">{isOpen ? '–' : '+'}</span>
              </button>
              {isOpen && (
                <>
                  <div className="h-px w-full bg-[#383439]" />
                  <p className="break-keep text-[12.5px] leading-[1.5] text-[#a6abb1]">{faq.answer}</p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

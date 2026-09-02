import starRating5 from '@/assets/landing/star-rating-5.svg'
import starRating4 from '@/assets/landing/star-rating-4.svg'
import SectionHeading from './SectionHeading'

/** 후기 카피 — 시안 Reviews-Track(3172-5289) 그대로 */
const REVIEWS = [
  {
    name: '김*연',
    stars: 5,
    title: '처음엔 약점 진단만 해보려고 했는데',
    body: '그냥 궁금해서 진단만 한번 해봤는데 약한 단원이 생각보다 많이 나와서 그거 보고 나니까 넘기기가 좀 그래서 추천 문제도 계속 풀고 있어요. 뭐 풀지 고민 안 해도 되는 게 진짜 편합니다',
  },
  {
    name: '박*우',
    stars: 4,
    title: '문제집 하나 더 사기 애매한 고3한테 괜찮을 듯',
    body: '이미 문제집은 많이 있는데 수능 앞두고 집중적으로 뭘 풀어야할지 몰랐는데 풀잇에서 약점 진단하고 필요한 단원만 알려주니 너무 편했어요',
  },
  {
    name: '이*진',
    stars: 5,
    title: '버스 기다릴 때 은근 개꿀입니다',
    body: '버스 기다리는 시간 아까운데 그 시간에 활용할 수 있는 앱이라서 너무 좋았어요!\n등하교만 해도 하루 네다섯 개는 풀어 시간 아낄 수 있습니다.',
  },
  {
    name: '최*민',
    stars: 5,
    title: '풀잇으로 제 약점 찾았어요!',
    body: '수학 못하는 건 알았는데 어디가 약한지는 몰랐어요. 모의고사 끝나면 아 또 틀렸네 하고 넘어갔는데 진단 돌려보니까 유독 점수 낮은 단원이 따로 있더라고요. 요즘은 그 단원부터 보고 있어요',
  },
  {
    name: '정*현',
    stars: 4,
    title: '수능 영어 때문에 깔았는데 생각보다 잘 쓰는 중',
    body: '저는 빈칸이랑 문장 삽입을 제일 많이 틀려요ㅠ 문제집은 원하는 유형만 골라 풀기가 귀찮았는데 여기는 유형 찾아서 바로 풀 수 있어서 편해요. 쉬는 시간에 한두 문제씩 하기 좋아여',
  },
  {
    name: '윤*호',
    stars: 5,
    title: '문제 퀄리티 다른앱이랑 비교가 안되네요',
    body: '무료라 문제는 별 기대 안 했는데 각 단원별 난이도가 다양하고 수능이랑 비슷하게 풀 수 있었어요! 수능 공부하면서 풀기 괜찮은 앱 찾아서 너무 좋아요',
  },
]

function ReviewCard({ review }: { review: (typeof REVIEWS)[number] }) {
  return (
    <article className="flex w-[359px] shrink-0 flex-col gap-[6px] self-stretch rounded-[20px] bg-[#23272b] px-[19.5px] py-[22.7px] shadow-[0_7.8px_9.4px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-white">{review.name}</span>
        <img
          src={review.stars === 5 ? starRating5 : starRating4}
          alt={`별점 ${review.stars}점`}
          className="h-[15.6px] w-[78px]"
        />
      </div>
      <p className="break-keep pb-[6px] text-[12.5px] font-medium text-white">{review.title}</p>
      <p className="whitespace-pre-line break-keep text-[12.5px] leading-[1.45] text-[#e5e7ea]">{review.body}</p>
    </article>
  )
}

/** 후기 마퀴 (ver.2 · 2801-5569) — 다크 카드 스트립이 자동으로 흐른다 (트랙 2벌 무한 루프) */
export default function ReviewsSection() {
  return (
    <section className="flex w-full flex-col items-center gap-[60px] overflow-hidden py-[80px] max-xl:gap-[40px] max-md:gap-[24px] max-md:py-[60px]">
      <SectionHeading eyebrow="미리 체험해본">
        사용자들의 <span className="text-primary">후기</span>를 확인해봐
      </SectionHeading>

      <div className="w-full overflow-hidden pt-[31px] max-md:pt-[8px]">
        <div className="landing-marquee-track flex w-max gap-[15.6px] pr-[15.6px]">
          {[...REVIEWS, ...REVIEWS].map((review, i) => (
            <ReviewCard key={`${review.name}-${i}`} review={review} />
          ))}
        </div>
      </div>
    </section>
  )
}

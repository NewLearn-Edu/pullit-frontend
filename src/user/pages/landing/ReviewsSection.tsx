import starRating from '@/assets/landing/star-rating.svg'

const REVIEWS = [
  {
    name: '김*연',
    title: '수학이 4등급에서 2등급까지 올랐어요',
    body: '처음에는 하루에 네 문제만 풀어서 성적이 오를까 싶었는데, 제가 자주 틀리는 유형만 계속 나오니까 효과가 있었어요. 문제를 틀리면 필요한 개념과 틀린 이유를 바로 확인할 수 있어서 같은 실수를 줄이는 데 도움이 됐어요.',
  },
  {
    name: '박*우',
    title: '무작정 문제집만 풀 때보다 훨씬 편해요',
    body: '문제집 펴놓고도 뭘 먼저 해야 할지 몰라서 시간 버리는 날이 많았는데, 이건 그냥 들어가면 바로 풀 수 있어서 편해요.\n특히 약한 유형이 보이니까 괜히 다 보려고 안 하게 돼요.\n해야 할 게 줄어드니까 오히려 더 하게 됩니다.',
  },
  {
    name: '이*진',
    title: '생각보다 제 약점이 너무 정확했어요',
    body: '저는 그냥 수학 전체를 못한다고 생각했는데, 막상 해보니까 특정 단원에서만 계속 틀리고 있더라고요.\n그걸 알고 나니까 공부 범위를 줄일 수 있었어요.\n무식하게 양으로 밀어붙이는 것보다 저한텐 이 방식이 더 잘 맞았습니다.',
  },
  {
    name: '최*민',
    title: '짧아서 좋음. 진짜 그게 큼',
    body: '저는 분량 많으면 바로 하기 싫어지는 스타일인데, 이건 "일단 해볼까?"가 돼요.\n시간 오래 안 걸리는데도 풀고 나면 내가 뭘 틀렸는지는 남아요.\n은근 꾸준히 하게 되는 타입',
  },
  {
    name: '강*서',
    title: '계획 못 세우는 사람한테 추천하고 싶어요',
    body: '제가 원래 계획표는 그럴듯하게 쓰는데 실천을 잘 못 하거든요.\n근데 이건 따로 계획 세울 필요 없이 바로 문제부터 풀 수 있어서 좋았어요.\n괜히 "오늘은 뭐 하지…" 하다가 끝나는 시간이 줄었습니다.',
  },
  {
    name: '강*서',
    title: '계속 공부했는데도 제자리였던 이유를 좀 알겠어요',
    body: '저는 나름 열심히 했는데 성적이 잘 안 올라서 스스로 좀 답답했어요.\n근데 막상 해보니까 제가 약한 부분은 따로 있었고, 그걸 모르고 계속 엉뚱한 데 힘을 쓰고 있더라고요.\n그걸 확인한 것만으로도 방향이 잡히는 느낌이었습니다.',
  },
]

function ReviewCard({ review }: { review: (typeof REVIEWS)[number] }) {
  return (
    <article className="flex w-[420px] shrink-0 flex-col gap-[10px] self-stretch rounded-[20px] bg-[#1e2025] px-[28px] py-[28px] max-md:w-[300px] max-md:px-[20px]">
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-bold text-white">{review.name}</span>
        <img src={starRating} alt="별점 5점" className="h-[18px] w-[90px]" />
      </div>
      <p className="break-keep pb-[6px] text-[16px] font-semibold text-white">{review.title}</p>
      <p className="whitespace-pre-line break-keep text-[14px] leading-[1.65] text-[#9aa0a8]">{review.body}</p>
    </article>
  )
}

/** 후기 마퀴 (ver.2) — 다크 카드 스트립이 자동으로 흐른다 (트랙 2벌 무한 루프) */
export default function ReviewsSection() {
  return (
    <section className="flex w-full flex-col items-center gap-[56px] overflow-hidden py-[140px] max-xl:py-[90px]">
      <h2 className="break-keep px-[40px] text-center text-[24px] font-medium leading-[1.6] text-[#c8cbd0] max-md:px-lg max-md:text-[17px]">
        미리 체험해본
        <br />
        <span className="text-[44px] font-bold leading-[1.5] text-white max-xl:text-[34px] max-md:text-[24px]">
          사용자들의 <span className="text-primary">후기</span>를 확인해봐
        </span>
      </h2>

      <div className="w-full overflow-hidden">
        <div className="landing-marquee-track flex w-max gap-[20px] pr-[20px]">
          {[...REVIEWS, ...REVIEWS].map((review, i) => (
            <ReviewCard key={`${review.name}-${i}`} review={review} />
          ))}
        </div>
      </div>
    </section>
  )
}

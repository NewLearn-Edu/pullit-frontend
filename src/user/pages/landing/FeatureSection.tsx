import type { ReactNode } from 'react'

interface FeatureSectionProps {
  title: ReactNode
  subtitle: string
  image: string
  imageAlt: string
  /** true 면 데스크톱(≥1280)에서 이미지가 왼쪽, 텍스트가 오른쪽 */
  imageFirst?: boolean
}

function CarouselDots() {
  return (
    <div className="flex items-start gap-[20px]">
      <span className="h-[12px] w-[24px] rounded-[50px] bg-gradient-to-b from-[#ca4166] to-[#e1c6c6]" />
      <span className="size-[12px] rounded-[50px] bg-surface" />
    </div>
  )
}

/** 1280 미만: 텍스트 위 · 이미지 아래 세로 스택 (Figma 768~1280 프레임 기준) */
export default function FeatureSection({
  title,
  subtitle,
  image,
  imageAlt,
  imageFirst = false,
}: FeatureSectionProps) {
  return (
    <section className="flex w-full items-center justify-center overflow-hidden bg-[rgba(18,20,23,0.2)] py-[120px] max-xl:py-[80px]">
      <div
        className={`flex w-full max-w-[1280px] flex-1 items-center justify-between px-[40px] max-xl:flex-col max-xl:items-start max-xl:gap-[40px] max-md:px-lg ${
          imageFirst ? 'max-xl:flex-col-reverse' : ''
        }`}
      >
        {imageFirst ? (
          <>
            <FeatureImage image={image} imageAlt={imageAlt} />
            <FeatureText title={title} subtitle={subtitle} />
          </>
        ) : (
          <>
            <FeatureText title={title} subtitle={subtitle} />
            <FeatureImage image={image} imageAlt={imageAlt} />
          </>
        )}
      </div>
    </section>
  )
}

function FeatureText({ title, subtitle }: Pick<FeatureSectionProps, 'title' | 'subtitle'>) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[24px] break-keep px-[24px] max-xl:w-full max-xl:flex-none">
      <h2 className="text-[60px] font-bold leading-[1.25] text-white max-xl:text-[40px] max-md:text-[32px]">
        {title}
      </h2>
      <p className="text-[24px] font-medium text-[#80858b] max-xl:text-[20px] max-md:text-[18px]">
        {subtitle}
      </p>
    </div>
  )
}

function FeatureImage({ image, imageAlt }: Pick<FeatureSectionProps, 'image' | 'imageAlt'>) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[20px] max-xl:w-full max-xl:flex-none">
      <img src={image} alt={imageAlt} className="aspect-[1860/1680] w-full object-cover" />
      <CarouselDots />
    </div>
  )
}

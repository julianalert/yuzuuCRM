import Image from 'next/image'

type Props = {
  quote: string
  name: string
  role: string
  avatarSrc: string
}

export function TestimonialCard({ quote, name, role, avatarSrc }: Props) {
  return (
    <div className="testimonial-card">
      <div className="testimonial-quote-mark">&ldquo;</div>
      <p className="testimonial-body">{quote}</p>
      <div className="testimonial-author">
        <div className="testimonial-avatar-wrap">
          <Image
            src={avatarSrc}
            alt={name}
            width={44}
            height={44}
            className="testimonial-avatar-img"
          />
        </div>
        <div>
          <div className="testimonial-name">{name}</div>
          <div className="testimonial-role">{role}</div>
        </div>
      </div>
    </div>
  )
}

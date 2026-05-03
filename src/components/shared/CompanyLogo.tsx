'use client'

export function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  return (
    <div className="co-logo">
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        onError={(e) => {
          const img = e.target as HTMLImageElement
          img.style.display = 'none'
          const sibling = img.nextElementSibling as HTMLElement | null
          if (sibling) sibling.style.display = 'flex'
        }}
      />
      <span
        style={{
          display: 'none',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {name.charAt(0)}
      </span>
    </div>
  )
}

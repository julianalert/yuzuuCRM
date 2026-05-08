export interface IconProps {
  d: string | readonly string[]
  size?: number
  stroke?: string
  fill?: string
  strokeWidth?: number
  style?: React.CSSProperties
  className?: string
}

export function Icon({
  d,
  size = 16,
  stroke = 'currentColor',
  fill = 'none',
  strokeWidth = 1.5,
  style,
  className,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {Array.isArray(d)
        ? (d as string[]).map((path, i) => <path key={i} d={path} />)
        : <path d={d as string} />}
    </svg>
  )
}

export const Icons = {
  dashboard:    "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  tam:          "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  leads:        ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z", "M12 10m-3 0a3 3 0 106 0 3 3 0 10-6 0"] as readonly string[],
  signals:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  sequences:    "M22 12h-4l-3 9L9 3l-3 9H2",
  pipeline:     ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"] as readonly string[],
  capture:      "M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2",
  ask:          "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  settings:     "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  chevronRight: "M9 18l6-6-6-6",
  chevronDown:  "M6 9l6 6 6-6",
  plus:         "M12 5v14M5 12h14",
  search:       "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  bell:         "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  user:         "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8",
  logout:       "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  team:         "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  billing:      "M3 10h18M7 15h2m4 0h4M3 6l9-3 9 3v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z",
  integrations: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  filter:       "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  arrowUp:      "M12 19V5M5 12l7-7 7 7",
  star:         "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  zap:          "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  trendUp:      "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  dot:          "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0",
  check:        "M20 6L9 17l-5-5",
  mail:         "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  phone:        "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.08 6.08l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z",
  building:     "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  x:            "M18 6L6 18M6 6l12 12",
  trash:        "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  edit:         "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  moreHoriz:   "M5 12h.01M12 12h.01M19 12h.01",
} as const

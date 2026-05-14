/**
 * SnapshotReport.tsx
 *
 * Pure presentational component for a generated `lead_reports.payload`.
 * Used in three places:
 *   - Inline in the lead profile panel (LeadFinderView)
 *   - On the public /r/[token] share page
 *   - As the visual reference the PDF renderer mirrors
 *
 * Server-renderable (no client hooks). All styling is inline so the same
 * markup can be dropped into an email if we ever need to.
 */

import type { SnapshotPayload } from '@/lib/agent/snapshot-report'

export interface SnapshotReportBranding {
  agencyName: string
  agencyLogoUrl: string | null
  /** Hex accent color, defaults to Yuzuu black. */
  accent: string
  /** Hide the "Powered by Yuzuu" footer (enterprise feature). */
  hideYuzuuBranding: boolean
}

export interface SnapshotReportProps {
  payload: SnapshotPayload
  branding: SnapshotReportBranding
  lead: {
    name: string | null
    category: string | null
    address: string | null
    website: string | null
    rating: number | null
    review_count: number | null
  }
  generatedAt: string
}

const VERDICT_COLORS: Record<string, { bg: string; fg: string }> = {
  good:    { bg: 'rgba(45,164,78,0.14)', fg: '#1a7a3a' },
  neutral: { bg: 'rgba(0,0,0,0.05)',      fg: '#3a3a3a' },
  bad:     { bg: 'rgba(229,83,75,0.14)',  fg: '#a83a35' },
}

const SERVICE_LABELS: Record<string, string> = {
  web:              'Website',
  seo:              'SEO',
  ads:              'Paid ads',
  social:           'Social media',
  rep:              'Reputation',
  email:            'Email marketing',
  booking:          'Booking system',
  'ai-receptionist':'AI receptionist',
}

export function SnapshotReport({ payload, branding, lead, generatedAt }: SnapshotReportProps) {
  const accent = branding.accent || '#1A1916'
  return (
    <div style={{
      maxWidth: 760,
      margin: '0 auto',
      background: '#fff',
      color: '#1A1916',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',
      lineHeight: 1.55,
      border: '1px solid #E8E6E1',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header — agency branding */}
      <div style={{
        padding: '28px 36px 22px',
        borderBottom: '1px solid #E8E6E1',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        {branding.agencyLogoUrl ? (
          <img
            src={branding.agencyLogoUrl}
            alt={branding.agencyName}
            style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }}
          />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16,
          }}>
            {branding.agencyName.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1A1916' }}>
            {branding.agencyName}
          </div>
          <div style={{ fontSize: 12, color: '#6B6860' }}>
            Snapshot for {lead.name ?? 'a prospect'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#A8A49C' }}>
          {new Date(generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* Headline */}
      <div style={{ padding: '32px 36px 8px' }}>
        <div style={{ fontSize: 12, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {lead.category ?? 'Local business'}
          {lead.address && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {lead.address}</span>}
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 700, margin: '10px 0 6px',
          lineHeight: 1.22, letterSpacing: '-0.01em',
        }}>
          {lead.name ?? 'Untitled business'}
        </h1>
        {payload.headline && (
          <p style={{ fontSize: 16, color: '#4A4742', margin: 0, lineHeight: 1.5 }}>
            {payload.headline}
          </p>
        )}
      </div>

      {/* Snapshot row */}
      {payload.snapshot.length > 0 && (
        <div style={{ padding: '20px 36px 4px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {payload.snapshot.map((s, i) => {
            const c = VERDICT_COLORS[s.verdict] ?? VERDICT_COLORS.neutral
            return (
              <div key={i} style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: '#F7F6F3',
                border: '1px solid #E8E6E1',
              }}>
                <div style={{ fontSize: 11, color: '#6B6860', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>
                  <span style={{
                    padding: '1px 8px', borderRadius: 6,
                    background: c.bg, color: c.fg,
                  }}>{s.value}</span>
                </div>
                {s.benchmark && (
                  <div style={{ fontSize: 11.5, color: '#6B6860', marginTop: 6 }}>{s.benchmark}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Observations */}
      {payload.observations.length > 0 && (
        <Section title="What we noticed" accent={accent}>
          <ol style={{ padding: 0, margin: 0, listStyle: 'none' }}>
            {payload.observations.map((o, i) => (
              <li key={i} style={{
                display: 'flex', gap: 12, padding: '10px 0',
                borderBottom: i < payload.observations.length - 1 ? '1px solid #E8E6E1' : 'none',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 999,
                  background: accent, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{o.title}</div>
                  <div style={{ fontSize: 13.5, color: '#4A4742', marginTop: 3 }}>{o.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Estimated cost */}
      {payload.estimatedCost.length > 0 && (
        <Section title="What it's likely costing them" accent={accent}>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
            {payload.estimatedCost.map((c, i) => (
              <li key={i} style={{
                padding: '8px 14px',
                background: '#FEF6E7',
                borderRadius: 8,
                marginBottom: 8,
                fontSize: 13.5,
              }}>
                <strong>{c.area}:</strong>{' '}
                <span style={{ color: '#4A4742' }}>{c.rough_impact}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Recommendations */}
      {payload.recommendations.length > 0 && (
        <Section title="What we'd do" accent={accent}>
          <div style={{ display: 'grid', gap: 10 }}>
            {payload.recommendations.map((r, i) => (
              <div key={i} style={{
                border: '1px solid #E8E6E1',
                borderRadius: 10,
                padding: '12px 14px',
                background: '#FAFAF7',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
                    textTransform: 'uppercase', color: '#fff',
                    background: accent, padding: '2px 8px', borderRadius: 999,
                  }}>{SERVICE_LABELS[r.service] ?? r.service}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{r.what}</span>
                </div>
                {r.why && (
                  <div style={{ fontSize: 13, color: '#4A4742', marginBottom: 4 }}>
                    <span style={{ color: '#A8A49C', fontWeight: 600, marginRight: 4 }}>Why:</span>
                    {r.why}
                  </div>
                )}
                {r.expectedOutcome && (
                  <div style={{ fontSize: 13, color: '#4A4742' }}>
                    <span style={{ color: '#A8A49C', fontWeight: 600, marginRight: 4 }}>Outcome:</span>
                    {r.expectedOutcome}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* CTA */}
      {payload.callToAction && (
        <div style={{
          margin: '20px 36px 28px',
          padding: '16px 20px',
          background: accent,
          color: '#fff',
          borderRadius: 12,
          fontSize: 14.5,
          fontWeight: 500,
        }}>
          {payload.callToAction}
        </div>
      )}

      {/* Footer */}
      {!branding.hideYuzuuBranding && (
        <div style={{
          padding: '14px 36px 22px',
          borderTop: '1px solid #E8E6E1',
          fontSize: 11, color: '#A8A49C',
          textAlign: 'center',
        }}>
          Powered by Yuzuu
        </div>
      )}
    </div>
  )
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 36px 4px' }}>
      <h2 style={{
        fontSize: 12, fontWeight: 700, color: accent,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        margin: '0 0 12px',
      }}>{title}</h2>
      {children}
    </div>
  )
}

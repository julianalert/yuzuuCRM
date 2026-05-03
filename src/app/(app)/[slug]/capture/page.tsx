'use client'

const captureStats = [
  { label: 'Emails captured', value: '1,284', sub: 'Last 90 days', icon: '✉️', bg: 'var(--blue-bg)'  },
  { label: 'Meetings logged', value: '47',    sub: 'Last 30 days', icon: '📅', bg: 'var(--green-bg)' },
  { label: 'Calls recorded',  value: '12',    sub: 'Last 30 days', icon: '📞', bg: 'var(--amber-bg)' },
  { label: 'Auto-summaries',  value: '100%',  sub: 'AI coverage',  icon: '✨', bg: '#EEF0FD'         },
]

const activities = [
  { type: '📧', who: 'Arthur Mensch',          company: 'Mistral AI', action: 'Sent email',      subject: '"Re: Platform demo follow-up"',         time: 'Today, 10:23',     summary: 'Positive reply — confirmed interest, requested pricing deck.',                                           sentiment: 'positive' },
  { type: '📅', who: 'Jean-Charles Samuelian', company: 'Alan',       action: 'Meeting',          subject: 'Discovery call — 45 min',               time: 'Today, 09:00',     summary: 'Strong fit. Pain around manual CRM. Wants team access. Next: demo in 1 week.',                         sentiment: 'positive' },
  { type: '📞', who: 'Steve Anavi',            company: 'Qonto',      action: 'Call recorded',   subject: 'Negotiation call — 28 min',              time: 'Yesterday, 16:40', summary: 'Pricing objection on enterprise plan. Asked for discount. Tone shifted cautious. Flag for follow-up.', sentiment: 'neutral'  },
  { type: '📧', who: 'Nicolas Bustamante',     company: 'Doctrine',   action: 'Inbound email',   subject: '"Interested in your platform"',          time: 'Yesterday, 14:15', summary: 'Inbound lead. Saw a LinkedIn post. Asked for a demo. High intent.',                                    sentiment: 'positive' },
]

const borderColor: Record<string, string> = {
  positive: 'var(--green)',
  negative: 'var(--red)',
  neutral:  'var(--amber)',
}

export default function CapturePage() {
  return (
    <div className="page-enter">
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {captureStats.map((s) => (
          <div key={s.label} className="stat-card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: 22 }}>{s.value}</div>
              <div className="stat-label" style={{ marginBottom: 0 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity Feed</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['All', 'Email', 'Meeting', 'Call'].map((f) => (
              <button key={f} className={`btn btn-sm ${f === 'All' ? 'btn-primary' : 'btn-secondary'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 20px' }}>
          {activities.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                {a.type}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.who}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>·</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.company}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>·</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.action}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{a.time}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>{a.subject}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', background: 'var(--bg)', borderRadius: 6, padding: '7px 10px', borderLeft: `3px solid ${borderColor[a.sentiment]}` }}>
                  ✨ {a.summary}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

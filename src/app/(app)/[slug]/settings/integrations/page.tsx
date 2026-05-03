import { SettingsLayout } from '@/components/layout/SettingsLayout'

const COMING_SOON = [
  { name: 'Gmail',           desc: 'Email capture & sending',      icon: '✉️' },
  { name: 'Google Calendar', desc: 'Meeting sync',                  icon: '📅' },
  { name: 'Aircall',         desc: 'Call recording & transcripts',  icon: '📞' },
  { name: 'Zoom',            desc: 'Meeting recordings',            icon: '🎥' },
]

export default function IntegrationsPage() {
  return (
    <SettingsLayout>
      <div className="card">
        <div className="card-header"><span className="card-title">Coming soon</span></div>
        <div style={{ padding: '0 20px' }}>
          {COMING_SOON.map(({ name, desc, icon }) => (
            <div
              key={name}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ width: 36, height: 36, background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid var(--border)' }}>
                {icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>{name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    </SettingsLayout>
  )
}

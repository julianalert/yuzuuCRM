export default function SignalsLoading() {
  return (
    <div className="page-enter">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ background: 'var(--border)', borderRadius: 20, height: 30, width: i === 0 ? 50 : 100 }} />
        ))}
      </div>
      <div className="card">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--border)', borderRadius: 8, height: 32, width: 32, flexShrink: 0 }} />
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

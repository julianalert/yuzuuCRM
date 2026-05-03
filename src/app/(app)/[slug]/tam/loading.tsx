export default function TAMLoading() {
  return (
    <div className="page-enter">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ background: 'var(--border)', borderRadius: 8, height: 32, width: 220 }} />
        <div style={{ background: 'var(--border)', borderRadius: 8, height: 32, width: 80 }} />
      </div>
      <div className="card">
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--border)', borderRadius: 5, height: 28, width: 28 }} />
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

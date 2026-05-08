export default function SignalsLoading() {
  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ background: 'var(--border)', borderRadius: 6, height: 24, width: 100, marginBottom: 8 }} />
        <div style={{ background: 'var(--border)', borderRadius: 6, height: 14, width: 280 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[80, 120, 110, 130, 100, 115, 90, 125].map((w, i) => (
          <div key={i} style={{ background: 'var(--border)', borderRadius: 20, height: 32, width: w }} />
        ))}
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '16px 20px', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ background: 'var(--border)', borderRadius: 10, height: 40, width: 40, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ background: 'var(--border)', borderRadius: 4, height: 14, width: '40%', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <div style={{ background: 'var(--border)', borderRadius: 20, height: 22, width: 80 }} />
                <div style={{ background: 'var(--border)', borderRadius: 20, height: 22, width: 100 }} />
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 4, height: 12, width: '60%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

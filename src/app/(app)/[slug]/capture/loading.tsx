export default function CaptureLoading() {
  return (
    <div className="page-enter">
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card" style={{ minHeight: 80 }}>
            <div style={{ background: 'var(--border)', borderRadius: 4, height: 22, width: '40%' }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ minHeight: 300 }} />
    </div>
  )
}

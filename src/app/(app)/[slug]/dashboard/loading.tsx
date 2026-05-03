export default function DashboardLoading() {
  return (
    <div className="page-enter">
      <div className="stats-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card" style={{ minHeight: 90 }}>
            <div style={{ background: 'var(--border)', borderRadius: 4, height: 12, width: '60%', marginBottom: 10 }} />
            <div style={{ background: 'var(--border)', borderRadius: 4, height: 28, width: '40%', marginBottom: 8 }} />
            <div style={{ background: 'var(--border)', borderRadius: 4, height: 10, width: '50%' }} />
          </div>
        ))}
      </div>
      <div className="grid-2">
        {[0, 1].map((i) => (
          <div key={i} className="card" style={{ minHeight: 200 }}>
            <div className="card-header">
              <div style={{ background: 'var(--border)', borderRadius: 4, height: 14, width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

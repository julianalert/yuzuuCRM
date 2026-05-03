export default function SequencesLoading() {
  return (
    <div className="page-enter">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card" style={{ padding: '14px 18px', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 14 }} />
            <div style={{ background: 'var(--border)', borderRadius: 20, height: 22, width: 70 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

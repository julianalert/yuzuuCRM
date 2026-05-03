export default function AskLoading() {
  return (
    <div className="page-enter" style={{ height: 'calc(100vh - var(--header-h) - 48px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ background: 'var(--border)', borderRadius: 12, height: 60, maxWidth: 480, marginBottom: 16 }} />
      </div>
    </div>
  )
}

export default function PipelineLoading() {
  return (
    <div className="page-enter">
      <div className="kanban">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="kanban-col" style={{ minHeight: 200 }}>
            <div className="kanban-col-header">
              <div style={{ background: 'var(--border)', borderRadius: 4, height: 12, width: '60%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

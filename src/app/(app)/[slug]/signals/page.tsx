'use client'

const signals = [
  { id: 1, company: 'Mistral AI',  type: 'funding', icon: '💰', title: 'Raised $600M Series B',            meta: 'Funding · mistral.ai',      time: '2h ago',  bg: '#EBF5F0', relevance: 98 },
  { id: 2, company: 'Alan',        type: 'hiring',  icon: '🧑‍💼', title: 'Hiring Head of Sales EMEA',         meta: 'Hiring signal · alan.com',    time: '4h ago',  bg: '#EBF1FA', relevance: 85 },
  { id: 3, company: 'Pennylane',   type: 'tech',    icon: '🛠️', title: 'Dropped Salesforce from stack',     meta: 'Tech change · pennylane.com', time: '1d ago',  bg: '#FEF6E7', relevance: 92 },
  { id: 4, company: 'Qonto',       type: 'news',    icon: '📰', title: 'Expanding into German market',      meta: 'News · qonto.com',            time: '2d ago',  bg: '#EEF0FD', relevance: 74 },
  { id: 5, company: 'Doctrine',    type: 'hiring',  icon: '🧑‍💼', title: 'VP Revenue posted on LinkedIn',     meta: 'Hiring signal · doctrine.fr', time: '3d ago',  bg: '#EBF1FA', relevance: 88 },
]

const filters = ['All', 'Funding 💰', 'Hiring 🧑‍💼', 'Tech Change 🛠️', 'News 📰']

export default function SignalsPage() {
  return (
    <div className="page-enter">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {filters.map((f) => (
          <button key={f} className={`btn btn-sm ${f === 'All' ? 'btn-primary' : 'btn-secondary'}`}>
            {f}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary btn-sm">Mark all read</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: '0 20px' }}>
          {signals.map((s) => (
            <div key={s.id} className="signal-item">
              <div className="signal-icon" style={{ background: s.bg, fontSize: 16 }}>{s.icon}</div>
              <div className="signal-body">
                <div className="signal-title">{s.company} — {s.title}</div>
                <div className="signal-meta">{s.meta}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className="signal-time">{s.time}</span>
                <button className="btn btn-secondary btn-sm">Enroll →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

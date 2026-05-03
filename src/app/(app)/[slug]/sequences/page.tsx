'use client'

import { useState } from 'react'
import { Icon, Icons } from '@/components/shared/Icon'

const sequenceList = [
  { name: 'Outbound — Series A SaaS FR',   status: 'active', enrolled: 47, replied: 8,  rate: '17%', steps: 4 },
  { name: 'Re-engagement — Cold accounts', status: 'active', enrolled: 23, replied: 3,  rate: '13%', steps: 3 },
  { name: 'Post-demo follow-up',           status: 'draft',  enrolled: 0,  replied: 0,  rate: '—',   steps: 5 },
]

const builderSteps = [
  { n: 1, type: 'Email',    subject: '{{first_name}}, quick question about {{company}}', delay: 'Send immediately' },
  { n: 2, type: 'Email',    subject: 'Following up — {{company}}',                       delay: 'Wait 3 days'      },
  { n: 3, type: 'LinkedIn', subject: 'Connect + intro message',                          delay: 'Wait 2 days'      },
  { n: 4, type: 'Email',    subject: 'Last touch — {{first_name}}',                      delay: 'Wait 5 days'      },
]

export default function SequencesPage() {
  const [view, setView] = useState<'list' | 'builder'>('list')

  if (view === 'builder') {
    return (
      <div className="page-enter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('list')}>
            <Icon d={Icons.x} size={14} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>New Sequence</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm">Save Draft</button>
            <button className="btn btn-primary btn-sm">Activate</button>
          </div>
        </div>
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Sequence Steps</span>
              <button className="btn btn-ghost btn-sm"><Icon d={Icons.plus} size={13} /></button>
            </div>
            <div className="card-body">
              {builderSteps.map((s) => (
                <div key={s.n} className="seq-step">
                  <div className="seq-step-num">{s.n}</div>
                  <div className="seq-step-body">
                    <div className="seq-step-type">{s.type}</div>
                    <div className="seq-step-subject">{s.subject}</div>
                    <div className="seq-step-delay">{s.delay}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Settings</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Sequence name</label>
                <input className="form-input" defaultValue="Outbound — Series A SaaS FR" />
              </div>
              <div className="form-group">
                <label className="form-label">Sending account</label>
                <input className="form-input" defaultValue="julian@company.io" />
              </div>
              <div className="form-group">
                <label className="form-label">Send window</label>
                <input className="form-input" defaultValue="Mon–Fri, 9:00–18:00" />
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--green-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>AI Personalization ON</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Claude will personalize each email using account signals and contact data.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', marginBottom: 16 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setView('builder')}
        >
          <Icon d={Icons.plus} size={13} /> New Sequence
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sequenceList.map((s) => (
          <div key={s.name} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.steps} steps</div>
              </div>
              <div style={{ display: 'flex', gap: 24, textAlign: 'center' }}>
                {([['Enrolled', s.enrolled], ['Replied', s.replied], ['Reply rate', s.rate]] as [string, string | number][]).map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 17, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{l}</div>
                  </div>
                ))}
              </div>
              <span className={`status ${s.status === 'active' ? 'status-qualified' : 'status-new'}`}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

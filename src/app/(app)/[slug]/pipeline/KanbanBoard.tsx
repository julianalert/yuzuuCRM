'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Deal, Account, User } from '@/lib/types'
import { Icon, Icons } from '@/components/shared/Icon'
import { NewDealModal } from './NewDealModal'

type DealWithRelations = Deal & {
  accounts?: Pick<Account, 'id' | 'name' | 'domain'> | null
  users?: Pick<User, 'id' | 'full_name' | 'email'> | null
}

interface KanbanBoardProps {
  slug: string
  initialDeals: DealWithRelations[]
}

const STAGES: { key: Deal['stage']; label: string; accent: string }[] = [
  { key: 'discovery', label: 'Discovery', accent: '#1A4A8C' },
  { key: 'demo', label: 'Demo', accent: '#6B35A8' },
  { key: 'proposal', label: 'Proposal', accent: '#92580A' },
  { key: 'negotiation', label: 'Negotiation', accent: '#B54A0A' },
  { key: 'closed_won', label: 'Closed Won', accent: '#1E6B45' },
]

function formatValue(deal: DealWithRelations): string {
  if (!deal.value) return '—'
  const num = Number(deal.value)
  const symbol = deal.currency === 'GBP' ? '£' : deal.currency === 'EUR' ? '€' : '$'
  if (num >= 1000) return `${symbol}${(num / 1000).toFixed(0)}k`
  return `${symbol}${num}`
}

function formatColumnValue(deals: DealWithRelations[], currency = 'USD'): string {
  const total = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  if (total === 0) return '—'
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
  if (total >= 1000) return `${symbol}${(total / 1000).toFixed(0)}k`
  return `${symbol}${total}`
}

function CloseDateDisplay({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const now = new Date()
  const isPast = date < now
  const rel = formatDistanceToNow(date, { addSuffix: true })
  return (
    <span style={{ fontSize: 11, color: isPast ? 'var(--red)' : 'var(--text-3)' }}>
      {isPast ? '⚠ ' : ''}{rel}
    </span>
  )
}

function HealthDot({ health, score }: { health: DealWithRelations['health']; score: number | null }) {
  const color = health === 'green' ? '#2ECC71' : health === 'red' ? '#E74C3C' : '#F39C12'
  const bg = health === 'green' ? '#EBF5F0' : health === 'red' ? '#FCEAEA' : '#FEF6E7'
  const label = score != null ? `Health: ${score}/100` : 'Not scored yet'
  return (
    <div title={label} style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 0 2px ${bg}`, flexShrink: 0 }} />
  )
}

function OwnerAvatar({ user }: { user?: Pick<User, 'id' | 'full_name' | 'email'> | null }) {
  if (!user) return null
  const initials = user.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div title={user.full_name} style={{
      width: 20, height: 20, borderRadius: '50%', background: 'var(--border-2)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-2)', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export function KanbanBoard({ slug, initialDeals }: KanbanBoardProps) {
  const router = useRouter()
  const [deals, setDeals] = useState<DealWithRelations[]>(initialDeals)
  const [showModal, setShowModal] = useState(false)
  const [defaultStage, setDefaultStage] = useState<Deal['stage']>('discovery')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  const dealsByStage = useCallback((stage: Deal['stage']) =>
    deals.filter(d => d.stage === stage && !d.deleted_at),
    [deals]
  )

  const openDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost' && !d.deleted_at)
  const totalValue = openDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0)

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const { draggableId, destination } = result
    const newStage = destination.droppableId as Deal['stage']
    const deal = deals.find(d => d.id === draggableId)
    if (!deal || deal.stage === newStage) return

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === draggableId ? { ...d, stage: newStage } : d))

    fetch(`/api/pipeline/deals/${draggableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    }).then(async (res) => {
      if (!res.ok) {
        // Revert
        setDeals(prev => prev.map(d => d.id === draggableId ? { ...d, stage: deal.stage } : d))
        toast.error('Failed to update deal stage')
      }
    }).catch(() => {
      setDeals(prev => prev.map(d => d.id === draggableId ? { ...d, stage: deal.stage } : d))
      toast.error('Failed to update deal stage')
    })
  }

  function handleDealCreated(deal: DealWithRelations) {
    setDeals(prev => [deal, ...prev])
    setShowModal(false)
  }

  function openNewDeal(stage: Deal['stage'] = 'discovery') {
    setDefaultStage(stage)
    setShowModal(true)
  }

  const symbol = '$'
  const totalFmt = totalValue >= 1000 ? `${symbol}${(totalValue / 1000).toFixed(0)}k` : `${symbol}${totalValue}`

  return (
    <>
      <div className="page-enter">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Total: <strong style={{ color: 'var(--text-1)' }}>{totalFmt}</strong>
            <span style={{ marginLeft: 8 }}>{openDeals.length} open deal{openDeals.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {(['kanban', 'list'] as const).map(v => (
                <button
                  key={v}
                  className={`btn btn-sm ${viewMode === v ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: 0, border: 'none' }}
                  onClick={() => setViewMode(v)}
                >
                  {v === 'kanban' ? '⠿ Kanban' : '☰ List'}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openNewDeal()}>
              <Icon d={Icons.plus} size={13} /> New Deal
            </button>
          </div>
        </div>

        {viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="kanban">
              {STAGES.map(({ key, label, accent }) => {
                const stageDeals = dealsByStage(key)
                return (
                  <div key={key} className="kanban-col" style={{ borderTop: `3px solid ${accent}` }}>
                    <div className="kanban-col-header">
                      <span className="kanban-col-title">
                        {label}
                        <span className="kanban-col-count">{stageDeals.length}</span>
                      </span>
                      <span className="kanban-col-value">{formatColumnValue(stageDeals)}</span>
                    </div>

                    <Droppable droppableId={key}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="kanban-cards"
                          style={{
                            minHeight: 80,
                            background: snapshot.isDraggingOver ? 'rgba(26,73,140,0.04)' : undefined,
                            transition: 'background 0.15s',
                          }}
                        >
                          {stageDeals.map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  className="deal-card"
                                  style={{
                                    ...prov.draggableProps.style,
                                    boxShadow: snap.isDragging ? 'var(--shadow-md)' : 'var(--shadow)',
                                    transform: snap.isDragging
                                      ? `${prov.draggableProps.style?.transform ?? ''} rotate(1deg)`
                                      : prov.draggableProps.style?.transform,
                                  }}
                                  onClick={() => router.push(`/${slug}/pipeline/${deal.id}`)}
                                >
                                  <div className="deal-card-name">{deal.name}</div>
                                  <div className="deal-card-company" style={{ marginBottom: 6 }}>
                                    {deal.accounts?.name ?? '—'}
                                  </div>
                                  {deal.close_date && (
                                    <div style={{ marginBottom: 8 }}>
                                      <CloseDateDisplay dateStr={deal.close_date} />
                                    </div>
                                  )}
                                  <div className="deal-card-footer">
                                    <span className="deal-card-value">{formatValue(deal)}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <OwnerAvatar user={deal.users} />
                                      <HealthDot health={deal.health} score={deal.ai_health_score} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {stageDeals.length === 0 && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{
                                width: '100%', justifyContent: 'center', color: 'var(--text-3)',
                                fontSize: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
                              }}
                              onClick={() => openNewDeal(key)}
                            >
                              <Icon d={Icons.plus} size={12} /> Add deal
                            </button>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Company</th>
                    <th>Stage</th>
                    <th>Value</th>
                    <th>Close date</th>
                    <th>Health</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.filter(d => !d.deleted_at).map(deal => (
                    <tr key={deal.id} onClick={() => router.push(`/${slug}/pipeline/${deal.id}`)}>
                      <td style={{ fontWeight: 500 }}>{deal.name}</td>
                      <td style={{ color: 'var(--text-3)' }}>{deal.accounts?.name ?? '—'}</td>
                      <td>
                        <span className="tag">{STAGES.find(s => s.key === deal.stage)?.label ?? deal.stage}</span>
                      </td>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{formatValue(deal)}</td>
                      <td><CloseDateDisplay dateStr={deal.close_date} /></td>
                      <td><HealthDot health={deal.health} score={deal.ai_health_score} /></td>
                      <td style={{ color: 'var(--text-3)', fontSize: 13 }}>{deal.users?.full_name ?? '—'}</td>
                    </tr>
                  ))}
                  {deals.filter(d => !d.deleted_at).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>
                        No deals yet. Create your first deal to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewDealModal
          slug={slug}
          defaultStage={defaultStage}
          onClose={() => setShowModal(false)}
          onCreated={handleDealCreated}
        />
      )}
    </>
  )
}

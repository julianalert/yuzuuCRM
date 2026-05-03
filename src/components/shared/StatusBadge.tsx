import type { AccountStatus } from '@/lib/types'

const labels: Record<AccountStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  in_progress: 'In Progress',
  qualified: 'Qualified',
  not_a_fit: 'Not a Fit',
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={`status status-${status}`}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'currentColor',
          display: 'inline-block',
        }}
      />
      {labels[status]}
    </span>
  )
}

/**
 * daily-opportunities.ts
 *
 * Email template for the daily digest. Lists new hot leads from the last
 * 24 hours, capped at 10. Designed to look identical to the welcome
 * template so the user recognises Yuzuu in their inbox.
 */

export interface DigestLead {
  name: string
  category: string | null
  city: string | null
  signals: Array<{ label: string }>
  intentScore: number
  url: string
}

export interface DailyOpportunitiesParams {
  agencyName: string
  ownerName: string
  leads: DigestLead[]
  dashboardUrl: string
  totalHotInLast24h: number
  unsubscribeUrl?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function dailyOpportunitiesSubject(params: { agencyName: string; count: number }): string {
  const { agencyName, count } = params
  return `${count} new high-intent opportunit${count === 1 ? 'y' : 'ies'} for ${agencyName}`
}

export function dailyOpportunitiesHtml(params: DailyOpportunitiesParams): string {
  const { agencyName, ownerName, leads, dashboardUrl, totalHotInLast24h } = params

  const moreNote = totalHotInLast24h > leads.length
    ? `<p style="font-size:13px;color:#6B6860;margin:0 0 24px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
       Showing the top ${leads.length} by intent score — ${totalHotInLast24h - leads.length} more are waiting in your dashboard.
       </p>`
    : ''

  const leadRow = (lead: DigestLead, isLast: boolean) => {
    const cityChip = lead.city
      ? `<span style="color:#6B6860;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(lead.city)}</span>`
      : ''
    const categoryChip = lead.category
      ? `<span style="color:#6B6860;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(lead.category)}</span>`
      : ''
    const sep = (lead.city && lead.category) ? '<span style="color:#A8A49C;margin:0 6px;">·</span>' : ''

    const signalChips = lead.signals.slice(0, 3).map((s) =>
      `<span style="display:inline-block;font-size:11px;font-weight:500;background:#FEF6E7;color:#92580A;padding:2px 8px;border-radius:99px;margin-right:6px;margin-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(s.label)}</span>`
    ).join('')

    return `
    <tr>
      <td style="padding:14px 0;${isLast ? '' : 'border-bottom:1px solid #E8E6E1;'}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:top;padding:0 10px 0 0;">
              <a href="${dashboardUrl}" style="color:#1A1916;text-decoration:none;font-size:14px;font-weight:600;line-height:1.35;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(lead.name)}</a>
              <div style="margin-top:3px;">${categoryChip}${sep}${cityChip}</div>
              <div style="margin-top:2px;">${signalChips}</div>
            </td>
            <td style="vertical-align:top;text-align:right;padding:0;">
              <span style="display:inline-block;background:#1A1916;color:#fff;font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${lead.intentScore}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
  }

  const rows = leads.map((l, i) => leadRow(l, i === leads.length - 1)).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:32px 20px;background:#F7F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;">
    <div style="padding:36px 36px 28px;border-bottom:1px solid #E8E6E1;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;padding:0 10px 0 0;">
            <div style="width:28px;height:28px;line-height:28px;text-align:center;background:#1A1916;border-radius:6px;color:#fff;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;mso-line-height-rule:exactly;">Y</div>
          </td>
          <td style="vertical-align:middle;padding:0;font-size:15px;font-weight:600;color:#1A1916;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Yuzuu</td>
        </tr>
      </table>
    </div>
    <div style="padding:36px 36px 36px;">
      <h1 style="font-size:22px;font-weight:700;color:#1A1916;margin:0 0 8px;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${leads.length} new high-intent opportunit${leads.length === 1 ? 'y' : 'ies'} today</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 20px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Hi ${escapeHtml(ownerName)}, these businesses appeared in ${escapeHtml(agencyName)}'s market in the last 24 hours and show clear buying signals for your services.</p>
      ${moreNote}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
        <tbody>${rows}</tbody>
      </table>
      <a href="${dashboardUrl}" style="display:inline-block;background:#1A1916;color:white;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Open the Hot tab →
      </a>
    </div>
    <div style="padding:24px 36px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      Yuzuu${params.unsubscribeUrl ? ` · <a href="${params.unsubscribeUrl}" style="color:#A8A49C;">Unsubscribe</a>` : ''}
    </div>
  </div>
</body>
</html>`
}

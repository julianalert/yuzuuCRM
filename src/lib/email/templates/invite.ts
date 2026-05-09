export interface InviteEmailParams {
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  toEmail: string
}

function formatRolePhrase(role: string): { article: string; label: string } {
  const r = role.trim().toLowerCase()
  const label = r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Member'
  const article = /^[aeiou]/i.test(label) ? 'an' : 'a'
  return { article, label }
}

export function inviteEmailHtml(params: InviteEmailParams): string {
  const { inviterName, workspaceName, role, inviteUrl } = params
  const { article, label } = formatRolePhrase(role)

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
    <div style="padding:40px 36px 44px;">
      <h1 style="font-size:22px;font-weight:700;color:#1A1916;margin:0 0 10px;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">You've been invited</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 28px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <strong style="color:#1A1916;">${inviterName}</strong> has invited you to join
        <strong style="color:#1A1916;">${workspaceName}</strong> on Yuzuu as ${article} <strong style="color:#1A1916;">${label}</strong>.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#1A1916;color:white;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Accept invitation →
      </a>
      <p style="font-size:12px;color:#A8A49C;margin:28px 0 0;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">This invitation expires in 7 days. If you didn't expect this, you can ignore this email.</p>
    </div>
    <div style="padding:24px 36px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      Yuzuu · <a href="#" style="color:#A8A49C;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

export function inviteEmailText(params: InviteEmailParams): string {
  const { article, label } = formatRolePhrase(params.role)
  return `${params.inviterName} invited you to join ${params.workspaceName} on Yuzuu as ${article} ${label}.

Accept invitation: ${params.inviteUrl}

This invitation expires in 7 days. If you didn't expect this, ignore this email.`
}

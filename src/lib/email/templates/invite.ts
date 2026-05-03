export interface InviteEmailParams {
  inviterName: string
  workspaceName: string
  role: string
  inviteUrl: string
  toEmail: string
}

export function inviteEmailHtml(params: InviteEmailParams): string {
  const { inviterName, workspaceName, role, inviteUrl } = params
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F7F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 32px;border-bottom:1px solid #E8E6E1;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:26px;height:26px;background:#1A1916;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:13px;">Y</div>
        <span style="font-size:15px;font-weight:600;color:#1A1916;margin-left:8px;">Yuzuu</span>
      </div>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:22px;font-weight:700;color:#1A1916;margin:0 0 8px;">You've been invited</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 24px;">
        <strong style="color:#1A1916;">${inviterName}</strong> has invited you to join 
        <strong style="color:#1A1916;">${workspaceName}</strong> as <strong style="color:#1A1916;">${role}</strong>.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:#1A1916;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">
        Accept invitation →
      </a>
      <p style="font-size:12px;color:#A8A49C;margin:24px 0 0;">This invitation expires in 7 days. If you didn't expect this, you can ignore this email.</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;">
      Yuzuu · <a href="#" style="color:#A8A49C;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

export function inviteEmailText(params: InviteEmailParams): string {
  return `${params.inviterName} invited you to join ${params.workspaceName} as ${params.role} on Yuzuu.

Accept invitation: ${params.inviteUrl}

This invitation expires in 7 days. If you didn't expect this, ignore this email.`
}

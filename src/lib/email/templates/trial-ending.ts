export interface TrialEndingEmailParams {
  fullName: string
  daysRemaining: number
  accountCount: number
  upgradeUrl: string
  toEmail: string
}

export function trialEndingEmailHtml(params: TrialEndingEmailParams): string {
  const { fullName, daysRemaining, accountCount, upgradeUrl } = params
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F7F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;">
    <div style="background:#1E6B45;padding:16px 32px;">
      <span style="color:white;font-weight:600;font-size:14px;">Yuzuu</span>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:22px;font-weight:700;color:#1A1916;margin:0 0 8px;">Your trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 16px;">Hi ${fullName}, your Yuzuu trial is almost over.</p>
      <p style="font-size:14px;color:#6B6860;margin:0 0 24px;">
        You've built a TAM of <strong style="color:#1A1916;">${accountCount} accounts</strong>, all scored by AI. 
        Don't lose your data — upgrade to keep access.
      </p>
      <a href="${upgradeUrl}" style="display:inline-block;background:#1A1916;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">
        Upgrade now →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;">
      Yuzuu · <a href="#" style="color:#A8A49C;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

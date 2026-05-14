export interface WelcomeEmailParams {
  fullName: string
  workspaceName: string
  dashboardUrl: string
  toEmail: string
}

export function welcomeEmailHtml(params: WelcomeEmailParams): string {
  const { fullName, dashboardUrl } = params

  const stepRow = (n: string, title: string, body: string, bottomPad: number) => `
  <tr>
    <td style="vertical-align:top;padding:0 0 ${bottomPad}px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="width:32px;min-width:32px;padding:0 18px 0 0;vertical-align:top;">
            <div style="width:28px;height:28px;line-height:28px;text-align:center;background:#1A1916;border-radius:50%;color:#fff;font-size:12px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;mso-line-height-rule:exactly;">${n}</div>
          </td>
          <td style="vertical-align:top;padding:0;">
            <strong style="display:block;color:#1A1916;font-size:14px;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${title}</strong>
            <span style="display:block;font-size:13px;color:#6B6860;line-height:1.55;margin-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${body}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`

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
      <h1 style="font-size:24px;font-weight:700;color:#1A1916;margin:0 0 12px;line-height:1.2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Your first leads are waiting for you</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 28px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Hi ${fullName}, your workspace is set up and Yuzuu is already scanning Google Maps. You have hot opportunities waiting — businesses that genuinely need what you offer, ranked by buying signals.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 28px;">
        <tbody>
          ${stepRow(
            '1',
            'Hot opportunities scored for your offer',
            'Every lead is ranked by how much they need exactly what you sell. No cold lists — only businesses with real buying signals matched to your services.',
            14,
          )}
          ${stepRow(
            '2',
            'Instant outreach, ready to send',
            'Enrich any lead to unlock a personalised cold email written by AI, tailored to their website, reviews, and your offer.',
            14,
          )}
          ${stepRow(
            '3',
            'New leads, every single day',
            'Your agent scans Google Maps daily and surfaces fresh prospects automatically. No manual prospecting, no wasted time.',
            0,
          )}
        </tbody>
      </table>
      <a href="${dashboardUrl}" style="display:inline-block;background:#1A1916;color:white;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        View my leads →
      </a>
    </div>
    <div style="padding:24px 36px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      Yuzuu · <a href="#" style="color:#A8A49C;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

export interface WelcomeEmailParams {
  fullName: string
  workspaceName: string
  dashboardUrl: string
  toEmail: string
}

export function welcomeEmailHtml(params: WelcomeEmailParams): string {
  const { fullName, workspaceName, dashboardUrl } = params
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F7F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;">
    <div style="padding:28px 32px;border-bottom:1px solid #E8E6E1;">
      <div style="width:26px;height:26px;background:#1A1916;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:13px;">Y</div>
      <span style="font-size:15px;font-weight:600;color:#1A1916;margin-left:8px;">Yuzuu</span>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:22px;font-weight:700;color:#1A1916;margin:0 0 8px;">Welcome to Yuzuu, ${fullName}!</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 24px;">Your workspace <strong style="color:#1A1916;">${workspaceName}</strong> is ready. Here's what to do next:</p>
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <div style="width:24px;height:24px;background:#1A1916;border-radius:50%;color:white;font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">1</div>
          <div><strong style="color:#1A1916;">Build your ICP</strong><br><span style="font-size:13px;color:#6B6860;">Define your ideal customer profile to target the right accounts.</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <div style="width:24px;height:24px;background:#1A1916;border-radius:50%;color:white;font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">2</div>
          <div><strong style="color:#1A1916;">Review your TAM</strong><br><span style="font-size:13px;color:#6B6860;">Explore AI-scored accounts matching your ICP.</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:24px;height:24px;background:#1A1916;border-radius:50%;color:white;font-size:12px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">3</div>
          <div><strong style="color:#1A1916;">Invite your team</strong><br><span style="font-size:13px;color:#6B6860;">Collaborate with your sales team in one workspace.</span></div>
        </div>
      </div>
      <a href="${dashboardUrl}" style="display:inline-block;background:#1A1916;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">
        Get started →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;">
      Yuzuu · <a href="#" style="color:#A8A49C;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

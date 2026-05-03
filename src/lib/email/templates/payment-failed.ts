export interface PaymentFailedEmailParams {
  fullName: string
  billingPortalUrl: string
  toEmail: string
}

export function paymentFailedEmailHtml(params: PaymentFailedEmailParams): string {
  const { fullName, billingPortalUrl } = params
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F7F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;">
    <div style="background:#9B2222;padding:16px 32px;">
      <span style="color:white;font-weight:600;font-size:14px;">Yuzuu — Action Required</span>
    </div>
    <div style="padding:32px;">
      <h1 style="font-size:22px;font-weight:700;color:#1A1916;margin:0 0 8px;">Payment failed</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 16px;">Hi ${fullName},</p>
      <p style="font-size:14px;color:#6B6860;margin:0 0 24px;">
        We couldn't process your payment for Yuzuu. Update your payment method to avoid losing access to your workspace and all your data.
      </p>
      <a href="${billingPortalUrl}" style="display:inline-block;background:#9B2222;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;">
        Update payment method →
      </a>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;">
      Yuzuu · <a href="#" style="color:#A8A49C;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
}

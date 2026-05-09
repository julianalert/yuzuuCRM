export interface PaymentFailedEmailParams {
  fullName: string
  billingPortalUrl: string
  toEmail: string
}

function brandHeader(): string {
  return `<div style="padding:36px 36px 28px;border-bottom:1px solid #E8E6E1;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;padding:0 10px 0 0;">
            <div style="width:28px;height:28px;line-height:28px;text-align:center;background:#1A1916;border-radius:6px;color:#fff;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;mso-line-height-rule:exactly;">Y</div>
          </td>
          <td style="vertical-align:middle;padding:0;font-size:15px;font-weight:600;color:#1A1916;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Yuzuu</td>
        </tr>
      </table>
    </div>`
}

function emailFooter(): string {
  return `<div style="padding:24px 36px 32px;border-top:1px solid #E8E6E1;font-size:12px;color:#A8A49C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      Yuzuu · <a href="#" style="color:#A8A49C;">Unsubscribe</a>
    </div>`
}

export function paymentFailedEmailHtml(params: PaymentFailedEmailParams): string {
  const { fullName, billingPortalUrl } = params

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:32px 20px;background:#F7F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E6E1;border-radius:12px;overflow:hidden;border-top:3px solid #9B2222;">
    ${brandHeader()}
    <div style="padding:40px 36px 44px;">
      <p style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9B2222;margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Action required</p>
      <h1 style="font-size:22px;font-weight:700;color:#1A1916;margin:0 0 10px;line-height:1.25;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">We couldn&rsquo;t process your payment</h1>
      <p style="font-size:14px;color:#6B6860;margin:0 0 16px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Hi ${fullName},</p>
      <p style="font-size:14px;color:#6B6860;margin:0 0 16px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Your last charge for Yuzuu didn&rsquo;t go through. Update your payment method in billing so your workspace stays active and you don&rsquo;t lose access to your leads and data.
      </p>
      <p style="font-size:14px;color:#6B6860;margin:0 0 28px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Common causes: expired card, insufficient funds, or a bank block. Fixing it usually takes less than a minute.
      </p>
      <a href="${billingPortalUrl}" style="display:inline-block;background:#1A1916;color:white;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Open billing settings →
      </a>
    </div>
    ${emailFooter()}
  </div>
</body>
</html>`
}

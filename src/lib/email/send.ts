import { resend } from './client'
import { inviteEmailHtml, inviteEmailText, type InviteEmailParams } from './templates/invite'
import { welcomeEmailHtml, type WelcomeEmailParams } from './templates/welcome'
import { trialEndingEmailHtml, type TrialEndingEmailParams } from './templates/trial-ending'
import { paymentFailedEmailHtml, type PaymentFailedEmailParams } from './templates/payment-failed'

const FROM = 'Yuzuu <noreply@yuzuu.co>'

export async function sendInviteEmail(params: InviteEmailParams): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.toEmail,
      subject: `${params.inviterName} invited you to join ${params.workspaceName} on Yuzuu`,
      html: inviteEmailHtml(params),
      text: inviteEmailText(params),
    })
  } catch (err) {
    console.error('[Email] Failed to send invite email:', err)
  }
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.toEmail,
      subject: 'Welcome to Yuzuu — let\'s build your TAM',
      html: welcomeEmailHtml(params),
    })
  } catch (err) {
    console.error('[Email] Failed to send welcome email:', err)
  }
}

export async function sendTrialEndingEmail(params: TrialEndingEmailParams): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.toEmail,
      subject: 'Your Yuzuu trial ends in 3 days',
      html: trialEndingEmailHtml(params),
    })
  } catch (err) {
    console.error('[Email] Failed to send trial ending email:', err)
  }
}

export async function sendPaymentFailedEmail(params: PaymentFailedEmailParams): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.toEmail,
      subject: 'Action required: Payment failed for Yuzuu',
      html: paymentFailedEmailHtml(params),
    })
  } catch (err) {
    console.error('[Email] Failed to send payment failed email:', err)
  }
}

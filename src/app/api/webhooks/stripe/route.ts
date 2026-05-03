import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlanFromPriceId } from '@/lib/stripe/plans'
import { sendPaymentFailedEmail } from '@/lib/email/send'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const workspaceId = session.metadata?.workspace_id
        if (!workspaceId) break

        const subscription = session.subscription
          ? await getStripe().subscriptions.retrieve(session.subscription as string)
          : null

        const priceId = subscription?.items.data[0]?.price.id
        const plan = priceId ? getPlanFromPriceId(priceId) : 'starter'

        await supabase.from('workspaces').update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan,
          subscription_status: subscription?.status === 'trialing' ? 'trialing' : 'active',
        }).eq('id', workspaceId)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const workspaceId = sub.metadata?.workspace_id
        if (!workspaceId) break

        const priceId = sub.items.data[0]?.price.id
        const plan = priceId ? getPlanFromPriceId(priceId) : 'starter'

        let status: 'active' | 'trialing' | 'past_due' | 'canceled' = 'active'
        if (sub.status === 'trialing') status = 'trialing'
        else if (sub.status === 'past_due') status = 'past_due'
        else if (sub.status === 'canceled') status = 'canceled'

        await supabase.from('workspaces').update({
          plan,
          subscription_status: status,
        }).eq('id', workspaceId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const workspaceId = sub.metadata?.workspace_id
        if (!workspaceId) break

        await supabase.from('workspaces').update({
          plan: 'free',
          subscription_status: 'canceled',
        }).eq('id', workspaceId)

        // Send cancellation notification to owner
        const { data: owner } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('workspace_id', workspaceId)
          .eq('role', 'owner')
          .single()

        if (owner) {
          await sendPaymentFailedEmail({
            fullName: owner.full_name,
            billingPortalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
            toEmail: owner.email,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id, slug')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!workspace) break

        await supabase.from('workspaces').update({
          subscription_status: 'past_due',
        }).eq('id', workspace.id)

        const { data: owner } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('workspace_id', workspace.id)
          .eq('role', 'owner')
          .single()

        if (owner) {
          await sendPaymentFailedEmail({
            fullName: owner.full_name,
            billingPortalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${workspace.slug}/settings/billing`,
            toEmail: owner.email,
          })
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        await supabase.from('workspaces').update({
          subscription_status: 'active',
        }).eq('stripe_customer_id', customerId)
        break
      }
    }
  } catch (err) {
    console.error('[Stripe Webhook] Handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

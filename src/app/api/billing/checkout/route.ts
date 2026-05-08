import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { getStripe } from '@/lib/stripe/client'

export async function POST(req: Request) {
  try {
    const { workspace } = await requireAuth()
    const { price_id, success_url, cancel_url } = await req.json() as {
      price_id: string
      success_url: string
      cancel_url: string
    }

    if (!price_id) {
      return NextResponse.json({ error: 'price_id is required' }, { status: 400 })
    }

    const customerId = workspace.stripe_customer_id ?? undefined

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: success_url ?? `${process.env.NEXT_PUBLIC_APP_URL}/${workspace.slug}/settings/billing?checkout=success`,
      cancel_url: cancel_url ?? `${process.env.NEXT_PUBLIC_APP_URL}/${workspace.slug}/settings/billing`,
      metadata: { workspace_id: workspace.id },
      subscription_data: {
        metadata: { workspace_id: workspace.id },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return errorResponse(err)
  }
}

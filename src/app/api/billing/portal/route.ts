import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { getStripe } from '@/lib/stripe/client'

export async function POST(_req: Request) {
  try {
    const { workspace } = await requireAuth()

    if (!workspace.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found. Please subscribe first.' }, { status: 400 })
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: workspace.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/${workspace.slug}/settings/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return errorResponse(err)
  }
}

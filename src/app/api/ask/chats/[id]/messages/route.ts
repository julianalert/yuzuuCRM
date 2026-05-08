import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type MessageParam = { role: 'user' | 'assistant'; content: string }

async function buildSystemPrompt(workspaceId: string): Promise<string> {
  const supabase = createServiceClient()

  const [dealsRes, accountsRes, signalsRes] = await Promise.all([
    supabase
      .from('deals')
      .select('name, stage, value, currency, health, last_activity_at, accounts(name)')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('value', { ascending: false })
      .limit(20),
    supabase
      .from('accounts')
      .select('name, industry, ai_score, status, last_activity_at')
      .eq('workspace_id', workspaceId)
      .order('ai_score', { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from('signals')
      .select('title, type, detected_at, accounts(name)')
      .eq('workspace_id', workspaceId)
      .eq('is_read', false)
      .order('detected_at', { ascending: false })
      .limit(10),
  ])

  const deals = dealsRes.data ?? []
  const accounts = accountsRes.data ?? []
  const signals = signalsRes.data ?? []

  const totalValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  const stagesSet = [...new Set(deals.map((d) => d.stage))].join(', ')

  const dealLines = deals
    .map((d) => {
      const company = (d.accounts as { name: string } | null)?.name ?? 'Unknown'
      const val = d.value ? `${d.currency ?? 'USD'} ${d.value.toLocaleString()}` : 'no value'
      const health = d.health ? ` [${d.health}]` : ''
      return `  - ${d.name} (${company}) | ${d.stage} | ${val}${health}`
    })
    .join('\n')

  const accountLines = accounts
    .map((a) => {
      const score = a.ai_score != null ? ` | score ${a.ai_score}` : ''
      return `  - ${a.name} (${a.industry ?? 'unknown industry'}) | ${a.status}${score}`
    })
    .join('\n')

  const signalLines = signals
    .map((s) => {
      const company = (s.accounts as { name: string } | null)?.name ?? ''
      return `  - [${s.type}] ${s.title}${company ? ` (${company})` : ''}`
    })
    .join('\n')

  return `You are Yuzuu AI, an expert sales assistant embedded inside Yuzuu CRM.
You have full real-time visibility on the workspace's pipeline, leads, signals, and activity.
Always refer to prospects as "leads" — never use "TAM" or "Total Addressable Market".

Today's date: ${new Date().toDateString()}

## Open Pipeline (${deals.length} deals — total ${totalValue.toLocaleString()} across ${stagesSet || 'no stages'})
${dealLines || '  (none)'}

## Top Leads by AI Score
${accountLines || '  (none)'}

## Unread Signals
${signalLines || '  (none)'}

Guidelines:
- Be concise, actionable, and specific.
- When referencing companies or deals, use their actual names from context above.
- If asked to draft a message, produce a complete, ready-to-send draft.
- Format responses with markdown (bold, numbered lists) for readability.`
}

async function autoTitleChat(
  chatId: string,
  firstUserMessage: string
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `Write a very short title (4-6 words max, no punctuation) for a sales chat that starts with: "${firstUserMessage.slice(0, 120)}"`,
        },
      ],
    })
    const title =
      res.content[0].type === 'text'
        ? res.content[0].text.trim().replace(/^["']|["']$/g, '')
        : 'New chat'

    await supabase
      .from('ai_chats')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', chatId)
  } catch {
    // Non-critical — silently swallow
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params
    const { user, workspace } = await requireAuth()
    const supabase = createServiceClient()

    // Verify ownership
    const { data: chat, error: chatErr } = await supabase
      .from('ai_chats')
      .select('id, title')
      .eq('id', chatId)
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .single()

    if (chatErr || !chat) {
      return Response.json({ error: 'Chat not found' }, { status: 404 })
    }

    const body = (await req.json()) as { message: string }
    const userMessage = (body.message ?? '').trim()
    if (!userMessage) {
      return Response.json({ error: 'message is required' }, { status: 400 })
    }

    // Persist user message
    await supabase.from('ai_messages').insert({
      chat_id: chatId,
      role: 'user',
      content: userMessage,
    })

    // Fetch conversation history (excluding the just-inserted message for context)
    const { data: history } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    const messages: MessageParam[] = (history ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Build system prompt with live workspace context
    const systemPrompt = await buildSystemPrompt(workspace.id)

    // Check if this is the first user message → auto-title in background
    const userTurns = messages.filter((m) => m.role === 'user')
    if (userTurns.length === 1 && chat.title === 'New chat') {
      void autoTitleChat(chatId, userMessage)
    }

    // Stream Anthropic response
    const encoder = new TextEncoder()
    let fullResponse = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            system: systemPrompt,
            messages,
            stream: true,
          })

          for await (const event of anthropicStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const chunk = event.delta.text
              fullResponse += chunk
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`))
            }
          }

          // Persist assistant reply
          await supabase.from('ai_messages').insert({
            chat_id: chatId,
            role: 'assistant',
            content: fullResponse,
          })

          // Bump updated_at on chat
          await supabase
            .from('ai_chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chatId)

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}

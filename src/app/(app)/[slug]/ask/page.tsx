'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function renderContent(text: string) {
  return text.split('**').map((part, j) =>
    j % 2 === 0 ? part : <strong key={j}>{part}</strong>
  )
}

const SUGGESTIONS = [
  'What should I do today?',
  'Which deals are most at risk?',
  'Which leads should I prioritize this week?',
  'Draft a follow-up for my top deal',
]

// ── Trash icon ───────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 4 13 4" />
      <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M6 7v5M10 7v5" />
      <path d="M4 4l1 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-9" />
    </svg>
  )
}

// ── Plus icon ────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="2" y1="8" x2="14" y2="8" />
    </svg>
  )
}

// ── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="msg msg-ai">
      <div className="msg-bubble" style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '12px 16px' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--text-3)',
              display: 'inline-block',
              animation: 'typing-bounce 1.2s infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AskPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // When sendMessage creates a brand-new chat it sets activeChatId, which
  // would normally trigger the loadMessages effect and wipe the optimistic
  // user bubble.  This ref tells that effect to skip one fetch.
  const skipNextMessageLoad = useRef(false)

  // ── Scroll to bottom on new messages ──────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // ── Auto-resize textarea ──────────────────────────────────────────────────

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  // ── Load chat list on mount ───────────────────────────────────────────────

  useEffect(() => {
    async function loadChats() {
      setIsLoadingChats(true)
      try {
        const res = await fetch('/api/ask/chats')
        const data = await res.json() as { chats: Chat[] }
        setChats(data.chats ?? [])
        if (data.chats?.length > 0) {
          setActiveChatId(data.chats[0].id)
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingChats(false)
      }
    }
    void loadChats()
  }, [])

  // ── Load messages when active chat changes ────────────────────────────────

  useEffect(() => {
    if (!activeChatId) {
      setMessages([])
      return
    }
    // Skip fetch when sendMessage just created this chat — it will populate
    // messages itself via the optimistic update + streaming response.
    if (skipNextMessageLoad.current) {
      skipNextMessageLoad.current = false
      return
    }
    async function loadMessages() {
      setIsLoadingMessages(true)
      try {
        const res = await fetch(`/api/ask/chats/${activeChatId}`)
        const data = await res.json() as { messages: Message[] }
        setMessages(data.messages ?? [])
      } catch {
        // ignore
      } finally {
        setIsLoadingMessages(false)
      }
    }
    void loadMessages()
  }, [activeChatId])

  // ── Create new chat ───────────────────────────────────────────────────────

  const createChat = useCallback(async () => {
    try {
      const res = await fetch('/api/ask/chats', { method: 'POST' })
      const data = await res.json() as { chat: Chat }
      setChats((prev) => [data.chat, ...prev])
      setActiveChatId(data.chat.id)
      setMessages([])
      setInput('')
      textareaRef.current?.focus()
    } catch {
      // ignore
    }
  }, [])

  // ── Delete chat ───────────────────────────────────────────────────────────

  const deleteChat = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/ask/chats/${id}`, { method: 'DELETE' })
      setChats((prev) => prev.filter((c) => c.id !== id))
      if (activeChatId === id) {
        setActiveChatId(null)
        setMessages([])
      }
    } catch {
      // ignore
    }
  }, [activeChatId])

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const userMessage = (text ?? input).trim()
    if (!userMessage || isStreaming) return

    // If no active chat, create one first
    let chatId = activeChatId
    if (!chatId) {
      try {
        const res = await fetch('/api/ask/chats', { method: 'POST' })
        const data = await res.json() as { chat: Chat }
        chatId = data.chat.id
        setChats((prev) => [data.chat, ...prev])
        skipNextMessageLoad.current = true
        setActiveChatId(chatId)
      } catch {
        return
      }
    }

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)
    setStreamingContent('')

    try {
      const res = await fetch(`/api/ask/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Failed to send message')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') {
            setMessages((prev) => [...prev, { role: 'assistant', content: full }])
            setStreamingContent('')
            setIsStreaming(false)
            // Update chat title in list (API may have auto-titled it)
            const updatedRes = await fetch('/api/ask/chats')
            const updatedData = await updatedRes.json() as { chats: Chat[] }
            setChats(updatedData.chats ?? [])
            return
          }
          try {
            const parsed = JSON.parse(payload) as { chunk?: string; error?: string }
            if (parsed.chunk) {
              full += parsed.chunk
              setStreamingContent(full)
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [activeChatId, input, isStreaming])

  // ── Key handler ───────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showSuggestions = messages.length === 0 && !isStreaming && !isLoadingMessages

  return (
    <>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        /* Make the content wrapper a fixed-size flex container so the chat fills it exactly */
        main.content:has(.chat-layout) {
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 16px;
        }
      `}</style>

      <div
        className="page-enter chat-layout"
        style={{ height: '100%' }}
      >
        {/* ── Left panel: chat thread list ──────────────────────────────── */}
        <div className="chat-threads">
          <div className="chat-threads-header">
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%', justifyContent: 'center', gap: 6 }}
              onClick={() => void createChat()}
            >
              <PlusIcon />
              New chat
            </button>
          </div>

          <div className="chat-threads-list">
            {isLoadingChats && (
              <div style={{ padding: '16px 12px', color: 'var(--text-3)', fontSize: 13 }}>
                Loading…
              </div>
            )}
            {!isLoadingChats && chats.length === 0 && (
              <div style={{ padding: '16px 12px', color: 'var(--text-3)', fontSize: 13 }}>
                No chats yet
              </div>
            )}
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`chat-thread-item${activeChatId === chat.id ? ' active' : ''}`}
                onClick={() => setActiveChatId(chat.id)}
              >
                <div className="chat-thread-body">
                  <div className="chat-thread-title">{chat.title}</div>
                  <div className="chat-thread-date">{relativeTime(chat.updated_at)}</div>
                </div>
                <button
                  className="chat-thread-delete"
                  title="Delete chat"
                  onClick={(e) => void deleteChat(chat.id, e)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel: messages + input ─────────────────────────────── */}
        <div className="chat-main">
          {/* Messages */}
          <div className="chat-messages">
            {!activeChatId && !isLoadingChats && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--text-3)',
                  textAlign: 'center',
                  paddingBottom: 80,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>✨</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>Yuzuu AI</div>
                <div style={{ fontSize: 14, maxWidth: 340 }}>
                  Your AI sales assistant. Ask anything about your pipeline, leads, and deals.
                </div>
              </div>
            )}

            {isLoadingMessages && (
              <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '16px 0' }}>
                Loading messages…
              </div>
            )}

            {!isLoadingMessages &&
              messages.map((m, i) => (
                <div
                  key={m.id ?? i}
                  className={`msg msg-${m.role === 'user' ? 'user' : 'ai'}`}
                  style={{ maxWidth: 680 }}
                >
                  <div className="msg-bubble" style={{ whiteSpace: 'pre-line' }}>
                    {renderContent(m.content)}
                  </div>
                  <div className="msg-meta">
                    {m.role === 'assistant' ? '✨ Yuzuu AI' : 'You'}
                    {m.created_at ? ` · ${relativeTime(m.created_at)}` : ''}
                  </div>
                </div>
              ))}

            {/* Streaming in-progress bubble */}
            {isStreaming && !streamingContent && <TypingDots />}
            {isStreaming && streamingContent && (
              <div className="msg msg-ai" style={{ maxWidth: 680 }}>
                <div className="msg-bubble" style={{ whiteSpace: 'pre-line' }}>
                  {renderContent(streamingContent)}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      background: 'var(--text-3)',
                      marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      animation: 'typing-bounce 1s infinite',
                    }}
                  />
                </div>
                <div className="msg-meta">✨ Yuzuu AI</div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="chat-input-wrap">
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {showSuggestions && (
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="chat-suggestion"
                      onClick={() => void sendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="chat-input-row">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Ask anything about your pipeline and leads…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isStreaming}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flexShrink: 0, alignSelf: 'flex-end' }}
                  onClick={() => void sendMessage()}
                  disabled={isStreaming || !input.trim()}
                >
                  {isStreaming ? '…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import { useState } from 'react'

const suggestions = [
  'What should I do today?',
  'Which deals are most at risk?',
  'Draft a follow-up for Qonto',
  'Who should I contact in my TAM first?',
]

const initialMessages = [
  {
    role: 'ai',
    text: "Hey 👋 I'm your AI CRO. I have full visibility on your pipeline, TAM, signals, and activity. What do you want to tackle?",
    time: 'Just now',
  },
  {
    role: 'user',
    text: 'What should I do today?',
    time: '2 min ago',
  },
  {
    role: 'ai',
    text: "Here are your top 3 priorities for today:\n\n**1. Follow up with Qonto ($52k)** — No activity in 8 days. Their tone shifted cautious in the last call. Send a short, low-pressure check-in today.\n\n**2. Book demo with Mistral AI** — They replied positively yesterday and requested pricing. Strike while the signal is hot.\n\n**3. Enroll Doctrine in your outbound sequence** — They sent an inbound inquiry 20 hours ago. High intent. Don't let this go cold.",
    time: '2 min ago',
  },
]

function renderText(text: string) {
  return text.split('**').map((part, j) =>
    j % 2 === 0 ? part : <strong key={j}>{part}</strong>
  )
}

export default function AskPage() {
  const [input, setInput] = useState('')
  const [messages] = useState(initialMessages)

  return (
    <div
      className="page-enter"
      style={{
        height: 'calc(100vh - var(--header-h) - 48px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}`}>
              <div className="msg-bubble" style={{ whiteSpace: 'pre-line' }}>
                {renderText(m.text)}
              </div>
              <div className="msg-meta">
                {m.role === 'ai' ? '✨ Yuzuu AI' : 'You'} · {m.time}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="chat-suggestions">
            {suggestions.map((s) => (
              <button key={s} className="chat-suggestion" onClick={() => setInput(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Ask anything about your pipeline…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client";

import { useState } from "react";

// ─── Icons ────────────────────────────────────────────────────────────────────
interface IconProps {
  d: string | readonly string[];
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const Icon = ({ d, size = 16, stroke = "currentColor", fill = "none", strokeWidth = 1.5, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d as string} />}
  </svg>
);

const Icons = {
  dashboard:    "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  tam:          "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  signals:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  sequences:    "M22 12h-4l-3 9L9 3l-3 9H2",
  pipeline:     ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  capture:      "M12 2a10 10 0 100 20A10 10 0 0012 2z M12 6v6l4 2",
  ask:          "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  settings:     "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  chevronRight: "M9 18l6-6-6-6",
  chevronDown:  "M6 9l6 6 6-6",
  plus:         "M12 5v14M5 12h14",
  search:       "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  bell:         "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  user:         "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8",
  logout:       "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  team:         "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  billing:      "M3 10h18M7 15h2m4 0h4M3 6l9-3 9 3v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z",
  integrations: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  filter:       "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  arrowUp:      "M12 19V5M5 12l7-7 7 7",
  star:         "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  zap:          "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  trendUp:      "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  dot:          "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0",
  check:        "M20 6L9 17l-5-5",
  mail:         "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  phone:        "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.08 6.08l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z",
  building:     "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  x:            "M18 6L6 18M6 6l12 12",
} as const;

// ─── Data ─────────────────────────────────────────────────────────────────────
type AccountStatus = "new" | "contacted" | "in_progress" | "qualified" | "not_a_fit";

const accounts = [
  { id: 1, name: "Mistral AI",  domain: "mistral.ai",    industry: "AI / ML",         size: "51–200",   location: "Paris, FR", score: 94, status: "in_progress" as AccountStatus, contact: "Arthur Mensch",            title: "CEO" },
  { id: 2, name: "Alan",        domain: "alan.com",       industry: "Health Insurance", size: "201–500",  location: "Paris, FR", score: 87, status: "contacted"   as AccountStatus, contact: "Jean-Charles Samuelian",   title: "CEO" },
  { id: 3, name: "Pennylane",   domain: "pennylane.com",  industry: "Fintech",          size: "201–500",  location: "Paris, FR", score: 81, status: "new"         as AccountStatus, contact: "Arthur Waller",           title: "CEO" },
  { id: 4, name: "Qonto",       domain: "qonto.com",      industry: "Fintech",          size: "501–1000", location: "Paris, FR", score: 78, status: "qualified"   as AccountStatus, contact: "Steve Anavi",             title: "COO" },
  { id: 5, name: "Doctrine",    domain: "doctrine.fr",    industry: "LegalTech",        size: "51–200",   location: "Paris, FR", score: 71, status: "new"         as AccountStatus, contact: "Nicolas Bustamante",      title: "CEO" },
  { id: 6, name: "Spendesk",    domain: "spendesk.com",   industry: "Fintech",          size: "201–500",  location: "Paris, FR", score: 65, status: "not_a_fit"   as AccountStatus, contact: "Rodolphe Ardant",         title: "CEO" },
  { id: 7, name: "PayFit",      domain: "payfit.com",     industry: "HR Tech",          size: "501–1000", location: "Paris, FR", score: 58, status: "new"         as AccountStatus, contact: "Firmin Zocchetto",        title: "CEO" },
];

type Health = "green" | "amber" | "red";

const deals: Record<string, { id: number; name: string; company: string; value: string; health: Health }[]> = {
  discovery:   [{ id: 1, name: "RevOps Automation", company: "Mistral AI", value: "$24,000", health: "green" }, { id: 2, name: "Sales Suite",   company: "Doctrine",  value: "$18,000", health: "amber" }],
  demo:        [{ id: 3, name: "Full Platform",      company: "Alan",       value: "$36,000", health: "green" }, { id: 4, name: "Starter Plan", company: "Pennylane", value: "$8,400",  health: "green" }],
  proposal:    [{ id: 5, name: "Growth Plan",        company: "Qonto",      value: "$52,000", health: "amber" }],
  negotiation: [{ id: 6, name: "Enterprise",         company: "Spendesk",   value: "$96,000", health: "red"   }],
  closed_won:  [{ id: 7, name: "Growth Plan",        company: "PayFit",     value: "$28,800", health: "green" }],
};

const signals = [
  { id: 1, company: "Mistral AI",  type: "funding", icon: "💰", title: "Raised $600M Series B",            meta: "Funding · mistral.ai",    time: "2h ago",  bg: "#EBF5F0", relevance: 98 },
  { id: 2, company: "Alan",        type: "hiring",  icon: "🧑‍💼", title: "Hiring Head of Sales EMEA",         meta: "Hiring signal · alan.com",  time: "4h ago",  bg: "#EBF1FA", relevance: 85 },
  { id: 3, company: "Pennylane",   type: "tech",    icon: "🛠️", title: "Dropped Salesforce from stack",     meta: "Tech change · pennylane.com", time: "1d ago",  bg: "#FEF6E7", relevance: 92 },
  { id: 4, company: "Qonto",       type: "news",    icon: "📰", title: "Expanding into German market",      meta: "News · qonto.com",          time: "2d ago",  bg: "#EEF0FD", relevance: 74 },
  { id: 5, company: "Doctrine",    type: "hiring",  icon: "🧑‍💼", title: "VP Revenue posted on LinkedIn",     meta: "Hiring signal · doctrine.fr", time: "3d ago",  bg: "#EBF1FA", relevance: 88 },
];

const stageLabels: Record<string, string> = { discovery: "Discovery", demo: "Demo", proposal: "Proposal", negotiation: "Negotiation", closed_won: "Closed Won" };
const stageValues: Record<string, string> = { discovery: "$42k", demo: "$44k", proposal: "$52k", negotiation: "$96k", closed_won: "$29k" };

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? "score-high" : score >= 50 ? "score-mid" : "score-low";
  return <span className={`score ${cls}`}>{score}</span>;
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const labels: Record<AccountStatus, string> = { new: "New", contacted: "Contacted", in_progress: "In Progress", qualified: "Qualified", not_a_fit: "Not a Fit" };
  return (
    <span className={`status status-${status}`}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {labels[status]}
    </span>
  );
}

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  return (
    <div className="co-logo">
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.style.display = "none";
          const sibling = img.nextElementSibling as HTMLElement | null;
          if (sibling) sibling.style.display = "flex";
        }}
      />
      <span style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
        {name.charAt(0)}
      </span>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────
function Dashboard({ setPage }: { setPage: (p: PageId) => void }) {
  return (
    <div className="page-enter">
      <div className="stats-grid">
        {[
          { label: "Total Accounts",    value: "847",   delta: "+124 this week",          up: true  },
          { label: "Avg TAM Score",     value: "73",    delta: "+4 pts vs last week",      up: true  },
          { label: "Open Pipeline",     value: "$278k", delta: "6 active deals",           up: true  },
          { label: "Active Sequences",  value: "3",     delta: "142 contacts enrolled",    up: false },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.up ? "delta-up" : ""}`}>
              {s.up && <Icon d={Icons.arrowUp} size={12} />}
              <span>{s.delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔥 Hot Accounts</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage("signals")}>View signals</button>
          </div>
          <div className="card-body" style={{ padding: "8px 0" }}>
            {signals.slice(0, 4).map(s => (
              <div key={s.id} className="signal-item" style={{ padding: "10px 20px" }}>
                <div className="signal-icon" style={{ background: s.bg }}>{s.icon}</div>
                <div className="signal-body">
                  <div className="signal-title">{s.company} — {s.title}</div>
                  <div className="signal-meta">{s.time}</div>
                </div>
                <span className="score score-high" style={{ fontSize: 11 }}>{s.relevance}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Pipeline at Risk</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage("pipeline")}>View pipeline</button>
          </div>
          <div className="card-body" style={{ padding: "8px 0" }}>
            {[
              { name: "Enterprise Deal", company: "Spendesk",  value: "$96,000", issue: "No activity in 12 days",      health: "red"   as Health },
              { name: "Growth Plan",     company: "Qonto",     value: "$52,000", issue: "Last email went negative",    health: "amber" as Health },
              { name: "Sales Suite",     company: "Doctrine",  value: "$18,000", issue: "Demo not scheduled yet",      health: "amber" as Health },
            ].map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
                <div className={`health health-${d.health}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>{d.company} · {d.issue}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "DM Mono, monospace", color: "var(--text-2)" }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TAM() {
  const [search, setSearch] = useState("");
  const filtered = accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-enter">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div className="search-wrap">
          <span className="search-icon"><Icon d={Icons.search} size={13} /></span>
          <input className="search-input" placeholder="Search accounts…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-secondary btn-sm"><Icon d={Icons.filter} size={13} /> Filters</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm">Import CSV</button>
          <button className="btn btn-primary btn-sm"><Icon d={Icons.plus} size={13} /> Rebuild TAM</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Industry</th>
                <th>Size</th>
                <th>Location</th>
                <th>AI Score</th>
                <th>Top Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <CompanyLogo domain={a.domain} name={a.name} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{a.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{a.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="tag">{a.industry}</span></td>
                  <td style={{ color: "var(--text-2)", fontSize: 13 }}>{a.size}</td>
                  <td style={{ color: "var(--text-2)", fontSize: 13 }}>{a.location}</td>
                  <td><ScoreBadge score={a.score} /></td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.contact}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{a.title}</div>
                  </td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Signals() {
  return (
    <div className="page-enter">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["All", "Funding 💰", "Hiring 🧑‍💼", "Tech Change 🛠️", "News 📰"].map(f => (
          <button key={f} className={`btn btn-sm ${f === "All" ? "btn-primary" : "btn-secondary"}`}>{f}</button>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-secondary btn-sm">Mark all read</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: "0 20px" }}>
          {signals.map(s => (
            <div key={s.id} className="signal-item">
              <div className="signal-icon" style={{ background: s.bg, fontSize: 16 }}>{s.icon}</div>
              <div className="signal-body">
                <div className="signal-title">{s.company} — {s.title}</div>
                <div className="signal-meta">{s.meta}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span className="signal-time">{s.time}</span>
                <button className="btn btn-secondary btn-sm">Enroll →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sequences() {
  const [view, setView] = useState("list");

  if (view === "builder") return (
    <div className="page-enter">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView("list")}><Icon d={Icons.x} size={14} /></button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>New Sequence</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm">Save Draft</button>
          <button className="btn btn-primary btn-sm">Activate</button>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Sequence Steps</span>
            <button className="btn btn-ghost btn-sm"><Icon d={Icons.plus} size={13} /></button>
          </div>
          <div className="card-body">
            {[
              { n: 1, type: "Email",    subject: "{{first_name}}, quick question about {{company}}", delay: "Send immediately" },
              { n: 2, type: "Email",    subject: "Following up — {{company}}",                       delay: "Wait 3 days" },
              { n: 3, type: "LinkedIn", subject: "Connect + intro message",                          delay: "Wait 2 days" },
              { n: 4, type: "Email",    subject: "Last touch — {{first_name}}",                      delay: "Wait 5 days" },
            ].map(s => (
              <div key={s.n} className="seq-step">
                <div className="seq-step-num">{s.n}</div>
                <div className="seq-step-body">
                  <div className="seq-step-type">{s.type}</div>
                  <div className="seq-step-subject">{s.subject}</div>
                  <div className="seq-step-delay">{s.delay}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Settings</span></div>
          <div className="card-body">
            <div className="form-group"><label className="form-label">Sequence name</label><input className="form-input" defaultValue="Outbound — Series A SaaS FR" /></div>
            <div className="form-group"><label className="form-label">Sending account</label><input className="form-input" defaultValue="julian@company.io" /></div>
            <div className="form-group"><label className="form-label">Send window</label><input className="form-input" defaultValue="Mon–Fri, 9:00–18:00" /></div>
            <div style={{ padding: "12px 14px", background: "var(--green-bg)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--green)", marginBottom: 4 }}>AI Personalization ON</div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>Claude will personalize each email using account signals and contact data.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-enter">
      <div style={{ display: "flex", marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setView("builder")}>
          <Icon d={Icons.plus} size={13} /> New Sequence
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { name: "Outbound — Series A SaaS FR",   status: "active", enrolled: 47, replied: 8,  rate: "17%", steps: 4 },
          { name: "Re-engagement — Cold accounts", status: "active", enrolled: 23, replied: 3,  rate: "13%", steps: 3 },
          { name: "Post-demo follow-up",           status: "draft",  enrolled: 0,  replied: 0,  rate: "—",   steps: 5 },
        ].map(s => (
          <div key={s.name} className="card" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>{s.steps} steps</div>
              </div>
              <div style={{ display: "flex", gap: 24, textAlign: "center" }}>
                {([["Enrolled", s.enrolled], ["Replied", s.replied], ["Reply rate", s.rate]] as [string, string | number][]).map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "DM Mono, monospace" }}>{v}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{l}</div>
                  </div>
                ))}
              </div>
              <span className={`status ${s.status === "active" ? "status-qualified" : "status-new"}`}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pipeline() {
  return (
    <div className="page-enter">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-3)" }}>Total: <strong style={{ color: "var(--text-1)" }}>$278,000</strong> across 6 deals</div>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-primary btn-sm"><Icon d={Icons.plus} size={13} /> New Deal</button>
        </div>
      </div>
      <div className="kanban">
        {Object.entries(deals).map(([stage, cards]) => (
          <div key={stage} className="kanban-col">
            <div className="kanban-col-header">
              <span className="kanban-col-title">
                <span className="health health-green" style={{ width: 6, height: 6 }} />
                {stageLabels[stage]}
                <span className="kanban-col-count">{cards.length}</span>
              </span>
              <span className="kanban-col-value">{stageValues[stage]}</span>
            </div>
            <div className="kanban-cards">
              {cards.map(d => (
                <div key={d.id} className="deal-card">
                  <div className="deal-card-name">{d.name}</div>
                  <div className="deal-card-company">{d.company}</div>
                  <div className="deal-card-footer">
                    <span className="deal-card-value">{d.value}</span>
                    <div className={`health health-${d.health}`} />
                  </div>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", color: "var(--text-3)", fontSize: 12 }}>
                <Icon d={Icons.plus} size={12} /> Add deal
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Capture() {
  return (
    <div className="page-enter">
      <div className="grid-2" style={{ marginBottom: 16 }}>
        {[
          { label: "Emails captured",  value: "1,284", sub: "Last 90 days",  icon: "✉️", bg: "var(--blue-bg)"  },
          { label: "Meetings logged",  value: "47",    sub: "Last 30 days",  icon: "📅", bg: "var(--green-bg)" },
          { label: "Calls recorded",   value: "12",    sub: "Last 30 days",  icon: "📞", bg: "var(--amber-bg)" },
          { label: "Auto-summaries",   value: "100%",  sub: "AI coverage",   icon: "✨", bg: "#EEF0FD"         },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ fontSize: 22 }}>{s.value}</div>
              <div className="stat-label" style={{ marginBottom: 0 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity Feed</span>
          <div style={{ display: "flex", gap: 6 }}>
            {["All", "Email", "Meeting", "Call"].map(f => (
              <button key={f} className={`btn btn-sm ${f === "All" ? "btn-primary" : "btn-secondary"}`}>{f}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: "0 20px" }}>
          {[
            { type: "📧", who: "Arthur Mensch",         company: "Mistral AI", action: "Sent email",      subject: '"Re: Platform demo follow-up"',         time: "Today, 10:23",     summary: "Positive reply — confirmed interest, requested pricing deck.",                                           sentiment: "positive" },
            { type: "📅", who: "Jean-Charles Samuelian", company: "Alan",       action: "Meeting",          subject: "Discovery call — 45 min",               time: "Today, 09:00",     summary: "Strong fit. Pain around manual CRM. Wants team access. Next: demo in 1 week.",                         sentiment: "positive" },
            { type: "📞", who: "Steve Anavi",            company: "Qonto",      action: "Call recorded",   subject: "Negotiation call — 28 min",              time: "Yesterday, 16:40", summary: "Pricing objection on enterprise plan. Asked for discount. Tone shifted cautious. Flag for follow-up.", sentiment: "neutral"  },
            { type: "📧", who: "Nicolas Bustamante",     company: "Doctrine",   action: "Inbound email",   subject: '"Interested in your platform"',          time: "Yesterday, 14:15", summary: "Inbound lead. Saw a LinkedIn post. Asked for a demo. High intent.",                                    sentiment: "positive" },
          ].map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 32, height: 32, background: "var(--bg)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{a.type}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.who}</span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>·</span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>{a.company}</span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>·</span>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>{a.action}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>{a.time}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>{a.subject}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", background: "var(--bg)", borderRadius: 6, padding: "7px 10px", borderLeft: `3px solid ${a.sentiment === "positive" ? "var(--green)" : a.sentiment === "negative" ? "var(--red)" : "var(--amber)"}` }}>
                  ✨ {a.summary}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ask() {
  const [input, setInput] = useState("");
  const suggestions = ["What should I do today?", "Which deals are most at risk?", "Draft a follow-up for Qonto", "Who should I contact in my TAM first?"];

  const messages = [
    { role: "ai",   text: "Hey Julian 👋 I'm your AI CRO. I have full visibility on your pipeline, TAM, signals, and activity. What do you want to tackle?", time: "Just now" },
    { role: "user", text: "What should I do today?", time: "2 min ago" },
    { role: "ai",   text: "Here are your top 3 priorities for today:\n\n**1. Follow up with Qonto ($52k)** — No activity in 8 days. Their tone shifted cautious in the last call. Send a short, low-pressure check-in today.\n\n**2. Book demo with Mistral AI** — They replied positively yesterday and requested pricing. Strike while the signal is hot.\n\n**3. Enroll Doctrine in your outbound sequence** — They sent an inbound inquiry 20 hours ago. High intent. Don't let this go cold.", time: "2 min ago" },
  ];

  return (
    <div className="page-enter" style={{ height: "calc(100vh - var(--header-h) - 48px)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}`}>
              <div className="msg-bubble" style={{ whiteSpace: "pre-line" }}>
                {m.text.split("**").map((part, j) => j % 2 === 0 ? part : <strong key={j}>{part}</strong>)}
              </div>
              <div className="msg-meta">{m.role === "ai" ? "✨ Yuzuu AI" : "You"} · {m.time}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface)", padding: "16px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="chat-suggestions">
            {suggestions.map(s => <button key={s} className="chat-suggestion" onClick={() => setInput(s)}>{s}</button>)}
          </div>
          <div className="chat-input-row">
            <input className="chat-input" placeholder="Ask anything about your pipeline…" value={input} onChange={e => setInput(e.target.value)} />
            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [tab, setTab] = useState("team");
  const tabs = [
    { id: "team",         label: "Team",         icon: Icons.team         },
    { id: "billing",      label: "Billing",      icon: Icons.billing      },
    { id: "integrations", label: "Integrations", icon: Icons.integrations },
    { id: "general",      label: "General",      icon: Icons.settings     },
  ];

  return (
    <div className="page-enter settings-layout">
      <div className="settings-nav">
        {tabs.map(t => (
          <div key={t.id} className={`settings-nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            <Icon d={t.icon} size={14} />{t.label}
          </div>
        ))}
      </div>
      <div className="settings-content">
        {tab === "team" && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Team Members</span>
                <button className="btn btn-primary btn-sm"><Icon d={Icons.plus} size={13} />Invite member</button>
              </div>
              <div style={{ padding: "0 20px" }}>
                {[
                  { name: "Julian Lefèvre", email: "julian@company.io", role: "Owner",  avatar: "JL" },
                  { name: "Sophie Martin",  email: "sophie@company.io", role: "Admin",  avatar: "SM" },
                  { name: "Thomas Dupont",  email: "thomas@company.io", role: "Member", avatar: "TD" },
                ].map(u => (
                  <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <div className="avatar" style={{ background: u.role === "Owner" ? "var(--accent)" : "var(--border-2)", color: u.role === "Owner" ? "white" : "var(--text-2)" }}>{u.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13.5 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{u.email}</div>
                    </div>
                    <span className={`status ${u.role === "Owner" ? "status-qualified" : "status-new"}`}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === "billing" && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header"><span className="card-title">Current Plan</span></div>
              <div className="card-body">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--border)", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Growth Plan</div>
                    <div style={{ fontSize: 13, color: "var(--text-3)" }}>$149/month · 5 seats · 5,000 accounts</div>
                  </div>
                  <button className="btn btn-secondary btn-sm">Manage Plan</button>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  {([["Seats used", "3 / 5"], ["Accounts", "847 / 5,000"], ["Next invoice", "Jun 1, 2026 · $149"]] as [string, string][]).map(([l, v]) => (
                    <div key={l} style={{ flex: 1, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{l}</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "integrations" && (
          <div className="card">
            <div className="card-header"><span className="card-title">Integrations</span></div>
            <div style={{ padding: "0 20px" }}>
              {[
                { name: "Apollo.io",        desc: "Account & contact data",      icon: "🎯", connected: true  },
                { name: "Gmail",            desc: "Email capture & sending",      icon: "✉️", connected: true  },
                { name: "Google Calendar",  desc: "Meeting sync",                 icon: "📅", connected: false },
                { name: "Aircall",          desc: "Call recording & transcripts", icon: "📞", connected: false },
                { name: "Zoom",             desc: "Meeting recordings",           icon: "🎥", connected: false },
              ].map(item => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 36, height: 36, background: "var(--bg)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid var(--border)" }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{item.desc}</div>
                  </div>
                  <button className={`btn btn-sm ${item.connected ? "btn-secondary" : "btn-primary"}`}>{item.connected ? "Connected ✓" : "Connect"}</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "general" && (
          <div className="card">
            <div className="card-header"><span className="card-title">Workspace Settings</span></div>
            <div className="card-body">
              <div className="form-group"><label className="form-label">Workspace name</label><input className="form-input" defaultValue="Acme Sales" /></div>
              <div className="form-group"><label className="form-label">Workspace URL</label><input className="form-input" defaultValue="app.revenueengine.io/acme" /></div>
              <button className="btn btn-primary btn-sm">Save changes</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
type PageId = "dashboard" | "tam" | "signals" | "sequences" | "capture" | "pipeline" | "ask" | "settings";

export default function RevenueEngineApp() {
  const [page, setPage] = useState<PageId>("dashboard");

  const nav: { id: PageId; label: string; icon: string | readonly string[]; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard",        icon: Icons.dashboard },
    { id: "tam",       label: "Build TAM",         icon: Icons.tam       },
    { id: "signals",   label: "Signals",           icon: Icons.signals, badge: 5 },
    { id: "sequences", label: "Sequences",         icon: Icons.sequences },
    { id: "capture",   label: "Activity Capture",  icon: Icons.capture   },
    { id: "pipeline",  label: "Pipeline",          icon: Icons.pipeline  },
    { id: "ask",       label: "Ask AI",            icon: Icons.ask       },
  ];

  const pageTitles: Record<PageId, [string, string | null, string | null]> = {
    dashboard: ["Yuzuu", null,  null],
    tam:       ["Build TAM",      "/",   "847 accounts"],
    signals:   ["Signals",        "/",   "5 new today"],
    sequences: ["Sequences",      "/",   "3 active"],
    capture:   ["Activity Capture", "/", "Auto-synced"],
    pipeline:  ["Pipeline",       "/",   "$278k open"],
    ask:       ["Ask AI",         "/",   "CRO Copilot"],
    settings:  ["Settings",       null,  null],
  };

  const [title, sep, sub] = pageTitles[page];

  const renderPage = () => {
    switch (page) {
      case "dashboard":  return <Dashboard setPage={setPage} />;
      case "tam":        return <TAM />;
      case "signals":    return <Signals />;
      case "sequences":  return <Sequences />;
      case "capture":    return <Capture />;
      case "pipeline":   return <Pipeline />;
      case "ask":        return <Ask />;
      case "settings":   return <SettingsPage />;
      default:           return <Dashboard setPage={setPage} />;
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="brand-wordmark">Yuzuu</span>
          <span className="logo-badge">Trial</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Platform</div>
          {nav.map(n => (
            <div key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`} onClick={() => setPage(n.id)}>
              <Icon d={n.icon} size={15} />
              {n.label}
              {n.badge && <span className="nav-badge">{n.badge}</span>}
            </div>
          ))}
          <div className="nav-section-label" style={{ marginTop: 8 }}>Workspace</div>
          <div className={`nav-item ${page === "settings" ? "active" : ""}`} onClick={() => setPage("settings")}>
            <Icon d={Icons.settings} size={15} />Settings
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar">JL</div>
            <div className="user-info">
              <div className="user-name">Julian Lefèvre</div>
              <div className="user-plan">Growth Plan</div>
            </div>
            <Icon d={Icons.chevronDown} size={13} style={{ color: "var(--text-3)" }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        {/* Trial banner */}
        <div className="trial-banner">
          <Icon d={Icons.zap} size={13} fill="currentColor" stroke="none" />
          <span>You have <strong>11 days</strong> left on your free trial.</span>
          <a onClick={() => setPage("settings")}>Upgrade now →</a>
        </div>

        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          {sep && <span className="topbar-sep">/</span>}
          {sub && <span className="topbar-sub">{sub}</span>}
          <div className="topbar-right">
            <button className="btn btn-ghost btn-icon">
              <Icon d={Icons.bell} size={16} />
            </button>
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, cursor: "pointer" }}>JL</div>
          </div>
        </header>

        {/* Content */}
        <main className="content" key={page}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

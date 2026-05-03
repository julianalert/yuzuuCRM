'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useTamBuildStore } from '@/stores/tam-build-store'
import { Icon, Icons } from '@/components/shared/Icon'
import type { ICPParams } from '@/lib/ai/icp-extractor'

interface Props {
  slug: string
}

// ── Step 1: Describe ICP ──────────────────────────────────────────────────────
function StepDescribe({ slug, onNext }: { slug: string; onNext: (params: ICPParams) => void }) {
  const [companyName, setCompanyName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const { setDescription: saveDescription, setParams, setStep } = useOnboardingStore()
  const router = useRouter()

  // Load persisted description after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const stored = useOnboardingStore.getState().description
    if (stored) setDescription(stored)
  }, [])

  async function handleAnalyze() {
    if (!companyName.trim()) {
      toast.error('Please enter your company name.')
      return
    }
    if (description.trim().length < 20) {
      toast.error('Please write at least 20 characters describing your ICP.')
      return
    }
    setLoading(true)
    saveDescription(description)

    try {
      // Rename workspace first
      const renameRes = await fetch('/api/workspace/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName.trim() }),
      })
      const renameData = await renameRes.json()
      if (!renameRes.ok) throw new Error(renameData.error ?? 'Failed to save company name')

      const newSlug: string = renameData.slug

      // Extract ICP params (does NOT save to DB — that happens when build starts)
      const res = await fetch('/api/icp/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to extract ICP')

      // Persist step + params BEFORE any navigation so they survive the slug change
      setParams(data.params)
      setStep(2)

      if (newSlug !== slug) {
        // Navigate to new slug — persisted state will restore step 2
        router.replace(`/${newSlug}/onboarding`)
        return
      }

      onNext(data.params)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to analyze ICP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: '0 auto', padding: '40px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
          Set up your workspace
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Tell us about your company, then describe who you sell to.
        </p>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Company name</label>
          <input
            className="form-input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Corp"
            autoFocus
          />
        </div>

        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">Describe your ideal customer</label>
          <textarea
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. B2B SaaS companies, 50–500 employees, Series A or B, based in France or UK, using Salesforce or HubSpot, hiring sales reps right now"
            style={{ height: 140, resize: 'vertical', padding: '12px', lineHeight: 1.6 }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
          {description.length} characters
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
          onClick={handleAnalyze}
          disabled={loading || !companyName.trim() || description.trim().length < 20}
        >
          {loading ? (
            <>
              <span className="spinner" /> Analyzing your ICP…
            </>
          ) : (
            <>Analyze my ICP →</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Tag editor ────────────────────────────────────────────────────────────────
function TagGroup({
  label,
  tags,
  onChange,
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [inputVal, setInputVal] = useState('')

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function add() {
    if (inputVal.trim() && !tags.includes(inputVal.trim())) {
      onChange([...tags, inputVal.trim()])
    }
    setInputVal('')
    setAdding(false)
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map((tag) => (
          <span key={tag} className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
            {tag}
            <button
              onClick={() => remove(tag)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0 2px', fontSize: 12, lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
              if (e.key === 'Escape') { setAdding(false); setInputVal('') }
            }}
            onBlur={add}
            className="form-input"
            style={{ height: 28, padding: '0 8px', fontSize: 12.5, width: 120 }}
            placeholder="Add…"
          />
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, padding: '3px 8px', border: '1px dashed var(--border-2)' }}
            onClick={() => setAdding(true)}
          >
            + Add
          </button>
        )}
      </div>
    </div>
  )
}

// ── Step 2: Review Parameters ─────────────────────────────────────────────────
function StepReview({
  initialParams,
  onBuild,
}: {
  initialParams: ICPParams
  onBuild: (jobId: string) => void
}) {
  const [params, setParams] = useState(initialParams)
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState('')

  useEffect(() => {
    const stored = useOnboardingStore.getState().description
    if (stored) setDescription(stored)
  }, [])

  const update = (key: keyof ICPParams) => (tags: string[]) =>
    setParams((p) => ({ ...p, [key]: tags }))

  async function handleBuild() {
    setLoading(true)
    try {
      const res = await fetch('/api/tam/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, params }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start build')

      toast.info('TAM build started')
      onBuild(data.job_id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start TAM build')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: '0 auto', padding: '40px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
          Review your ICP parameters
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)' }}>
          AI extracted these from your description. Edit, add or remove tags as needed.
        </p>
      </div>

      <div className="card" style={{ padding: 28, marginBottom: 20 }}>
        <TagGroup label="Industries" tags={params.industries} onChange={update('industries')} />
        <TagGroup label="Company size (employee ranges)" tags={params.employee_ranges} onChange={update('employee_ranges')} />
        <TagGroup label="Geography" tags={params.locations} onChange={update('locations')} />
        <TagGroup label="Tech stack" tags={params.technologies} onChange={update('technologies')} />
        <TagGroup label="Funding stages" tags={params.funding_stages} onChange={update('funding_stages')} />
        <TagGroup label="Intent keywords" tags={params.keywords} onChange={update('keywords')} />
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
        onClick={handleBuild}
        disabled={loading}
      >
        {loading ? 'Starting build…' : 'Build my TAM →'}
      </button>
    </div>
  )
}

// ── Step 3: Building Screen ───────────────────────────────────────────────────
interface BuildStep {
  key: 'finding' | 'enriching' | 'scoring'
  label: string
  icon: string
}

const BUILD_STEPS: BuildStep[] = [
  { key: 'finding',   label: 'Finding companies matching your ICP', icon: '🔍' },
  { key: 'enriching', label: 'Enriching with contacts',             icon: '👥' },
  { key: 'scoring',   label: 'Scoring accounts with AI',            icon: '✨' },
]

function StepBuilding({ jobId, slug }: { jobId: string; slug: string }) {
  const router = useRouter()
  const { updateStatus } = useTamBuildStore()

  const [status, setStatus] = useState<'running' | 'complete' | 'error'>('running')
  const [steps, setSteps] = useState({
    finding:   { done: false, count: 0 },
    enriching: { done: false, count: 0 },
    scoring:   { done: false, count: 0 },
  })
  const [totalAccounts, setTotalAccounts] = useState(0)
  const [planLimit, setPlanLimit] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/tam/build/status?job_id=${jobId}`)
      const data = await res.json()

      setStatus(data.status)
      setSteps(data.steps)
      setTotalAccounts(data.total_accounts)
      if (data.plan_limit) setPlanLimit(data.plan_limit)
      updateStatus({
        status: data.status,
        steps: data.steps,
        total_accounts: data.total_accounts,
        error: data.error ?? null,
      })

      if (data.status === 'error') {
        setError(data.error ?? 'An error occurred during the build.')
        toast.error(data.error ?? 'TAM build failed')
      }

      if (data.status === 'complete') {
        toast.success(`TAM build complete — ${data.total_accounts} accounts ready`, {
          action: { label: 'View TAM', onClick: () => router.push(`/${slug}/tam`) },
        })
        useTamBuildStore.getState().reset()
        useOnboardingStore.getState().reset()
        setTimeout(() => router.push(`/${slug}/tam`), 1500)
      }
    } catch {
      // Ignore polling errors
    }
  }, [jobId, slug, router, updateStatus])

  useEffect(() => {
    const interval = setInterval(() => {
      if (status !== 'running') return
      poll()
      setElapsed((e) => e + 2)
    }, 2000)
    poll()
    return () => clearInterval(interval)
  }, [poll, status])

  const activeStep = steps.finding.done
    ? steps.enriching.done
      ? 'scoring'
      : 'enriching'
    : 'finding'

  return (
    <div
      className="page-enter"
      style={{ maxWidth: 560, margin: '0 auto', padding: '60px 0', textAlign: 'center' }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
        {status === 'complete' ? 'TAM built!' : status === 'error' ? 'Build failed' : 'Building your TAM…'}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 40 }}>
        {status === 'running' && `~2 minutes · ${elapsed}s elapsed`}
        {status === 'complete' && `${totalAccounts} accounts found. Redirecting…`}
        {status === 'error' && 'Something went wrong.'}
      </p>

      {error && (
        <div className="auth-error" style={{ textAlign: 'left', marginBottom: 24 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 28, textAlign: 'left' }}>
        {BUILD_STEPS.map((s) => {
          const step = steps[s.key]
          const isActive = activeStep === s.key && status === 'running'
          const progress = s.key === 'finding'
            ? step.done ? 100 : 10
            : s.key === 'enriching'
            ? step.done ? 100 : steps.finding.done ? 40 : 0
            : step.done ? 100 : steps.enriching.done ? 20 : 0

          return (
            <div key={s.key} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>
                  {step.done ? '✅' : isActive ? s.icon : '⏳'}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>{s.label}</span>
                {step.count > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>
                    {step.count}
                  </span>
                )}
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: step.done ? 'var(--green)' : isActive ? 'var(--accent)' : 'var(--border-2)',
                    borderRadius: 8,
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          )
        })}

        {steps.finding.count > 0 && status === 'running' && (
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
            Found {steps.finding.count} accounts so far…
          </div>
        )}
      </div>

      {/* Free trial limit banner */}
      {planLimit !== null && planLimit <= 25 && (
        <div style={{
          marginTop: 20, padding: '14px 18px', borderRadius: 10,
          background: 'linear-gradient(135deg, #fef9ec 0%, #fff8e6 100%)',
          border: '1px solid #f5c842', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#92660a' }}>
              Free trial — limited to {planLimit} accounts
            </div>
            <div style={{ fontSize: 12, color: '#b07c1a', marginTop: 2 }}>
              Upgrade to Starter to unlock 200 accounts + 3 contacts each
            </div>
          </div>
          <Link
            href={`/${slug}/settings/billing`}
            style={{ fontSize: 12.5, fontWeight: 600, color: '#92660a', textDecoration: 'none',
              padding: '5px 12px', borderRadius: 6, border: '1px solid #f5c842', background: '#fffbf0',
              whiteSpace: 'nowrap' }}
          >
            Upgrade →
          </Link>
        </div>
      )}

      {status === 'error' && (
        <button
          className="btn btn-secondary"
          style={{ marginTop: 20 }}
          onClick={() => window.location.reload()}
        >
          Adjust your ICP
        </button>
      )}
    </div>
  )
}

// ── Main Wizard ───────────────────────────────────────────────────────────────
export function OnboardingWizard({ slug }: Props) {
  const { step, jobId, params, setStep, setJobId, setParams, reset } = useOnboardingStore()

  const steps = [
    { n: 1, label: 'Describe' },
    { n: 2, label: 'Review' },
    { n: 3, label: 'Build' },
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 8, paddingTop: 32 }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: step >= s.n ? 'var(--accent)' : 'var(--border)',
              color: step >= s.n ? 'white' : 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
            }}>
              {step > s.n ? <Icon d={Icons.check} size={12} /> : s.n}
            </div>
            <span style={{ fontSize: 12.5, fontWeight: step === s.n ? 600 : 400, color: step >= s.n ? 'var(--text-1)' : 'var(--text-3)', margin: '0 8px' }}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div style={{ width: 40, height: 1, background: 'var(--border)', margin: '0 4px' }} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <StepDescribe
          slug={slug}
          onNext={(p) => {
            setParams(p)
            setStep(2)
          }}
        />
      )}

      {step === 2 && params && (
        <StepReview
          initialParams={params}
          onBuild={(id) => {
            setJobId(id)
            setStep(3)
          }}
        />
      )}

      {step === 3 && jobId && (
        <StepBuilding jobId={jobId} slug={slug} />
      )}
    </div>
  )
}

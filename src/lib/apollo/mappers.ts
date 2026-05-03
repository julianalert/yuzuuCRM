import type { Account, Contact } from '@/lib/types'

// ── Raw Apollo response types ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApolloRaw = Record<string, any>

export function mapApolloCompany(raw: ApolloRaw): Partial<Account> {
  return {
    name: raw.name ?? '',
    domain: raw.primary_domain ?? raw.website_url?.replace(/^https?:\/\//, '') ?? null,
    industry: raw.industry ?? null,
    employee_count: raw.estimated_num_employees ?? null,
    location: [raw.city, raw.country].filter(Boolean).join(', ') || null,
    website: raw.website_url ?? null,
    linkedin_url: raw.linkedin_url ?? null,
    description: raw.short_description ?? null,
    technology_stack: Array.isArray(raw.technology_names) ? raw.technology_names : [],
    funding_stage: raw.latest_funding_stage ?? null,
    status: 'new',
  }
}

export function mapApolloContact(raw: ApolloRaw): Partial<Contact> {
  return {
    first_name: raw.first_name ?? '',
    last_name: raw.last_name ?? null,
    email: raw.email ?? null,
    phone: raw.phone_numbers?.[0]?.raw_number ?? null,
    title: raw.title ?? null,
    linkedin_url: raw.linkedin_url ?? null,
    avatar_url: raw.photo_url ?? null,
  }
}

const INDUSTRY_TAG_MAP: Record<string, string[]> = {
  saas: ['saas', 'software'],
  fintech: ['financial services', 'financial technology'],
  'hr tech': ['human resources'],
  legaltech: ['legal services'],
  healthtech: ['health, wellness and fitness'],
  'e-commerce': ['retail', 'internet'],
  b2b: ['information technology and services'],
  software: ['computer software'],
  'ai / ml': ['artificial intelligence', 'machine learning'],
}

export function mapIndustryToApolloTag(industry: string): string[] {
  const lower = industry.toLowerCase()
  return INDUSTRY_TAG_MAP[lower] ?? [lower]
}

const TECH_UID_MAP: Record<string, string> = {
  salesforce: 'salesforce',
  hubspot: 'hubspot',
  'microsoft dynamics': 'microsoft-dynamics',
  pipedrive: 'pipedrive',
  intercom: 'intercom',
  zendesk: 'zendesk',
  slack: 'slack',
  jira: 'jira',
  notion: 'notion',
  stripe: 'stripe',
}

export function mapTechToApolloUID(tech: string): string[] {
  const lower = tech.toLowerCase()
  return TECH_UID_MAP[lower] ? [TECH_UID_MAP[lower]] : [lower.replace(/\s+/g, '-')]
}

const FUNDING_STAGE_MAP: Record<string, string> = {
  'seed': 'seed',
  'pre-seed': 'angel',
  'series a': 'series_a',
  'series b': 'series_b',
  'series c': 'series_c',
  'series d': 'series_d',
  'series e': 'series_e',
  'ipo': 'ipo',
}

export function mapFundingStage(stage: string): string {
  return FUNDING_STAGE_MAP[stage.toLowerCase()] ?? stage.toLowerCase().replace(/\s+/g, '_')
}

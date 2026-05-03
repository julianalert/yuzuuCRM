import axios, { type AxiosInstance } from 'axios'
import { mapApolloCompany, mapApolloContact, mapTechToApolloUID, mapFundingStage, mapIndustryToApolloTag } from './mappers'
import type { Account, Contact, ICP } from '@/lib/types'

const APOLLO_BASE = 'https://api.apollo.io'
const MAX_PAGES = 8
const PAGE_SIZE = 25
const RETRY_DELAY_MS = 1000
const PAGE_DELAY_MS = 300

export class ApolloAuthError extends Error {
  constructor() {
    super('Invalid Apollo API key')
    this.name = 'ApolloAuthError'
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ApolloClient {
  private http: AxiosInstance

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: APOLLO_BASE,
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      timeout: 30_000,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async request<T = any>(method: 'get' | 'post', path: string, data?: unknown, retries = 3): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = method === 'post'
          ? await this.http.post<T>(path, data)
          : await this.http.get<T>(path, { params: data })
        return res.data
      } catch (err) {
        if (!axios.isAxiosError(err)) throw err

        if (err.response?.status === 401) throw new ApolloAuthError()

        if (err.response?.status === 403) {
          const msg: string =
            (err.response?.data as { error?: string })?.error ??
            'Apollo API access denied. Please upgrade your Apollo plan at https://app.apollo.io/'
          throw new Error(msg)
        }

        if (err.response?.status === 429) {
          const backoff = RETRY_DELAY_MS * Math.pow(2, attempt)
          await sleep(backoff)
          continue
        }

        throw err
      }
    }
    throw new Error('Apollo API: max retries exceeded')
  }

  async searchCompanies(
    icp: ICP,
    limits: { maxPages: number },
    onPage?: (found: number) => void,
  ): Promise<Partial<Account>[]> {
    const results: Partial<Account>[] = []
    const pagesToFetch = Math.min(limits.maxPages, MAX_PAGES)

    const techUIDs = icp.technologies.flatMap(mapTechToApolloUID)
    const fundingCodes = icp.funding_stages.map(mapFundingStage)
    const industryTerms = icp.industries.flatMap(mapIndustryToApolloTag)
    const keywordParts = [...industryTerms, ...icp.keywords]

    for (let page = 1; page <= pagesToFetch; page++) {
      const body: Record<string, unknown> = {
        per_page: PAGE_SIZE,
        page,
      }

      if (icp.locations.length > 0) {
        body.organization_locations = icp.locations
      }

      if (keywordParts.length > 0) {
        body.q_keywords = keywordParts.join(' ')
      }

      if (icp.employee_ranges.length > 0) {
        body.organization_num_employees_ranges = icp.employee_ranges
      }
      if (techUIDs.length > 0) {
        body.currently_using_any_of_technology_uids = techUIDs
      }
      if (fundingCodes.length > 0) {
        body.organization_latest_funding_stage_cd = fundingCodes
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any>('post', '/v1/mixed_companies/search', body)
      const organizations = data?.organizations ?? []

      if (organizations.length === 0) break

      const mapped = organizations.map(mapApolloCompany)
      results.push(...mapped)
      onPage?.(results.length)

      if (organizations.length < PAGE_SIZE) break
      if (page < pagesToFetch) await sleep(PAGE_DELAY_MS)
    }

    return results
  }

  async getContacts(domain: string, count = 3): Promise<Partial<Contact>[]> {
    const body = {
      q_organization_domains_list: [domain],
      person_seniorities: ['c_suite', 'vp', 'director'],
      per_page: count,
      page: 1,
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any>('post', '/v1/mixed_people/search', body)
      const people = data?.people ?? []
      return people.map(mapApolloContact)
    } catch (err) {
      console.error(`[Apollo] getContacts failed for domain ${domain}:`, err instanceof Error ? err.message : err)
      return []
    }
  }

  async testConnection(): Promise<{ valid: boolean; plan: string }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.request<any>('get', '/v1/auth/health')
      return { valid: true, plan: data?.data?.plan ?? 'unknown' }
    } catch (err) {
      if (err instanceof ApolloAuthError) return { valid: false, plan: '' }
      throw err
    }
  }
}

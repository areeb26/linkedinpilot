import { describe, it, expect } from 'vitest'
import { buildSearchBody, mapUnipileItem, isUrnString, buildActionPayload } from './extraction-utils.js'

// ─────────────────────────────────────────────────────────────────────────────
// Bug #1 — Filters must be spread at top level, not nested under { filters: {} }
// ─────────────────────────────────────────────────────────────────────────────
describe('buildSearchBody', () => {
  it('spreads location filter at top level', () => {
    const body = buildSearchBody({
      api: 'classic',
      category: 'people',
      keywords: 'developer',
      filters: { location: [102277331] },
    })
    expect(body.location).toEqual([102277331])
    expect(body.filters).toBeUndefined()
  })

  it('spreads company filter at top level', () => {
    const body = buildSearchBody({
      api: 'sales_navigator',
      category: 'people',
      keywords: 'cto',
      filters: { company: { include: [1441] } },
    })
    expect(body.company).toEqual({ include: [1441] })
    expect(body.filters).toBeUndefined()
  })

  it('spreads multiple filters at top level', () => {
    const body = buildSearchBody({
      api: 'classic',
      category: 'people',
      keywords: 'engineer',
      filters: {
        location: [102277331],
        industry: { include: ['6'] },
        network_distance: [1, 2],
      },
    })
    expect(body.location).toEqual([102277331])
    expect(body.industry).toEqual({ include: ['6'] })
    expect(body.network_distance).toEqual([1, 2])
    expect(body.filters).toBeUndefined()
  })

  it('includes cursor when provided', () => {
    const body = buildSearchBody({
      api: 'classic',
      category: 'people',
      keywords: 'sales',
      filters: {},
      cursor: 'abc123',
    })
    expect(body.cursor).toBe('abc123')
  })

  it('omits cursor when null', () => {
    const body = buildSearchBody({
      api: 'classic',
      category: 'people',
      keywords: 'sales',
      filters: {},
      cursor: null,
    })
    expect(body.cursor).toBeUndefined()
  })

  it('omits keywords when empty', () => {
    const body = buildSearchBody({
      api: 'classic',
      category: 'companies',
      keywords: '',
      filters: {},
    })
    expect(body.keywords).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug #2 — linkedin_member_id must not store URN strings
// ─────────────────────────────────────────────────────────────────────────────
describe('isUrnString', () => {
  it('identifies ACo... URNs', () => {
    expect(isUrnString('ACoAAAdHsOUBYtAunOfY0wJIbiwgewolov5X55M')).toBe(true)
  })
  it('identifies AEo... URNs', () => {
    expect(isUrnString('AEMAAAQMevMBKmy0KNdlNZA1bV_xR06DjBJ47bY')).toBe(true)
  })
  it('identifies urn:li:... URNs', () => {
    expect(isUrnString('urn:li:member:76351639')).toBe(true)
  })
  it('accepts numeric member IDs', () => {
    expect(isUrnString('76351639')).toBe(false)
  })
  it('accepts slug-style provider IDs', () => {
    expect(isUrnString('john-smith-123')).toBe(false)
  })
  it('returns false for empty string', () => {
    expect(isUrnString('')).toBe(false)
  })
  it('does NOT flag short strings starting with AC (real usernames)', () => {
    // e.g. a company slug like "acme-corp" must not be treated as a URN
    expect(isUrnString('acme-corp')).toBe(false)
    expect(isUrnString('ACme')).toBe(false)
  })
  it('does NOT flag short strings starting with AE', () => {
    expect(isUrnString('AEgis')).toBe(false)
  })
})

describe('mapUnipileItem — linkedin_member_id', () => {
  const WS = 'ws-1'
  const AQ = 'aq-1'

  it('uses provider_id when available (numeric)', () => {
    const item = {
      provider_id: '76351639',
      name: 'Alice Smith',
      public_profile_url: 'https://www.linkedin.com/in/alice-smith',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.linkedin_member_id).toBe('76351639')
  })

  it('extracts numeric ID from member_urn for Sales Nav (no provider_id)', () => {
    // Sales Nav returns member_urn: "urn:li:member:76351639" — extract the numeric part
    const item = {
      id: 'ACwAAASNCJcBS2NERCgi0j_f7_oYqCSbTGsNYBc',
      name: 'Luciano Bana',
      member_urn: 'urn:li:member:76351639',
      public_profile_url: 'https://www.linkedin.com/in/luciano-bana-b876a021',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.linkedin_member_id).toBe('76351639')
  })

  it('uses recruiter_candidate_id for Recruiter leads', () => {
    // Recruiter returns recruiter_candidate_id as the usable numeric ID
    const item = {
      id: 'AEMAAAQMevMBKmy0KNdlNZA1bV_xR06DjBJ47bY',
      recruiter_candidate_id: '67926771',
      headline: 'Software Engineer at LinkedIn',
      current_positions: [{ company: 'LinkedIn', role: 'Software Engineer' }],
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.linkedin_member_id).toBe('67926771')
  })

  it('does NOT store ACo URN as linkedin_member_id', () => {
    const item = {
      id: 'ACoAAAdHsOUBYtAunOfY0wJIbiwgewolov5X55M',
      name: 'Bob Jones',
      profile_url: 'https://www.linkedin.com/in/bobjones?miniProfileUrn=...',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.linkedin_member_id).toBe('')
  })

  it('does NOT store urn:li: string as linkedin_member_id', () => {
    const item = {
      member_urn: 'urn:li:member:76351639',
      name: 'Carol White',
      public_profile_url: 'https://www.linkedin.com/in/carol-white',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    // member_urn is a full URN — numeric part should be extracted
    expect(lead.linkedin_member_id).toBe('76351639')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug #3 — Recruiter leads with no profile_url should still be counted
//           but must NOT be passed to Supabase (profile_url is required for upsert)
// ─────────────────────────────────────────────────────────────────────────────
describe('mapUnipileItem — Recruiter anonymized leads', () => {
  const WS = 'ws-1'
  const AQ = 'aq-1'

  it('returns empty profile_url for fully anonymized Recruiter lead', () => {
    const item = {
      id: 'AEMAAAQMevMBKmy0KNdlNZA1bV_xR06DjBJ47bY',
      headline: 'Software Engineer at LinkedIn',
      location: 'New York, NY',
      current_positions: [{ company: 'LinkedIn', role: 'Software Engineer' }],
      // No name, no public_identifier, no public_profile_url, no member_urn
    }
    const lead = mapUnipileItem(item, WS, AQ)
    // profile_url should be empty — the save-leads filter will drop it
    expect(lead.profile_url).toBe('')
  })

  it('uses fallback name for anonymized Recruiter lead', () => {
    const item = {
      id: 'AEMAAAQMevMBKmy0KNdlNZA1bV_xR06DjBJ47bY',
      headline: 'Software Engineer at LinkedIn',
      current_positions: [{ company: 'LinkedIn', role: 'Software Engineer' }],
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.full_name).toBe('Software Engineer at LinkedIn')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug #4 — action_queue_id must be set in a single insert, not via a second update
// ─────────────────────────────────────────────────────────────────────────────
describe('buildActionPayload', () => {
  it('includes action_queue_id in the initial payload', () => {
    const payload = buildActionPayload({
      extractionType: 'search',
      campaignId: 'camp-1',
      maxLeads: 50,
      actionQueueId: 'aq-abc',
    })
    expect(payload.action_queue_id).toBe('aq-abc')
    expect(payload.extractionType).toBe('search')
    expect(payload.campaignId).toBe('camp-1')
    expect(payload.maxLeads).toBe(50)
  })

  it('does not require a second update call to set action_queue_id', () => {
    // The payload returned by buildActionPayload is complete — no placeholder null
    const payload = buildActionPayload({
      extractionType: 'search',
      campaignId: 'camp-1',
      maxLeads: 100,
      actionQueueId: 'aq-xyz',
    })
    expect(payload.action_queue_id).not.toBeNull()
    expect(payload.action_queue_id).not.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Bug #1 extra — Classic profile_url slug extraction
// ─────────────────────────────────────────────────────────────────────────────
describe('mapUnipileItem — profile_url construction', () => {
  const WS = 'ws-1'
  const AQ = 'aq-1'

  it('uses public_profile_url from Sales Nav (strips query string)', () => {
    const item = {
      name: 'Alice',
      public_profile_url: 'https://www.linkedin.com/in/alice-smith?trk=...',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.profile_url).toBe('https://www.linkedin.com/in/alice-smith')
  })

  it('builds URL from public_identifier when no public_profile_url', () => {
    const item = {
      name: 'Bob',
      public_identifier: 'bob-jones-123',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.profile_url).toBe('https://www.linkedin.com/in/bob-jones-123')
  })

  it('extracts slug from Classic profile_url (strips miniProfileUrn)', () => {
    const item = {
      name: 'Carol',
      profile_url: 'https://www.linkedin.com/in/carol-white?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAA',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.profile_url).toBe('https://www.linkedin.com/in/carol-white')
  })

  it('falls back to /in/member/{id} when no slug available', () => {
    const item = {
      name: 'Dave',
      member_urn: 'urn:li:member:12345678',
    }
    const lead = mapUnipileItem(item, WS, AQ)
    expect(lead.profile_url).toBe('https://www.linkedin.com/in/member/12345678')
  })
})

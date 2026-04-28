/**
 * Pure utility functions extracted from LeadExtractionModal for testability.
 * All functions here are side-effect free.
 */

/**
 * Build the Unipile search body from form state.
 *
 * Filters must be spread at the TOP LEVEL of the body — Unipile does not
 * accept a nested `filters` key.  The cursor (for pagination) is also
 * merged at the top level.
 *
 * @param {object} params
 * @param {string} params.api          - 'classic' | 'sales_navigator' | 'recruiter'
 * @param {string} params.category     - 'people' | 'companies' | 'posts' | 'jobs'
 * @param {string} params.keywords     - search keywords
 * @param {object} params.filters      - already-built filter object (location, company, …)
 * @param {string|null} params.cursor  - pagination cursor from previous page
 * @returns {object} body ready to send to POST /api/linkedin/search as `body`
 */
export function buildSearchBody({ api, category, keywords, filters = {}, cursor = null }) {
  return {
    api,
    category,
    ...(keywords ? { keywords } : {}),
    // Spread filters at top level — NOT nested under a 'filters' key
    ...filters,
    ...(cursor ? { cursor } : {}),
  }
}

/**
 * Map a Unipile search result item to a leads table row.
 *
 * @param {object} item        - raw item from Unipile search response
 * @param {string} workspaceId
 * @param {string} actionId
 * @returns {object} lead row ready for Supabase upsert
 */
export function mapUnipileItem(item, workspaceId, actionId) {
  // Build a valid, clickable profile_url.
  // Priority order:
  // 1. public_profile_url (Sales Nav) - most reliable
  // 2. public_identifier (Sales Nav) - build clean URL
  // 3. profile_url with valid slug (Classic) - extract slug
  // 4. member_urn (Classic/Recruiter) - use member ID format
  // 5. provider_id - use as member ID
  let profileUrl = ''

  if (item.public_profile_url) {
    profileUrl = item.public_profile_url.split('?')[0].replace(/\/$/, '')
  } else if (item.public_identifier) {
    profileUrl = `https://www.linkedin.com/in/${item.public_identifier}`
  } else if (item.profile_url) {
    const stripped = item.profile_url.split('?')[0].replace(/\/$/, '')
    const slug = stripped.split('/in/')[1] || ''
    // Accept slug only if it's a real username, not a base64 URN
    if (slug && !isUrnString(slug)) {
      profileUrl = stripped
    }
  }

  if (!profileUrl) {
    const memberId = item.member_urn?.split(':').pop() || item.provider_id || item.id
    // Only use as a fallback URL if it's a real numeric/slug ID, not a URN string
    if (memberId && memberId !== 'undefined' && memberId !== 'null' && !isUrnString(memberId)) {
      profileUrl = `https://www.linkedin.com/in/member/${memberId}`
    }
  }

  if (profileUrl && !profileUrl.startsWith('http')) {
    profileUrl = 'https://www.linkedin.com' + (profileUrl.startsWith('/') ? '' : '/') + profileUrl
  }

  const companyFromPositions =
    item.current_positions?.[0]?.company_name ||
    item.current_positions?.[0]?.company ||
    item.positions?.[0]?.company_name ||
    item.positions?.[0]?.company ||
    ''
  const headline = item.headline || item.summary || ''
  const companyFromHeadline = headline.includes(' at ')
    ? headline.split(' at ').slice(1).join(' at ').trim()
    : headline.includes(' @ ')
      ? headline.split(' @ ').slice(1).join(' @ ').trim()
      : ''
  const company = companyFromPositions || companyFromHeadline

  const roleFromPositions = item.current_positions?.[0]?.role || item.positions?.[0]?.role || ''
  const titleFromHeadline = headline.includes(' at ')
    ? headline.split(' at ')[0].trim()
    : headline.includes(' @ ')
      ? headline.split(' @ ')[0].trim()
      : ''
  const title = roleFromPositions || titleFromHeadline || headline

  const rawName = item.name || [item.first_name, item.last_name].filter(Boolean).join(' ')
  const isAnonymized = !rawName || rawName === 'LinkedIn Member' || rawName === 'LinkedIn User'

  const fullName = isAnonymized
    ? (title && company ? `${title} at ${company}` : title && title !== headline ? title : 'LinkedIn Member')
    : rawName

  // linkedin_member_id: resolve the best usable numeric ID.
  // Priority:
  // 1. provider_id — Unipile's own numeric ID (most reliable)
  // 2. recruiter_candidate_id — Recruiter tier's numeric ID (name/profile hidden)
  // 3. member_urn numeric part — extract from "urn:li:member:76351639"
  // Never store raw base64 URN strings (ACo..., AEM...) — they're not usable for outreach.
  let linkedinMemberId = ''
  if (item.provider_id && !isUrnString(item.provider_id)) {
    linkedinMemberId = String(item.provider_id)
  } else if (item.recruiter_candidate_id) {
    linkedinMemberId = String(item.recruiter_candidate_id)
  } else if (item.member_urn) {
    // "urn:li:member:76351639" → "76351639"
    const numericPart = item.member_urn.split(':').pop()
    if (numericPart && /^\d+$/.test(numericPart)) {
      linkedinMemberId = numericPart
    }
  }

  return {
    workspace_id:       workspaceId,
    action_queue_id:    actionId,
    full_name:          fullName,
    first_name:         item.first_name || null,
    last_name:          item.last_name  || null,
    headline,
    title,
    company,
    profile_url:        profileUrl,
    avatar_url:         item.profile_picture_url || item.picture_url || '',
    location:           item.location || item.geo_location || '',
    linkedin_member_id: linkedinMemberId,
    source:             'unipile-search',
    connection_status:  'none',
  }
}

/**
 * Returns true if the string looks like a LinkedIn base64 URN (ACo..., AEM..., urn:li:...)
 * rather than a usable numeric member ID or slug.
 *
 * LinkedIn base64 URNs:
 *   Classic:        ACoAAA...  (base64, always 30+ chars)
 *   Sales Nav:      ACwAAA...
 *   Recruiter:      AEMAAa...
 *   urn:li:member:  explicit URN prefix
 *
 * Distinguishing rule: real URNs start with AC or AE AND are long (≥20 chars).
 * Real usernames/slugs are short and contain hyphens/dots.
 */
export function isUrnString(id) {
  if (!id) return false
  const s = String(id)
  if (s.startsWith('urn:')) return true
  // LinkedIn base64 URNs start with AC or AE and are always ≥20 chars
  if ((s.startsWith('AC') || s.startsWith('AE')) && s.length >= 20) return true
  return false
}

/**
 * Build the action_queue payload in a single step so there is no race
 * condition between insert and update.  The caller must pass the
 * action_queue_id that was returned by the insert.
 *
 * @param {object} opts
 * @returns {object} complete payload object
 */
export function buildActionPayload({ extractionType, campaignId, maxLeads, actionQueueId }) {
  return {
    extractionType,
    campaignId,
    maxLeads,
    action_queue_id: actionQueueId,
  }
}

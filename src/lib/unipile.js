/**
 * Unipile API client — all calls proxied through the backend worker.
 *
 * The backend exposes:
 *   POST /api/proxy          — generic proxy for any Unipile endpoint
 *   POST /api/linkedin/search
 *   GET  /api/linkedin/search/parameters
 *
 * This keeps VITE_UNIPILE_DSN and VITE_UNIPILE_API_KEY off the browser
 * network tab entirely. The frontend only ever talks to the local backend.
 */

const BACKEND = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

/** Generic proxy call */
async function proxy({ method = 'GET', path, account_id, params, body } = {}) {
  const url = `${BACKEND()}/api/proxy`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ method, path, account_id, params, body }),
  })
  if (!res.ok) {
    let b = {}
    try { b = await res.json() } catch { /* ignore */ }
    const err = new Error(b?.error ?? b?.message ?? `Proxy error ${res.status}`)
    err.response = { status: res.status, data: b }
    throw err
  }
  if (res.status === 204) return {}
  return res.json()
}

/** Build query string, skipping null/undefined values */
function qs(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const unipile = {

  // ── account ──────────────────────────────────────────────────────────────
  account: {
    getAll: ({ limit, cursor } = {}) =>
      proxy({ path: `/accounts${qs({ limit, cursor })}` }),

    getOne: (account_id) =>
      proxy({ path: `/accounts/${account_id}` }),

    connectLinkedin: ({ username, password, country, proxy: p } = {}) =>
      proxy({ method: 'POST', path: '/accounts', body: { provider: 'LINKEDIN', username, password, ...(country ? { country } : {}), ...(p ? { proxy: p } : {}) } }),

    connectLinkedinWithCookie: ({ access_token, user_agent } = {}) =>
      proxy({ method: 'POST', path: '/accounts', body: { provider: 'LINKEDIN', access_token, ...(user_agent ? { user_agent } : {}) } }),

    reconnect: ({ account_id, ...rest } = {}) =>
      proxy({ method: 'POST', path: `/accounts/${account_id}`, body: { account_id, ...rest } }),

    delete: (account_id) =>
      proxy({ method: 'DELETE', path: `/accounts/${account_id}` }),

    solveCodeCheckpoint: ({ account_id, provider = 'LINKEDIN', code } = {}) =>
      proxy({ method: 'POST', path: '/accounts/checkpoint', body: { account_id, provider, code } }),

    resendCheckpointNotification: ({ account_id, provider = 'LINKEDIN' } = {}) =>
      proxy({ method: 'POST', path: '/accounts/checkpoint/resend', body: { account_id, provider } }),

    createHostedAuthLink: (params = {}) =>
      proxy({ method: 'POST', path: '/hosted/accounts/link', body: params }),

    resyncLinkedinAccount: ({ account_id } = {}) =>
      proxy({ path: `/accounts/${account_id}/sync` }),
  },

  // ── messaging ─────────────────────────────────────────────────────────────
  messaging: {
    getAllChats: ({ account_id, account_type, limit, cursor, unread } = {}) =>
      proxy({ path: `/chats${qs({ account_id, account_type, limit, cursor, unread })}` }),

    getChat: (chat_id) =>
      proxy({ path: `/chats/${chat_id}` }),

    getAllMessagesFromChat: ({ chat_id, limit, cursor } = {}) =>
      proxy({ path: `/chats/${chat_id}/messages${qs({ limit, cursor })}` }),

    getAllAttendeesFromChat: (chat_id) =>
      proxy({ path: `/chats/${chat_id}/attendees` }),

    getAllAttendees: ({ account_id, limit, cursor } = {}) =>
      proxy({ path: `/chat_attendees${qs({ account_id, limit, cursor })}` }),

    // sendMessage and startNewChat use FormData — proxied as JSON body, backend handles
    sendMessage: ({ chat_id, text } = {}) =>
      proxy({ method: 'POST', path: `/chats/${chat_id}/messages`, body: { text } }),

    startNewChat: ({ account_id, attendees_ids = [], text, subject, options } = {}) =>
      proxy({ method: 'POST', path: '/chats', account_id, body: { account_id, attendees_ids, text, subject, options } }),

    setChatStatus: ({ chat_id, action, value } = {}) =>
      proxy({ method: 'PATCH', path: `/chats/${chat_id}`, body: { action, value } }),
  },

  // ── users ─────────────────────────────────────────────────────────────────
  users: {
    getProfile: ({ account_id, identifier, linkedin_sections, linkedin_api } = {}) => {
      const sections = Array.isArray(linkedin_sections) ? linkedin_sections.join(',') : linkedin_sections
      return proxy({ path: `/users/${encodeURIComponent(identifier)}${qs({ account_id, linkedin_sections: sections, linkedin_api })}` })
    },

    getOwnProfile: (account_id) =>
      proxy({ path: `/users/me${qs({ account_id })}` }),

    getCompanyProfile: ({ account_id, identifier } = {}) =>
      proxy({ path: `/linkedin/company/${encodeURIComponent(identifier)}${qs({ account_id })}` }),

    getAllRelations: ({ account_id, limit, cursor } = {}) =>
      proxy({ path: `/users/relations${qs({ account_id, limit, cursor })}` }),

    sendInvitation: ({ account_id, provider_id, message } = {}) =>
      proxy({ method: 'POST', path: '/users/invite', body: { account_id, provider_id, ...(message ? { message } : {}) } }),

    getAllInvitationsSent: ({ account_id, limit, cursor } = {}) =>
      proxy({ path: `/users/invite/sent${qs({ account_id, limit, cursor })}` }),

    cancelInvitationSent: ({ account_id, invitation_id } = {}) =>
      proxy({ method: 'DELETE', path: `/users/invite/sent/${invitation_id}${qs({ account_id })}` }),

    getAllInvitationsReceived: ({ account_id, limit, cursor } = {}) =>
      proxy({ path: `/users/invite/received${qs({ account_id, limit, cursor })}` }),

    handleInvitation: ({ account_id, invitation_id, action, linkedin_token } = {}) =>
      proxy({
        method: 'POST',
        path: `/users/invite/received/${invitation_id}`,
        body: { account_id, action, ...(linkedin_token ? { linkedin_token } : {}) },
      }),

    getAllPosts: ({ account_id, identifier, limit, cursor, is_company } = {}) =>
      proxy({ path: `/users/${encodeURIComponent(identifier)}/posts${qs({ account_id, limit, cursor, is_company })}` }),

    getPost: ({ account_id, post_id } = {}) =>
      proxy({ path: `/posts/${encodeURIComponent(post_id)}${qs({ account_id })}` }),

    createPost: ({ account_id, text } = {}) =>
      proxy({ method: 'POST', path: '/posts', body: { account_id, text } }),

    getAllPostComments: ({ account_id, post_id, limit, cursor } = {}) =>
      proxy({ path: `/posts/${encodeURIComponent(post_id)}/comments${qs({ account_id, limit, cursor })}` }),

    sendPostComment: ({ account_id, post_id, text } = {}) =>
      proxy({ method: 'POST', path: `/posts/${encodeURIComponent(post_id)}/comments`, body: { account_id, text } }),

    sendPostReaction: ({ account_id, post_id, reaction_type = 'LIKE' } = {}) =>
      proxy({ method: 'POST', path: '/posts/reaction', body: { account_id, post_id, reaction_type } }),
  },
}

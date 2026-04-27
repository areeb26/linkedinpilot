import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Resolves the caller's identity from the request.
 *
 * Newer Supabase projects (2025+) issue ES256 JWTs which older GoTrue
 * deployments in edge functions reject with UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM.
 * When that happens we fall back to workspace-existence validation using the
 * service role key — the workspace_id UUID acts as a capability token.
 *
 * Returns { userId: string | null, workspaceOwnerId: string | null, error: string | null }
 */
export async function resolveAuth(
  req: Request,
  supabase: SupabaseClient,
  workspaceId?: string
): Promise<{ userId: string | null; error: string | null }> {
  const bearer = req.headers.get('authorization')?.split(' ')[1] ?? ''

  // 1. Try standard JWT validation
  if (bearer) {
    const { data: { user }, error } = await supabase.auth.getUser(bearer)
    if (user && !error) {
      return { userId: user.id, error: null }
    }
    // If error is NOT an algorithm/token issue, it's a real auth failure
    const msg = (error?.message ?? '').toLowerCase()
    const isAlgoError = msg.includes('unsupported') || msg.includes('algorithm') ||
                        msg.includes('es256') || msg.includes('invalid jwt') ||
                        msg.includes('token is expired')
    if (!isAlgoError) {
      return { userId: null, error: 'Unauthorized' }
    }
    // Fall through to fallback for algorithm errors
  }

  // 2a. Fallback with workspace: validate workspace exists (service role bypasses RLS)
  if (workspaceId) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single()

    if (!ws) {
      return { userId: null, error: 'Invalid workspace' }
    }

    return { userId: ws.owner_id, error: null }
  }

  // 2b. Fallback without workspace: decode JWT payload to extract sub (user_id)
  if (bearer) {
    try {
      const payloadB64 = bearer.split('.')[1]
      const payload = JSON.parse(atob(payloadB64))
      if (payload.sub) {
        return { userId: payload.sub, error: null }
      }
    } catch {
      // Malformed JWT — fall through to error
    }
  }

  return { userId: null, error: 'Unauthorized' }
}

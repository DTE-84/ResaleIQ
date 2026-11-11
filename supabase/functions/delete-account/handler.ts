type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch };
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Permanently deletes the caller's own account. Inventory and AI usage rows
// cascade from auth.users; the legacy listings table is cleared explicitly.
export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    };
    const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405, headers: { ...headers, Allow: 'POST, OPTIONS' },
    });
    try {
      const bearer = req.headers.get('authorization');
      if (!bearer || !/^Bearer \S+$/i.test(bearer)) throw new HttpError(401, 'Please sign in again.');
      const url = deps.env('SUPABASE_URL');
      const anon = deps.env('SUPABASE_ANON_KEY');
      const service = deps.env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !anon || !service) throw new HttpError(503, 'Account service is not configured.');
      // The user ID comes only from Auth, never from the request body.
      const auth = await deps.fetch(`${url}/auth/v1/user`, {
        headers: { apikey: anon, Authorization: bearer }, signal: AbortSignal.timeout(10_000),
      });
      if (auth.status === 401 || auth.status === 403) throw new HttpError(401, 'Please sign in again.');
      if (!auth.ok) throw new HttpError(503, 'Sign-in verification is temporarily unavailable.');
      const user = await auth.json();
      if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id) || user.role !== 'authenticated') {
        throw new HttpError(401, 'Please sign in again.');
      }
      const admin = { apikey: service, Authorization: `Bearer ${service}` };
      const legacy = await deps.fetch(`${url}/rest/v1/listings?user_id=eq.${user.id}`, {
        method: 'DELETE', headers: admin, signal: AbortSignal.timeout(10_000),
      });
      // 404 means the legacy table does not exist on this project.
      if (!legacy.ok && legacy.status !== 404) throw new HttpError(503, 'Account deletion is temporarily unavailable.');
      const removed = await deps.fetch(`${url}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE', headers: admin, signal: AbortSignal.timeout(10_000),
      });
      if (!removed.ok && removed.status !== 404) throw new HttpError(503, 'Account deletion is temporarily unavailable.');
      return respond(200, { success: true });
    } catch (error) {
      return respond(error instanceof HttpError ? error.status : 503, {
        success: false, error: error instanceof HttpError ? error.message : 'Service temporarily unavailable. Please try again.',
      });
    }
  };
}

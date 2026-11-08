type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch };
const MAX_BODY = 7_100_000;
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function readBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new HttpError(413, 'Upload is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
}

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
      const apiKey = deps.env('ANTHROPIC_API_KEY');
      const model = deps.env('ANTHROPIC_MODEL');
      if (!url || !anon || !service || !apiKey || !model) throw new HttpError(503, 'AI service is not configured.');
      // Verify against Auth; never trust a body-supplied ID or merely decode a JWT.
      const auth = await deps.fetch(`${url}/auth/v1/user`, {
        headers: { apikey: anon, Authorization: bearer }, signal: AbortSignal.timeout(10_000),
      });
      if (auth.status === 401 || auth.status === 403) throw new HttpError(401, 'Please sign in again.');
      if (!auth.ok) throw new HttpError(503, 'Sign-in verification is temporarily unavailable.');
      const user = await auth.json();
      if (!user.id || user.role !== 'authenticated' || user.is_anonymous === true) {
        throw new HttpError(401, 'A registered account is required.');
      }
      if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new HttpError(415, 'Content-Type must be application/json.');
      }
      if (Number(req.headers.get('content-length')) > MAX_BODY) throw new HttpError(413, 'Upload is too large.');
      const body = await readBody(req);
      const action = body?.action;
      const payload = body?.payload;
      let content: unknown;
      if (action === 'generate-text') {
        if (typeof payload?.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 12_000) {
          throw new HttpError(400, 'Provide item details of at most 12,000 characters.');
        }
        content = payload.prompt;
      } else if (action === 'analyze-image') {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(payload?.mimeType) ||
            typeof payload?.imageBase64 !== 'string' || !payload.imageBase64.length ||
            payload.imageBase64.length > Math.ceil(5 * 1024 * 1024 / 3) * 4 ||
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.imageBase64)) {
          throw new HttpError(400, 'Use a JPEG, PNG, or WebP photo up to 5 MB.');
        }
        const padding = payload.imageBase64.endsWith('==') ? 2 : payload.imageBase64.endsWith('=') ? 1 : 0;
        if (payload.imageBase64.length / 4 * 3 - padding > 5 * 1024 * 1024) {
          throw new HttpError(413, 'Photo is too large.');
        }
        content = [
          { type: 'image', source: { type: 'base64', media_type: payload.mimeType, data: payload.imageBase64 } },
          { type: 'text', text: 'Identify this resale item without claiming certainty about details not visible. Return ONLY a JSON object with string fields title, category, brand, model, condition_notes. Use "Unknown" when uncertain. Do not provide prices or claim access to marketplace sales.' },
        ];
      } else { throw new HttpError(400, 'Invalid action.'); }
      const quota = await deps.fetch(`${url}/rest/v1/rpc/consume_ai_quota`, {
        method: 'POST',
        headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_user_id: user.id }), signal: AbortSignal.timeout(10_000),
      });
      if (!quota.ok) throw new HttpError(503, 'Usage verification is temporarily unavailable.');
      const allowed = await quota.json();
      if (allowed === false) return new Response(JSON.stringify({ success: false, error: 'Usage limit reached. Please try again later.' }), {
        status: 429, headers: { ...headers, 'Retry-After': '3600' },
      });
      if (allowed !== true) throw new HttpError(503, 'Usage verification is temporarily unavailable.');
      const upstream = await deps.fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: AbortSignal.timeout(45_000),
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content }] }),
      });
      if (!upstream.ok) throw new HttpError(502, 'AI analysis is temporarily unavailable.');
      const result = await upstream.json();
      const text = result.content?.find((block: { type: string }) => block.type === 'text')?.text;
      if (typeof text !== 'string' || result.stop_reason === 'max_tokens') throw new HttpError(502, 'AI returned an incomplete response.');
      if (action === 'generate-text') return respond(200, { success: true, text });
      let identification;
      try { identification = JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')); }
      catch { throw new HttpError(502, 'AI returned an invalid response.'); }
      const fields = ['title', 'category', 'brand', 'model', 'condition_notes'];
      if (!identification || !fields.every((key) => typeof identification[key] === 'string' && identification[key].length <= 2000)) {
        throw new HttpError(502, 'AI returned an invalid response.');
      }
      return respond(200, { success: true, identification: Object.fromEntries(fields.map(key => [key, identification[key]])), valuation: null });
    } catch (error) {
      // Never return upstream errors, keys, user data, prompts, or images.
      return respond(error instanceof HttpError ? error.status : 503, {
        success: false, error: error instanceof HttpError ? error.message : 'Service temporarily unavailable. Please try again.',
      });
    }
  };
}

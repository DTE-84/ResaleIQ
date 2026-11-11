import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/delete-account/handler.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const env = (key: string) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'server-secret' })[key];
function request(body: unknown = {}, token = 'user-token') {
  return new Request('https://example.test', { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify(body) });
}
function fixture(options: { auth?: number; user?: object; legacy?: number; admin?: number } = {}) {
  const calls: { url: string; method?: string; auth?: string }[] = [];
  const handler = createHandler({ env, fetch: (async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(url), method: init?.method, auth: headers.get('authorization') ?? undefined });
    if (String(url).endsWith('/auth/v1/user')) return Response.json(options.user ?? { id: userId, role: 'authenticated' }, { status: options.auth ?? 200 });
    if (String(url).includes('/rest/v1/listings')) return new Response(null, { status: options.legacy ?? 204 });
    return Response.json({}, { status: options.admin ?? 200 });
  }) as typeof fetch });
  return { handler, calls };
}

test('delete-account: missing bearer and bad methods make no calls', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request({}, ''))).status, 401);
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
  assert.equal(calls.length, 0);
});
test('delete-account: invalid or non-user identities never reach admin API', async () => {
  for (const options of [{ auth: 401 }, { user: { role: 'service_role' } }, { user: { id: '../x', role: 'authenticated' } }]) {
    const { handler, calls } = fixture(options);
    assert.equal((await handler(request())).status, 401);
    assert.equal(calls.length, 1);
  }
});
test('delete-account: deletes only the Auth-verified user, ignoring body IDs', async () => {
  const { handler, calls } = fixture();
  const res = await handler(request({ user_id: '22222222-2222-4222-8222-222222222222' }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.map((c) => [c.method ?? 'GET', new URL(c.url).pathname + new URL(c.url).search]), [
    ['GET', '/auth/v1/user'],
    ['DELETE', `/rest/v1/listings?user_id=eq.${userId}`],
    ['DELETE', `/auth/v1/admin/users/${userId}`],
  ]);
  assert.equal(calls[0].auth, 'Bearer user-token');
  assert.equal(calls[2].auth, 'Bearer server-secret');
});
test('delete-account: missing legacy table is fine, other failures fail closed', async () => {
  assert.equal((await fixture({ legacy: 404 }).handler(request())).status, 200);
  const legacyDown = fixture({ legacy: 500 });
  assert.equal((await legacyDown.handler(request())).status, 503);
  assert.equal(legacyDown.calls.length, 2);
  const adminDown = await fixture({ admin: 500 }).handler(request());
  assert.equal(adminDown.status, 503);
  assert.doesNotMatch(await adminDown.text(), /server-secret/);
});

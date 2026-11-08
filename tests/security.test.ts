import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createHandler } from '../supabase/functions/visual-ingestion/handler.ts';
import legacy from '../api/generate.js';

const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const env = (key: string) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'server-secret', ANTHROPIC_API_KEY: 'provider-secret', ANTHROPIC_MODEL: 'configured-model' })[key];
const goodBody = { action: 'generate-text', payload: { prompt: 'Describe this shirt.' } };
function request(body: unknown = goodBody, token = 'user-token') {
  return new Request('https://example.test', { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: JSON.stringify(body) });
}
function fixture(options: { auth?: number; user?: object; quota?: unknown; quotaStatus?: number; upstream?: number; output?: string } = {}) {
  const calls: { url: string; body?: string }[] = [];
  const handler = createHandler({ env, fetch: (async (url, init) => {
    calls.push({ url: String(url), body: init?.body as string });
    if (String(url).endsWith('/user')) return Response.json(options.user ?? { id: userId, role: 'authenticated' }, { status: options.auth ?? 200 });
    if (String(url).includes('/rpc/')) return Response.json(options.quota ?? true, { status: options.quotaStatus ?? 200 });
    return Response.json({ content: [{ type: 'text', text: options.output ?? 'generated text' }] }, { status: options.upstream ?? 200 });
  }) as typeof fetch });
  return { handler, calls };
}

test('missing bearer never reaches Auth, quota, or paid provider', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request(goodBody, ''))).status, 401);
  assert.equal(calls.length, 0);
});
test('preflight and unsupported methods make no external calls', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(new Request('https://example.test', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
  assert.equal(calls.length, 0);
});
test('Auth outage and missing server configuration fail closed', async () => {
  const { handler, calls } = fixture({ auth: 500 });
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls.length, 1);
  const missingConfig = createHandler({ env: () => undefined, fetch: async () => { throw new Error('Must not call provider'); } });
  assert.equal((await missingConfig(request())).status, 503);
});
test('invalid, anonymous, and service credentials never reach paid provider', async () => {
  for (const options of [{ auth: 401 }, { user: { id: userId, role: 'authenticated', is_anonymous: true } }, { user: { role: 'service_role' } }]) {
    const { handler, calls } = fixture(options);
    assert.equal((await handler(request())).status, 401);
    assert.equal(calls.length, 1);
  }
});
test('quota denial and quota outage fail closed', async () => {
  for (const [options, status] of [[{ quota: false }, 429], [{ quotaStatus: 500 }, 503], [{ quota: {} }, 503]] as const) {
    const { handler, calls } = fixture(options);
    assert.equal((await handler(request())).status, status);
    assert.equal(calls.length, 2);
  }
});
test('authenticated identity controls quota, ignoring forged user IDs and model', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request({ ...goodBody, user_id: otherId, model: 'expensive-model' }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(calls[1].body!), { p_user_id: userId });
  assert.equal(JSON.parse(calls[2].body!).model, 'configured-model');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('malformed and excessive inputs cannot consume quota or call provider', async () => {
  for (const body of [null, {}, { action: 'generate-text', payload: { prompt: 'x'.repeat(12001) } },
    { action: 'analyze-image', payload: { mimeType: 'image/svg+xml', imageBase64: 'AAAA' } }]) {
    const { handler, calls } = fixture();
    assert.equal((await handler(request(body))).status, 400);
    assert.equal(calls.length, 1);
  }
  const { handler, calls } = fixture();
  assert.equal((await handler(request({ padding: 'x'.repeat(7_100_001) }))).status, 413);
  assert.equal(calls.length, 1);
});
test('upstream failures do not expose secrets or internal errors', async () => {
  const { handler } = fixture({ upstream: 500 });
  const response = await handler(request());
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret|stack|anthropic/i);
});
test('photo output has no fabricated price and rejects invalid identification', async () => {
  const body = { action: 'analyze-image', payload: { mimeType: 'image/png', imageBase64: 'AAAA' } };
  const identification = { title: 'Shirt', category: 'clothing', brand: 'Unknown', model: 'Unknown', condition_notes: 'Unknown' };
  const { handler } = fixture({ output: JSON.stringify(identification) });
  const response = await handler(request(body));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, identification, valuation: null });
  assert.equal((await fixture({ output: '{}' }).handler(request(body))).status, 502);
});
test('legacy proxy is retired', () => {
  let status;
  legacy({}, { setHeader() {}, status(code) { status = code; return this; }, json(value) { return value; } });
  assert.equal(status, 410);
});

test('Postgres migrations enforce inventory ownership and server-only durable quota', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      grant usage on schema auth, public to authenticated, anon, service_role;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${userId}'), ('${otherId}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20260701000000_create_inventory.sql', import.meta.url), 'utf8'));
    // Reproduce the hosted project's broad default grants and legacy table.
    await db.exec(`grant all on public.inventory to anon, authenticated;
      create table public.listings(id uuid default gen_random_uuid(), user_id uuid not null, title text);
      grant all on public.listings to anon, authenticated;
      create policy "Users can view their own listings" on public.listings for select using(auth.uid() = user_id);
      create policy "Users can insert their own listings" on public.listings for insert with check(auth.uid() = user_id);
      create policy "Users can update their own listings" on public.listings for update using(auth.uid() = user_id);
      create policy "Users can delete their own listings" on public.listings for delete using(auth.uid() = user_id);`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261108083105_harden_ai_access.sql', import.meta.url), 'utf8'));
    for (const table of ['inventory', 'listings']) {
      assert.equal((await db.query(`select has_table_privilege('authenticated','public.${table}','TRUNCATE') as allowed`)).rows[0].allowed, false);
      assert.equal((await db.query(`select has_table_privilege('anon','public.${table}','SELECT') as allowed`)).rows[0].allowed, false);
    }
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userId}';
      insert into public.inventory (user_id,platform,brand,category,condition,title) values ('${userId}','ebay','Brand','shirt','Good','Owner item');`);
    await assert.rejects(db.exec(`insert into public.inventory (user_id,platform,brand,category,condition,title) values ('${otherId}','ebay','Brand','shirt','Good','Forged item')`));
    await assert.rejects(db.exec(`update public.inventory set user_id = '${otherId}'`));
    await db.exec(`set request.jwt.claim.sub = '${otherId}'`);
    assert.equal((await db.query('select * from public.inventory')).rows.length, 0);
    assert.equal((await db.query('update public.inventory set title = \'Stolen\' returning id')).rows.length, 0);
    assert.equal((await db.query('delete from public.inventory returning id')).rows.length, 0);
    await assert.rejects(db.query(`select public.consume_ai_quota('${userId}')`));
    await assert.rejects(db.query('select * from private.ai_usage'));
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.inventory'));
    await assert.rejects(db.query(`select public.consume_ai_quota('${userId}')`));
    await db.exec('reset role; set role service_role');
    for (let i = 0; i < 10; i++) assert.equal((await db.query(`select public.consume_ai_quota('${userId}') as allowed`)).rows[0].allowed, true);
    assert.equal((await db.query(`select public.consume_ai_quota('${userId}') as allowed`)).rows[0].allowed, false);
    await db.exec(`update private.ai_usage set hour_start = hour_start - interval '1 hour' where user_id = '${userId}'`);
    assert.equal((await db.query(`select public.consume_ai_quota('${userId}') as allowed`)).rows[0].allowed, true);
    // Another account has its own allowance.
    assert.equal((await db.query(`select public.consume_ai_quota('${otherId}') as allowed`)).rows[0].allowed, true);
    await db.exec(`update private.ai_usage set hour_start = hour_start - interval '1 hour', day_count = 30 where user_id = '${userId}'`);
    assert.equal((await db.query(`select public.consume_ai_quota('${userId}') as allowed`)).rows[0].allowed, false);
    await db.exec(`update private.ai_usage set day_start = day_start - interval '1 day' where user_id = '${userId}'`);
    assert.equal((await db.query(`select public.consume_ai_quota('${userId}') as allowed`)).rows[0].allowed, true);
  } finally { await db.close(); }
});

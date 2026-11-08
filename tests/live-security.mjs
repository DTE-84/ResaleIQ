// Explicitly opt-in: creates disposable accounts, tests only their rows, then deletes them.
// Management keys and access tokens stay in memory and are never printed.
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const origin = 'https://tbizlbcifhgmxvlvdjat.supabase.co';
let keys;
try {
  keys = JSON.parse(execSync('npx --yes supabase projects api-keys --remote=tbizlbcifhgmxvlvdjat --reveal --output json', {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
  }));
} catch { throw new Error('Unable to obtain credentials through authenticated CLI.'); }
const anon = keys.find(k => k.name === 'anon')?.api_key;
const service = keys.find(k => k.name === 'service_role')?.api_key;
assert.ok(anon && service, 'Project API keys unavailable.');
const created = [];
const call = (path, token, init = {}) => fetch(origin + path, {
  ...init, headers: { apikey: token === service ? service : anon, Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(60_000),
});
async function account() {
  const email = `resaleiq-security-${randomUUID()}@example.invalid`;
  const password = randomUUID() + 'aA9!';
  const creation = await call('/auth/v1/admin/users', service, { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  assert.equal(creation.status, 200, 'Disposable account creation failed.');
  const user = await creation.json();
  created.push(user.id);
  const signin = await call('/auth/v1/token?grant_type=password', anon, { method: 'POST', body: JSON.stringify({ email, password }) });
  assert.equal(signin.status, 200, 'Test account sign-in failed.');
  const session = await signin.json();
  assert.ok(session.access_token);
  return { id: user.id, token: session.access_token };
}
try {
  const a = await account();
  const b = await account();
  const inventory = { user_id: a.id, platform: 'ebay', brand: 'Security test', category: 'Other', condition: 'Good', title: 'Disposable security verification' };
  const insert = await call('/rest/v1/inventory', a.token, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(inventory) });
  assert.equal(insert.status, 201, 'Owner inventory insert failed.');
  const [item] = await insert.json();
  assert.ok(item.id);
  const filter = `/rest/v1/inventory?id=eq.${item.id}`;
  const otherRead = await call(filter + '&select=id', b.token);
  assert.equal(otherRead.status, 200);
  assert.deepEqual(await otherRead.json(), [], 'Another account could read inventory.');
  for (const method of ['PATCH', 'DELETE']) {
    const response = await call(filter, b.token, { method, headers: { Prefer: 'return=representation' },
      ...(method === 'PATCH' ? { body: JSON.stringify({ title: 'Unauthorized edit' }) } : {}) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [], `Another account could ${method} inventory.`);
  }
  const ownerRead = await call(filter + '&select=title', a.token);
  assert.equal((await ownerRead.json())[0].title, inventory.title);
  const reassign = await call(filter, a.token, { method: 'PATCH', body: JSON.stringify({ user_id: b.id }) });
  assert.equal(reassign.status, 403, 'Ownership reassignment was allowed.');
  const forged = await call('/rest/v1/inventory', b.token, { method: 'POST', body: JSON.stringify(inventory) });
  assert.equal(forged.status, 403, 'Forged ownership insert was allowed.');
  for (const [label, token] of [['anonymous', anon], ['authenticated', a.token]]) {
    const response = await call('/rest/v1/rpc/consume_ai_quota', token, { method: 'POST', body: JSON.stringify({ p_user_id: a.id }) });
    assert.ok(response.status === 401 || response.status === 403 || response.status === 404, `${label} could invoke quota RPC.`);
  }
  console.log('PASS: real-account inventory isolation, ownership enforcement, and browser quota denial.');

  const ai = await call('/functions/v1/visual-ingestion', a.token, {
    method: 'POST', body: JSON.stringify({ action: 'generate-text', payload: { prompt: 'Return exactly this JSON object: {"status":"ok"}' } }),
  });
  if (ai.status !== 200) {
    const failure = await ai.json().catch(() => ({}));
    console.log('AI diagnostic:', ai.status, typeof failure.code === 'number' ? failure.code : 'handler');
    // Only emit this handler's fixed public messages, never arbitrary upstream content.
    if (['AI analysis is temporarily unavailable.', 'AI service is not configured.', 'Please sign in again.',
      'Usage verification is temporarily unavailable.', 'Service temporarily unavailable. Please try again.'].includes(failure.error)) {
      console.log(failure.error);
    }
  }
  assert.equal(ai.status, 200, 'Authenticated AI request failed.');
  const result = await ai.json();
  assert.equal(result.success, true);
  assert.equal(typeof result.text, 'string');
  console.log('PASS: authenticated AI request.');

  // Use the app's public icon, never a user's photo, for the vision smoke test.
  const image = readFileSync(new URL('../public/pwa-192x192.png', import.meta.url)).toString('base64');
  const vision = await call('/functions/v1/visual-ingestion', b.token, {
    method: 'POST', body: JSON.stringify({ action: 'analyze-image', payload: { mimeType: 'image/png', imageBase64: image } }),
  });
  assert.equal(vision.status, 200, 'Authenticated image analysis failed.');
  const identified = await vision.json();
  assert.equal(identified.success, true);
  assert.equal(typeof identified.identification?.title, 'string');
  assert.equal(identified.valuation, null, 'Vision endpoint fabricated a valuation.');
  console.log('PASS: real image identification without fabricated valuation.');

  // Fill only the disposable account quota through the server-only RPC. No extra provider calls.
  for (let i = 1; i < 10; i++) {
    const response = await call('/rest/v1/rpc/consume_ai_quota', service, { method: 'POST', body: JSON.stringify({ p_user_id: a.id }) });
    assert.equal(response.status, 200);
    assert.equal(await response.json(), true);
  }
  const limited = await call('/functions/v1/visual-ingestion', a.token, {
    method: 'POST', body: JSON.stringify({ action: 'generate-text', payload: { prompt: 'Must be rejected before AI call.' } }),
  });
  assert.equal(limited.status, 429, 'Hourly quota was not enforced.');
  console.log('PASS: live AI quota denial.');
} catch (error) {
  console.error('Live security verification failed:', error instanceof assert.AssertionError ? error.message.split('\n')[0] : 'request or setup failure');
  process.exitCode = 1;
} finally {
  for (const id of created) {
    // Only IDs returned by this script's creation requests can reach this cleanup.
    const response = await call(`/auth/v1/admin/users/${id}`, service, { method: 'DELETE' });
    if (response.ok) console.log('Removed disposable test account.');
    else { console.error('Disposable account cleanup failed for ID:', id); process.exitCode = 1; }
  }
}

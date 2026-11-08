import assert from 'node:assert/strict';

const origin = 'https://resale-iq-xi.vercel.app';
const home = await fetch(origin, { signal: AbortSignal.timeout(15000) });
assert.equal(home.status, 200, 'Production homepage unavailable.');
const html = await home.text();
const asset = html.match(/src="(\/assets\/[^"\s]+\.js)"/);
assert.ok(asset, 'Production bundle reference missing.');
const js = await fetch(new URL(asset[1], origin)).then(r => r.text());
assert.ok(js.includes('tbizlbcifhgmxvlvdjat.supabase.co'), 'Production uses an unexpected database project.');
assert.ok(process.env.VITE_SUPABASE_ANON_KEY && js.includes(process.env.VITE_SUPABASE_ANON_KEY), 'Production public key does not match the verified local key.');
assert.ok(js.includes('Verified marketplace pricing is not connected yet.'), 'Updated scanner missing from production.');
const legacy = await fetch(origin + '/api/generate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000),
});
assert.equal(legacy.status, 410, 'Legacy AI proxy is still available.');
console.log('PASS: production website, project/key configuration, truthful scanner, and retired legacy proxy.');

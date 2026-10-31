// EML-107 düzeltme 2: heartbeat sayaçları 'sidecar' alt anahtarına yazılır; orchestrator alt nesnesi
// ezilmez. Upsert gövdesinde counters YOK; sayaçlar rpc/set_sidecar_counters ile p_counters olarak gider.
const { test } = require('node:test');
const assert = require('node:assert');
const { SupabaseRest } = require('./supabase-rest');

const URL = 'https://example.supabase.co';

function recordingFetch(calls) {
  return async (url, init) => {
    calls.push({
      url,
      method: init.method,
      body: init.body === undefined ? undefined : JSON.parse(init.body),
      prefer: init.headers.Prefer,
    });
    return { ok: true, status: 204, text: async () => '' };
  };
}

test('heartbeat: upsert gövdesinde counters alanı YOK (orchestrator alt nesnesi ezilmez)', async () => {
  const calls = [];
  const rest = new SupabaseRest({ url: URL, serviceKey: 'svc', fetchImpl: recordingFetch(calls), now: () => 0 });

  await rest.heartbeat({ sessions_open: 2, misconfigured: false, counters: { ticks: 5, skipped_dm: 3 } });

  const upsert = calls.find((c) => c.url.includes('sidecar_heartbeat'));
  assert.ok(upsert, 'sidecar_heartbeat upsert çağrılmalı');
  assert.strictEqual(upsert.method, 'POST');
  assert.strictEqual(upsert.body.counters, undefined, 'upsert counters göndermemeli');
  assert.strictEqual(upsert.body.sessions_open, 2);
  assert.strictEqual(upsert.body.misconfigured, false);
});

test('heartbeat: sayaçlar rpc/set_sidecar_counters ile p_counters olarak yazılır', async () => {
  const calls = [];
  const rest = new SupabaseRest({ url: URL, serviceKey: 'svc', fetchImpl: recordingFetch(calls), now: () => 0 });
  const counters = { ticks: 5, skipped_dm: 3 };

  await rest.heartbeat({ sessions_open: 0, misconfigured: true, counters });

  const rpc = calls.find((c) => c.url.endsWith('/rest/v1/rpc/set_sidecar_counters'));
  assert.ok(rpc, 'set_sidecar_counters RPC çağrılmalı');
  assert.strictEqual(rpc.method, 'POST');
  assert.deepStrictEqual(rpc.body, { p_counters: counters });
});

test('heartbeat: counters nesne değilse p_counters boş nesne gönderilir', async () => {
  const calls = [];
  const rest = new SupabaseRest({ url: URL, serviceKey: 'svc', fetchImpl: recordingFetch(calls), now: () => 0 });

  await rest.heartbeat({ sessions_open: 0, misconfigured: false, counters: 'bozuk' });

  const rpc = calls.find((c) => c.url.endsWith('/rest/v1/rpc/set_sidecar_counters'));
  assert.deepStrictEqual(rpc.body, { p_counters: {} });
});

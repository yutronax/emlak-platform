// Supabase REST istekleri istek başına timeout ile sınırlıdır: asılı bir PostgREST çağrısı tick()
// döngüsünü (connect/disconnect işleme) ve oturum mesaj akışını sonsuza dek kilitleyemez.
// Timeout, çağıranlara ağ hatasıyla AYNI şekilde (fırlatılan hata) ulaşır. Gerçek ağ yok.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { SupabaseRest, REST_TIMEOUT_MS } = require('./supabase-rest');
const { SessionManager } = require('./manager');

const URL = 'https://example.supabase.co';
const SERVICE_KEY = 'svc-GIZLI-ANAHTAR';
const AGENT = '11111111-2222-4333-8444-555555555555';
const GROUP = '120363000000000001@g.us';

// Signal iptal edilene kadar asılı kalan fetch (gerçek PostgREST takılmasının taklidi).
function hangingFetch(calls) {
  return (url, init) => {
    calls.push({ url, signal: init.signal });
    return new Promise((_, rej) => {
      init.signal.addEventListener('abort', () => rej(init.signal.reason));
    });
  };
}

// AbortSignal.timeout zamanlayıcısı unref'lidir; test beklerken olay döngüsü boşalmasın diye tutucu.
async function withKeepAlive(fn) {
  const keep = setTimeout(() => {}, 5000);
  try {
    return await fn();
  } finally {
    clearTimeout(keep);
  }
}

// index.js'teki SessionsRest.fetchSelection ile aynı sorgu (index.js Baileys yüklediği için burada).
class SelectionRest extends SupabaseRest {
  async fetchSelection(agentId) {
    const rows = await this._request('GET', `wa_group_selection?select=group_jid&${this._agentFilter(agentId)}`);
    return (Array.isArray(rows) ? rows : []).map((r) => r.group_jid);
  }
}

test('varsayılan REST timeout 15 sn; her isteğe timeout signal eklenir', async () => {
  assert.strictEqual(REST_TIMEOUT_MS, 15_000);
  const seen = [];
  const calls = [];
  const rest = new SupabaseRest({
    url: URL,
    serviceKey: SERVICE_KEY,
    fetchImpl: async (url, init) => {
      calls.push(init);
      return { ok: true, status: 200, text: async () => '[]' };
    },
    timeoutSignal: (ms) => {
      seen.push(ms);
      return new AbortController().signal;
    },
  });
  await rest.fetchPendingRequests();
  assert.deepStrictEqual(seen, [REST_TIMEOUT_MS]);
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test('asılı istek timeout sonrası iptal edilir ve TimeoutError olarak fırlatılır (anahtar sızmaz)', async () => {
  const calls = [];
  const rest = new SupabaseRest({ url: URL, serviceKey: SERVICE_KEY, fetchImpl: hangingFetch(calls), timeoutMs: 5 });
  const err = await withKeepAlive(() => rest.fetchPendingRequests().then(() => null, (e) => e));
  assert.ok(err, 'istek reddedilmeli');
  assert.strictEqual(err.name, 'TimeoutError');
  assert.ok(calls[0].signal.aborted);
  assert.ok(!String(err.message).includes(SERVICE_KEY));
});

test('tick(): asılı fetchPendingRequests döngüyü sonsuza dek kilitlemez; _ticking serbest kalır, sonraki tick çalışır', async () => {
  const calls = [];
  const rest = new SupabaseRest({ url: URL, serviceKey: SERVICE_KEY, fetchImpl: hangingFetch(calls), timeoutMs: 5 });
  const manager = new SessionManager({
    rest,
    makeSocket: () => {
      throw new Error('soket açılmamalı');
    },
    authRoot: null,
    key: 'k',
    setTimeout: () => 0,
  });
  // tick() hatayı ağ hatası gibi yukarı iletir; üretimde _loop -> _guard loglayıp yeniden planlar.
  await withKeepAlive(() => assert.rejects(manager.tick(), { name: 'TimeoutError' }));
  assert.strictEqual(manager._ticking, false, 'kilit bırakılmalı');
  await withKeepAlive(() => assert.rejects(manager.tick(), { name: 'TimeoutError' }));
  assert.strictEqual(calls.length, 2, 'ikinci tick yeni istek atabilmeli');

  // _loop'un sardığı _guard ile: döngü reddetmez, yalnız hata adı loglanır (anahtar yok).
  const lines = [];
  const origErr = console.error;
  console.error = (...a) => lines.push(a.join(' '));
  try {
    await withKeepAlive(() => manager._guard('döngü', () => manager.tick()));
  } finally {
    console.error = origErr;
  }
  assert.ok(lines.some((l) => l.includes('TimeoutError')), lines.join('\n'));
  assert.ok(!lines.join('\n').includes(SERVICE_KEY));
});

test('heartbeat timeout: _guard ile yutulur ve loglanır', async () => {
  const calls = [];
  const rest = new SupabaseRest({ url: URL, serviceKey: SERVICE_KEY, fetchImpl: hangingFetch(calls), timeoutMs: 5 });
  const manager = new SessionManager({ rest, makeSocket: () => null, authRoot: null, key: 'k', setTimeout: () => 0 });
  const lines = [];
  const origErr = console.error;
  console.error = (...a) => lines.push(a.join(' '));
  try {
    await withKeepAlive(() => manager._guard('heartbeat', () => manager._beat()));
  } finally {
    console.error = origErr;
  }
  assert.ok(lines.some((l) => l.includes('heartbeat hata') && l.includes('TimeoutError')), lines.join('\n'));
});

test('KVKK: seçim okuması timeout olursa pesimist boş küme -> seçili grup mesajı İLETİLMEZ', async () => {
  const calls = [];
  const rest = new SelectionRest({ url: URL, serviceKey: SERVICE_KEY, fetchImpl: hangingFetch(calls), timeoutMs: 5 });
  const posts = [];
  const manager = new SessionManager({
    rest,
    makeSocket: () => null,
    authRoot: null,
    key: crypto.randomBytes(32).toString('hex'),
    setTimeout: () => 0,
    webhook: {
      url: 'http://127.0.0.1:1/baileys-webhook',
      secret: 'test-secret',
      fetchImpl: async (url, init) => {
        posts.push(init);
        return { ok: true, status: 200 };
      },
    },
  });
  const s = { agentId: AGENT, opened: true, sock: null, selection: null, groupNames: new Map() };
  const origErr = console.error;
  console.error = () => {};
  try {
    await withKeepAlive(() => manager._onMessage(s, {
      key: { remoteJid: GROUP, id: 'm-1', fromMe: false },
      message: { conversation: 'ilan metni' },
    }));
  } finally {
    console.error = origErr;
  }
  assert.strictEqual(posts.length, 0, 'seçim bilinmiyorsa iletilmemeli');
  assert.strictEqual(manager.msgCounters.selection_read_error, 1);
  assert.strictEqual(manager.msgCounters.skipped_unselected, 1);
});

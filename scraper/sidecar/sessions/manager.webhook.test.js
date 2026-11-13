// Kişisel oturum webhook teslimatı ortak webhook-delivery modülünü kullanır: ilk deneme beklenir,
// geçici hatada kuyruk (oturumun sıralı mesaj akışı bloklanmaz), kalıcı hata/tükenme sayaçla düşer.
// Sahte rest + sahte fetch + sahte saat; gerçek ağ/uyku yok.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { SessionManager } = require('./manager');
const { RETRY_DELAYS_MS } = require('../webhook-delivery');

const AGENT = '11111111-2222-4333-8444-555555555555';
const GROUP = '120363000000000001@g.us';
const KEY = crypto.randomBytes(32).toString('hex');
const TEXT = 'GIZLI-KISISEL-ILAN 0532 999 88 77';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r));
};

function fakeClock() {
  let t = Date.parse('2026-10-31T10:00:00.000Z');
  const timers = [];
  return {
    timers,
    now: () => t,
    setTimeout(fn, ms) {
      const h = { fn, at: t + ms, done: false, unref() { return h; } };
      timers.push(h);
      return h;
    },
    clearTimeout(h) {
      if (h) h.done = true;
    },
    async advance(ms) {
      const target = t + ms;
      for (;;) {
        const due = timers.filter((h) => !h.done && h.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        t = Math.max(t, due.at);
        due.done = true;
        due.fn();
        await flush();
      }
      t = target;
      await flush();
    },
  };
}

function makeHarness(responses, { webhook } = {}) {
  const clock = fakeClock();
  const posts = [];
  const fetchImpl = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body), signal: init.signal });
    const r = responses[Math.min(posts.length - 1, responses.length - 1)];
    if (r === 'throw') throw new TypeError('fetch failed');
    return { ok: r >= 200 && r < 300, status: r, statusText: 'X' };
  };
  const manager = new SessionManager({
    rest: {
      async fetchSelection() {
        return [GROUP];
      },
    },
    makeSocket: () => {
      throw new Error('soket açılmamalı');
    },
    authRoot: null,
    key: KEY,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    rnd: () => 0.5,
    webhook: webhook === undefined ? { url: 'http://127.0.0.1:1/baileys-webhook', secret: 'test-secret', fetchImpl } : webhook,
  });
  const s = { agentId: AGENT, opened: true, sock: null, selection: null, groupNames: new Map() };
  return { manager, posts, s, clock };
}

const incoming = (id) => ({ key: { remoteJid: GROUP, id, fromMe: false }, message: { conversation: TEXT } });

function captureConsole() {
  const orig = { log: console.log, error: console.error, warn: console.warn };
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  console.error = (...a) => lines.push(a.join(' '));
  console.warn = (...a) => lines.push(a.join(' '));
  return { lines, restore: () => Object.assign(console, orig) };
}

test('manager ortak teslimatı kullanır: deneme başına timeout signal gönderilir', async () => {
  const h = makeHarness([200]);
  await h.manager._onMessage(h.s, incoming('w0'));
  assert.strictEqual(h.posts.length, 1);
  assert.ok(h.posts[0].signal instanceof AbortSignal);
  assert.strictEqual(h.posts[0].body.agentId, AGENT);
  assert.strictEqual(h.manager.webhookDelivery.pending(), 0);
});

test('geçici hata: _onMessage ilk denemeden sonra döner, mesaj kuyruğa alınır, sonra teslim edilir', async () => {
  const h = makeHarness([503, 200]);
  const cap = captureConsole();
  try {
    await h.manager._onMessage(h.s, incoming('w1'));
    assert.strictEqual(h.posts.length, 1);
    assert.strictEqual(h.manager.webhookDelivery.pending(), 1);
    assert.strictEqual(h.manager.msgCounters.webhook_post_failed, 0, 'kuyruktaki mesaj henüz düşmüş sayılmaz');
    await h.clock.advance(RETRY_DELAYS_MS[0]);
  } finally {
    cap.restore();
  }
  assert.strictEqual(h.posts.length, 2);
  assert.strictEqual(h.posts[1].body.id, 'w1');
  assert.strictEqual(h.manager.webhookDelivery.pending(), 0);
  assert.strictEqual(h.manager.msgCounters.webhook_post_failed, 0);
});

test('oturum mesaj akışı bloklanmaz: bekleyen yeniden denemeler varken sonraki mesajlar hemen işlenir', async () => {
  const h = makeHarness(['throw']);
  const sock = { ev: { on() {} } };
  h.s.sock = sock;
  h.manager.sessions.set(AGENT, h.s);
  const cap = captureConsole();
  try {
    await h.manager._onMessages(h.s, sock, { type: 'notify', messages: [incoming('b1'), incoming('b2'), incoming('b3')] });
  } finally {
    cap.restore();
  }
  assert.deepStrictEqual(h.posts.map((p) => p.body.id), ['b1', 'b2', 'b3'], 'saat ilerlemeden üçü de denenmeli');
  assert.strictEqual(h.manager.webhookDelivery.pending(), 3);
});

test('kalıcı 4xx: yeniden denenmez, webhook_post_failed artar', async () => {
  const h = makeHarness([403]);
  const cap = captureConsole();
  try {
    await h.manager._onMessage(h.s, incoming('p1'));
    await h.clock.advance(10 * 60_000);
  } finally {
    cap.restore();
  }
  assert.strictEqual(h.posts.length, 1);
  assert.strictEqual(h.manager.msgCounters.webhook_post_failed, 1);
});

test('401: BAILEYS_WEBHOOK_SECRET ipucu loglanır', async () => {
  const h = makeHarness([401]);
  const cap = captureConsole();
  try {
    await h.manager._onMessage(h.s, incoming('a1'));
  } finally {
    cap.restore();
  }
  assert.ok(cap.lines.some((l) => l.includes('BAILEYS_WEBHOOK_SECRET uyuşmuyor')), cap.lines.join('\n'));
});

test('denemeler tükenince webhook_post_failed artar; KVKK: hiçbir log satırında metin/JID/telefon yok', async () => {
  const h = makeHarness([500]);
  const cap = captureConsole();
  try {
    await h.manager._onMessage(h.s, incoming('x1'));
    for (const d of RETRY_DELAYS_MS) await h.clock.advance(d);
  } finally {
    cap.restore();
  }
  assert.strictEqual(h.posts.length, 1 + RETRY_DELAYS_MS.length);
  assert.strictEqual(h.manager.msgCounters.webhook_post_failed, 1);
  const all = cap.lines.join('\n');
  assert.ok(cap.lines.length > 0, 'test anlamlı olsun');
  for (const needle of ['GIZLI-KISISEL-ILAN', '0532', '120363000000000001', AGENT, 'test-secret']) {
    assert.ok(!all.includes(needle), `loglarda "${needle}" görünmemeli`);
  }
});

test('webhook yapılandırması yoksa (secret yok) POST yok, webhook_post_failed artar', async () => {
  const h = makeHarness([200], { webhook: { url: 'http://127.0.0.1:1/x', secret: undefined } });
  await h.manager._onMessage(h.s, incoming('n1'));
  assert.strictEqual(h.posts.length, 0);
  assert.strictEqual(h.manager.msgCounters.webhook_post_failed, 1);
});

test('stop(): bekleyen yeniden deneme kuyruğu bırakılır (zamanlayıcı ateşlense de POST yok)', async () => {
  const h = makeHarness([503, 200]);
  const cap = captureConsole();
  try {
    await h.manager._onMessage(h.s, incoming('s1'));
    h.manager.stop();
    await h.clock.advance(120_000);
  } finally {
    cap.restore();
  }
  assert.strictEqual(h.posts.length, 1);
  assert.strictEqual(h.manager.webhookDelivery.pending(), 0);
});

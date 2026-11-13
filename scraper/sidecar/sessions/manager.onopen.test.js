// _onOpen: wa_connections/wa_connection_events yazımı başarısız olsa (ağ hatası / REST timeout) bile
// mesaj dinleyicisi bağlanır ve grup senkronu denenir; aksi halde bağlı oturumun mesajları sessizce
// hiç iletilmezdi. Sahte rest + sahte soket + sahte webhook fetch; gerçek ağ yok.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { SessionManager } = require('./manager');

const AGENT = '11111111-2222-4333-8444-555555555555';
const GROUP = '120363000000000001@g.us';
const PHONE_JID = '905321234512:7@s.whatsapp.net';
const TEXT = 'GIZLI-ONOPEN-ILAN 0532 123 45 12';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r));
};

function makeHarness({ updateFails = false, eventFails = false } = {}) {
  const calls = { update: 0, insertEvent: 0, groupFetch: 0, upsertWaGroups: 0 };
  const rest = {
    async update() {
      calls.update += 1;
      if (updateFails) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    },
    async insertEvent() {
      calls.insertEvent += 1;
      if (eventFails) throw new TypeError('fetch failed');
    },
    async fetchSelection() {
      return [GROUP];
    },
    async upsertWaGroups() {
      calls.upsertWaGroups += 1;
      return 'ok';
    },
  };
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
        posts.push(JSON.parse(init.body));
        return { ok: true, status: 200 };
      },
    },
  });
  const handlers = {};
  const sock = {
    user: { id: PHONE_JID },
    ev: {
      on(name, fn) {
        handlers[name] = fn;
      },
    },
    async groupFetchAllParticipating() {
      calls.groupFetch += 1;
      return { [GROUP]: { id: GROUP, subject: 'Grup' } };
    },
  };
  const s = { agentId: AGENT, attemptId: null, sock, status: 'qr', qrCount: 1, opened: false, retries: 0, fresh: true };
  manager.sessions.set(AGENT, s);
  return { manager, s, sock, handlers, posts, calls };
}

async function openAndReceive(h) {
  const lines = [];
  const orig = { log: console.log, error: console.error };
  console.log = (...a) => lines.push(a.join(' '));
  console.error = (...a) => lines.push(a.join(' '));
  const unhandled = [];
  const onUnhandled = (e) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    // Üretimdeki gibi connection.update dinleyicisi _guard ile sarar; burada doğrudan çağrılır.
    await h.manager._onOpen(h.s, h.sock);
    assert.strictEqual(typeof h.handlers['messages.upsert'], 'function', 'mesaj dinleyicisi bağlanmalı');
    h.handlers['messages.upsert']({
      type: 'notify',
      messages: [{ key: { remoteJid: GROUP, id: 'o-1', fromMe: false }, message: { conversation: TEXT } }],
    });
    await flush();
  } finally {
    Object.assign(console, orig);
    process.off('unhandledRejection', onUnhandled);
  }
  return { lines, unhandled };
}

test('_onOpen: rest.update reddederse dinleyici yine bağlanır ve seçili grup mesajı iletilir', async () => {
  const h = makeHarness({ updateFails: true });
  const r = await openAndReceive(h);
  assert.strictEqual(h.posts.length, 1);
  assert.strictEqual(h.posts[0].id, 'o-1');
  assert.strictEqual(h.calls.insertEvent, 1, 'olay yazımı yine denenmeli');
  assert.ok(r.lines.some((l) => l.includes('TimeoutError')), r.lines.join('\n'));
});

test('_onOpen: rest.insertEvent reddederse dinleyici yine bağlanır ve mesaj iletilir', async () => {
  const h = makeHarness({ eventFails: true });
  await openAndReceive(h);
  assert.strictEqual(h.posts.length, 1);
});

test('_onOpen: ikisi de reddederse dinleyici bağlı, grup senkronu denenir, unhandled rejection yok, loglar içeriksiz', async () => {
  const h = makeHarness({ updateFails: true, eventFails: true });
  const r = await openAndReceive(h);
  assert.strictEqual(h.posts.length, 1);
  assert.strictEqual(h.calls.groupFetch, 1, 'grup senkronu denenmeli');
  assert.strictEqual(h.calls.upsertWaGroups, 1);
  assert.strictEqual(r.unhandled.length, 0);
  assert.strictEqual(h.s.status, 'connected');
  const all = r.lines.join('\n');
  assert.ok(r.lines.length > 0, 'test anlamlı olsun');
  for (const needle of ['GIZLI-ONOPEN-ILAN', '0532', '905321234512', '120363000000000001', 'test-secret']) {
    assert.ok(!all.includes(needle), `loglarda "${needle}" görünmemeli`);
  }
});

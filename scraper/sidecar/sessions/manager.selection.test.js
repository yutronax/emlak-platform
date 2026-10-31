// EML-107 düzeltme 1 + 3 (sidecar tarafı): seçim-dışı mesajlar webhook'a gitmez ve içerik okunmadan
// sayılır (AC-5, AC-S4). Seçim boşken de sınıflandırma çalışır. Sahte rest + sahte webhook fetch.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { SessionManager } = require('./manager');

const AGENT = '11111111-2222-4333-8444-555555555555';
const GROUP = '120363000000000001@g.us';
const OTHER_GROUP = '120363000000000009@g.us';
const NOW = Date.parse('2026-10-31T10:00:00.000Z');
const KEY = crypto.randomBytes(32).toString('hex');

function makeHarness({ selection = [], selectionError = false } = {}) {
  const posts = [];
  const rest = {
    async fetchSelection() {
      if (selectionError) throw new Error('db down');
      return selection;
    },
    async fetchPendingRequests() {
      return [];
    },
  };
  const fetchImpl = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200 };
  };
  const manager = new SessionManager({
    rest,
    makeSocket: () => {
      throw new Error('soket açılmamalı');
    },
    authRoot: null,
    key: KEY,
    now: () => NOW,
    setTimeout: () => 0,
    webhook: { url: 'http://127.0.0.1:1/baileys-webhook', secret: 'test-secret', fetchImpl },
  });
  const s = { agentId: AGENT, opened: true, sock: null, selection: null, groupNames: new Map() };
  return { manager, posts, s };
}

const incoming = (remoteJid, text, id = 'm-1') => ({
  key: { remoteJid, id, fromMe: false },
  message: { conversation: text },
});

test('seçili grup metni webhook\'a gider ve hiçbir sayaç artmaz', async () => {
  const h = makeHarness({ selection: [GROUP] });
  await h.manager._onMessage(h.s, incoming(GROUP, 'SECILI-ILAN-METNI'));

  assert.strictEqual(h.posts.length, 1, 'seçili grup mesajı tam 1 kez webhook\'a gitmeli');
  assert.strictEqual(h.posts[0].body.group, GROUP);
  assert.strictEqual(h.posts[0].body.agentId, AGENT);
  assert.strictEqual(h.manager.msgCounters.skipped_unselected, 0);
  assert.strictEqual(h.manager.msgCounters.skipped_dm, 0);
});

test('seçilmemiş grup: içerik webhook\'a gitmez, skipped_unselected artar', async () => {
  const h = makeHarness({ selection: [OTHER_GROUP] });
  await h.manager._onMessage(h.s, incoming(GROUP, 'SECILMEYEN-ICERIK-XYZ'));

  assert.strictEqual(h.posts.length, 0, 'seçilmeyen grup webhook\'a gitmemeli');
  assert.strictEqual(h.manager.msgCounters.skipped_unselected, 1);
  assert.ok(!JSON.stringify(h.posts).includes('SECILMEYEN-ICERIK-XYZ'));
});

test('seçim boş (hiç grup seçili değil): her grup mesajı skipped_unselected sayılır, webhook yok', async () => {
  const h = makeHarness({ selection: [] });
  await h.manager._onMessage(h.s, incoming(GROUP, 'ILK', 'a'));
  await h.manager._onMessage(h.s, incoming(GROUP, 'IKINCI', 'b'));

  assert.strictEqual(h.posts.length, 0);
  assert.strictEqual(h.manager.msgCounters.skipped_unselected, 2);
});

test('DM mesajı (içerikli): skipped_dm artar, içerik webhook\'a gitmez', async () => {
  const h = makeHarness({ selection: [GROUP] });
  await h.manager._onMessage(h.s, incoming('905321234512@s.whatsapp.net', 'DM-ICERIK-QWE'));

  assert.strictEqual(h.posts.length, 0);
  assert.strictEqual(h.manager.msgCounters.skipped_dm, 1);
  assert.ok(!JSON.stringify(h.posts).includes('DM-ICERIK-QWE'));
});

test('metinsiz DM (tepki/protokol) da skipped_dm sayılır; metinsiz seçili grup sayılmaz', async () => {
  const h = makeHarness({ selection: [GROUP] });
  await h.manager._onMessage(h.s, { key: { remoteJid: '905321234512@s.whatsapp.net', id: 'r1', fromMe: false }, message: {} });
  await h.manager._onMessage(h.s, { key: { remoteJid: GROUP, id: 'r2', fromMe: false }, message: {} });

  assert.strictEqual(h.manager.msgCounters.skipped_dm, 1);
  assert.strictEqual(h.manager.msgCounters.skipped_unselected, 0);
  assert.strictEqual(h.posts.length, 0);
});

test('kendi gönderdiğim mesajlar (fromMe) hiçbir sayacı artırmaz', async () => {
  const h = makeHarness({ selection: [] });
  await h.manager._onMessage(h.s, { key: { remoteJid: GROUP, id: 'o1', fromMe: true }, message: { conversation: 'x' } });

  assert.strictEqual(h.manager.msgCounters.skipped_unselected, 0);
  assert.strictEqual(h.posts.length, 0);
});

test('seçim okunamazsa (pesimist) boş küme: seçili grup da işlenmez, selection_read_error sayılır', async () => {
  const h = makeHarness({ selectionError: true });
  await h.manager._onMessage(h.s, incoming(GROUP, 'OKUNAMADI'));

  assert.strictEqual(h.posts.length, 0);
  assert.strictEqual(h.manager.msgCounters.selection_read_error, 1);
  assert.strictEqual(h.manager.msgCounters.skipped_unselected, 1);
});

// EML-107 tur-3 (red-team, medium): grup senkronu tam liste otoritesidir.
//   - Boş liste geçerli bir sonuçtur: upsertWaGroups(agent, []) çağrılır (DB tümünü siler).
//   - groupFetchAllParticipating HATA verirse (veya geçersiz sonuç dönerse) upsertWaGroups HİÇ
//     çağrılmaz (pesimist: hata = silme yok), sayaç groups_sync_error artar.
// Sahte rest (upsertWaGroups kaydı) + sahte soket (groupFetchAllParticipating).
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const { SessionManager } = require('./manager');

const AGENT = '11111111-2222-4333-8444-555555555555';
const GROUP_A = '120363000000000001@g.us';
const GROUP_B = '120363000000000002@g.us';
const NOW = Date.parse('2026-10-31T10:00:00.000Z');
const KEY = crypto.randomBytes(32).toString('hex');

function makeHarness({ meta, metaError = null, upsertResult = 'ok' } = {}) {
  const upserts = [];
  const rest = {
    async upsertWaGroups(agentId, rows) {
      upserts.push({ agentId, rows });
      return upsertResult;
    },
    async fetchSelection() {
      return [];
    },
    async fetchPendingRequests() {
      return [];
    },
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
  });
  const sock = {
    ev: new EventEmitter(),
    async groupFetchAllParticipating() {
      if (metaError) throw metaError;
      return meta;
    },
  };
  const s = { agentId: AGENT, opened: true, sock, selection: null, groupNames: new Map(), status: 'connected' };
  manager.sessions.set(AGENT, s);
  return { manager, upserts, s, sock };
}

test('boş grup listesi: upsertWaGroups boş satırlarla çağrılır (tümünü silmek için)', async () => {
  const h = makeHarness({ meta: {} });
  await h.manager._syncGroups(h.s, h.sock);

  assert.strictEqual(h.upserts.length, 1, 'boş sonuçta da RPC çağrılmalı');
  assert.strictEqual(h.upserts[0].agentId, AGENT);
  assert.deepStrictEqual(h.upserts[0].rows, []);
  assert.strictEqual(h.manager.msgCounters.groups_sync_error, 0);
});

test('dolu grup listesi: satırlar (agent, jid, name) olarak RPC\'ye gider', async () => {
  const h = makeHarness({
    meta: {
      [GROUP_A]: { id: GROUP_A, subject: 'Kadıköy Emlak' },
      [GROUP_B]: { id: GROUP_B },
    },
  });
  await h.manager._syncGroups(h.s, h.sock);

  assert.strictEqual(h.upserts.length, 1);
  assert.deepStrictEqual(
    h.upserts[0].rows.map((r) => [r.group_jid, r.name]),
    [[GROUP_A, 'Kadıköy Emlak'], [GROUP_B, null]],
  );
});

test('fetch hatası: upsertWaGroups çağrılmaz (silme yok), groups_sync_error artar', async () => {
  const h = makeHarness({ metaError: new Error('baileys timeout') });
  await h.manager._syncGroups(h.s, h.sock);

  assert.strictEqual(h.upserts.length, 0, 'fetch hatasında RPC çağrılmamalı');
  assert.strictEqual(h.manager.msgCounters.groups_sync_error, 1);
});

test('geçersiz (null) fetch sonucu: RPC çağrılmaz; boş liste gibi davranıp silmez', async () => {
  const h = makeHarness({ meta: null });
  await h.manager._syncGroups(h.s, h.sock);

  assert.strictEqual(h.upserts.length, 0, 'null sonuç boş liste sayılmamalı');
  assert.strictEqual(h.manager.msgCounters.groups_sync_error, 1);
});

test('fetch hatası sonrası bir sonraki başarılı senkron RPC\'yi çağırır', async () => {
  const h = makeHarness({ metaError: new Error('transient') });
  await h.manager._syncGroups(h.s, h.sock);
  h.sock.groupFetchAllParticipating = async () => ({});
  await h.manager._syncGroups(h.s, h.sock);

  assert.strictEqual(h.upserts.length, 1);
  assert.deepStrictEqual(h.upserts[0].rows, []);
  assert.strictEqual(h.manager.msgCounters.groups_sync_error, 1);
});

test('RPC not_connected dönerse groups_sync_rejected artar (mevcut davranış korunur)', async () => {
  const h = makeHarness({ meta: { [GROUP_A]: { id: GROUP_A, subject: 'X' } }, upsertResult: 'not_connected' });
  await h.manager._syncGroups(h.s, h.sock);

  assert.strictEqual(h.upserts.length, 1);
  assert.strictEqual(h.manager.msgCounters.groups_sync_rejected, 1);
});

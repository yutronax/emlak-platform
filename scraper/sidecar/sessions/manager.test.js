// EML-105 / EML-104 AC-2..AC-S6: SessionManager durum makinesi (sahte rest + sahte soket).
//
// Arayüz sözleşmesi (implementasyonun uyması gereken):
//   new SessionManager({ rest, makeSocket, authRoot, key, maxSessions, now, setTimeout })
//   await manager.tick()            -> tek poll turu (rest.fetchPendingRequests + işleme)
//   makeSocket(opts)               -> opts: { agentId, auth, syncFullHistory:false, markOnlineOnConnect:false, ... }
//                                     opts.auth = useEncryptedAuthState(...).state; sock.ev = EventEmitter; sock.logout()
//   rest (sidecar Supabase istemcisi) metotları:
//     fetchPendingRequests() -> [{agent_id, requested_action, attempt_id}]
//     update(agentId, fields)        -> yalnız izinli alanlar
//     insertEvent(agentId, {attempt_id, from_status, to_status, error_code})
//     deleteConnection(agentId)
//     heartbeat(payload)
//     isSubscriptionActive(agentId) -> boolean
//     listConnectedAgents()         -> [agent_id...]
//
// Baileys DisconnectReason sayıları (bağımlılık yüklemeden sabit): loggedOut=401, connectionReplaced=440.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const util = require('node:util');
const { EventEmitter } = require('node:events');

const { SessionManager } = require('./manager');
const { agentAuthDir } = require('./paths');

const AGENT = '11111111-2222-4333-8444-555555555555';
const AGENT_B = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const ATTEMPT = '99999999-8888-4777-8666-555555555555';
const KEY = crypto.randomBytes(32).toString('hex');
const NOW = Date.parse('2026-10-31T10:00:00.000Z');
const PHONE_JID = '905321234512@s.whatsapp.net';
const PHONE_FULL = '905321234512';
const PHONE_MASKED = '+90 5** *** **12';
const QR_OK = '2@QRSECRET-ABC';
const LOGGED_OUT = 401;
const REPLACED = 440;
const TRANSIENT = 500;

const ALLOWED_UPDATE_FIELDS = new Set([
  'status',
  'qr',
  'qr_expires_at',
  'qr_count',
  'phone_masked',
  'error_code',
  'last_seen_at',
  'requested_action',
  'updated_at',
]);

let authRoot;

beforeEach(() => {
  authRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-manager-test-'));
});

afterEach(() => {
  fs.rmSync(authRoot, { recursive: true, force: true });
});

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r));
};

function makeRest() {
  const rest = {
    calls: [],
    pending: [],
    async fetchPendingRequests() {
      rest.calls.push({ method: 'fetchPendingRequests' });
      const rows = rest.pending;
      rest.pending = [];
      return rows;
    },
    async update(agentId, fields) {
      rest.calls.push({ method: 'update', agentId, fields: { ...fields } });
    },
    async insertEvent(agentId, ev) {
      rest.calls.push({ method: 'insertEvent', agentId, ev: { ...ev } });
    },
    async deleteConnection(agentId) {
      rest.calls.push({ method: 'deleteConnection', agentId });
    },
    async heartbeat(payload) {
      rest.calls.push({ method: 'heartbeat', payload });
    },
    async isSubscriptionActive() {
      return true;
    },
    async listConnectedAgents() {
      return [];
    },
  };
  return rest;
}

function makeFakeSocket(opts) {
  const sock = {
    ev: new EventEmitter(),
    opts,
    user: undefined,
    logoutCalls: 0,
    async logout() {
      sock.logoutCalls += 1;
    },
  };
  return sock;
}

function writeMarker(agentId) {
  const dir = agentAuthDir(authRoot, agentId);
  fs.writeFileSync(path.join(dir, 'marker.txt'), 'x');
}

// opts.onMake(sock, makeSocketOpts) verilmezse, auth klasörüne işaret dosyası yazılır
// (böylece "auth silinir" assert'leri anlamlı olur).
function harness(opts = {}) {
  const key = 'key' in opts ? opts.key : KEY;
  const maxSessions = opts.maxSessions === undefined ? 50 : opts.maxSessions;
  const rest = makeRest();
  const sockets = [];
  const timers = [];
  let clock = NOW;

  const makeSocket = (socketOpts) => {
    const sock = makeFakeSocket(socketOpts);
    sockets.push(sock);
    if (opts.onMake) opts.onMake(sock, socketOpts);
    else writeMarker(socketOpts.agentId);
    return sock;
  };

  const manager = new SessionManager({
    rest,
    makeSocket,
    authRoot,
    key,
    maxSessions,
    now: () => clock,
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
  });

  return { rest, sockets, timers, manager };
}

function queueRow(rest, action, agentId = AGENT) {
  rest.pending.push({ agent_id: agentId, requested_action: action, attempt_id: ATTEMPT });
}

function merged(rest, agentId = AGENT) {
  return rest.calls
    .filter((c) => c.method === 'update' && c.agentId === agentId)
    .reduce((acc, c) => Object.assign(acc, c.fields), {});
}

function qrUpdates(rest, agentId = AGENT) {
  return rest.calls.filter((c) => c.method === 'update' && c.agentId === agentId && c.fields.status === 'qr');
}

function emitQr(sock, qr) {
  sock.ev.emit('connection.update', { qr });
}

function emitOpen(sock) {
  sock.user = { id: PHONE_JID };
  sock.ev.emit('connection.update', { connection: 'open' });
}

function emitClose(sock, statusCode) {
  sock.ev.emit('connection.update', {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode } } },
  });
}

async function runAllTimers(h, limit = 20) {
  let n = 0;
  while (h.timers.length && n < limit) {
    const t = h.timers.shift();
    await t.fn();
    await flush();
    n += 1;
  }
}

// ---------------------------------------------------------------------------
// Bağlama akışı
// ---------------------------------------------------------------------------

test('pending connect isteği işlenince makeSocket çağrılır (auth state ile)', async () => {
  const h = harness();
  queueRow(h.rest, 'connect');

  await h.manager.tick();

  assert.strictEqual(h.sockets.length, 1, 'makeSocket tam 1 kez çağrılmalı');
  assert.strictEqual(h.sockets[0].opts.agentId, AGENT);
  assert.ok(h.sockets[0].opts.auth, 'makeSocket şifreli auth state almalı');
});

test('connection.update {qr} → rest.update status=qr, qr, qr_expires_at=+20 sn, ve event kaydı', async () => {
  const h = harness();
  queueRow(h.rest, 'connect');
  await h.manager.tick();

  emitQr(h.sockets[0], QR_OK);
  await flush();

  const q = qrUpdates(h.rest);
  assert.ok(q.length >= 1, 'status=qr için rest.update çağrılmalı');
  assert.strictEqual(q[0].fields.qr, QR_OK);
  assert.strictEqual(new Date(q[0].fields.qr_expires_at).getTime(), NOW + 20_000);

  assert.ok(
    h.rest.calls.some((c) => c.method === 'insertEvent' && c.agentId === AGENT && c.ev.to_status === 'qr'),
    'QR geçişi wa_connection_events için insertEvent ile kaydedilmeli',
  );
});

test("connection.update {connection:'open'} → connected, maskeli numara, qr null", async () => {
  const h = harness();
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  emitQr(h.sockets[0], QR_OK);
  await flush();

  emitOpen(h.sockets[0]);
  await flush();

  const m = merged(h.rest);
  assert.strictEqual(m.status, 'connected');
  assert.strictEqual(m.phone_masked, PHONE_MASKED);
  assert.strictEqual(m.qr, null, 'bağlantı kurulunca QR null olmalı');
  assert.ok(
    !h.rest.calls.some((c) => JSON.stringify(c).includes(PHONE_FULL)),
    'tam telefon numarası rest çağrılarında geçmemeli',
  );
});

// ---------------------------------------------------------------------------
// AC-4: mesaj işlenmez
// ---------------------------------------------------------------------------

test('AC-4: kişisel soket — messages.upsert dinleyicisi YOK; syncFullHistory:false, markOnlineOnConnect:false', async () => {
  const h = harness();
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  const sock = h.sockets[0];

  assert.strictEqual(sock.opts.syncFullHistory, false);
  assert.strictEqual(sock.opts.markOnlineOnConnect, false);
  assert.strictEqual(sock.ev.listenerCount('messages.upsert'), 0);

  emitQr(sock, QR_OK);
  await flush();
  emitOpen(sock);
  await flush();

  assert.strictEqual(sock.ev.listenerCount('messages.upsert'), 0, 'bağlandıktan sonra da dinleyici olmamalı');
});

// ---------------------------------------------------------------------------
// AC-6: QR süresi
// ---------------------------------------------------------------------------

test('AC-6: 5 QR yenilemesinden sonra taranmazsa disconnected/qr_expired ve auth klasörü silinir', async () => {
  const h = harness();
  const dir = agentAuthDir(authRoot, AGENT);
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  const sock = h.sockets[0];

  for (let i = 1; i <= 6; i += 1) {
    emitQr(sock, `2@QR-${i}`);
    await flush();
  }

  const shown = qrUpdates(h.rest).length;
  // "5 QR'dan sonra" — ilk QR dahil 5 QR gösterilip süre dolmalı; 6. yenilemede sona erer.
  assert.ok(shown >= 5 && shown <= 6, `beklenen 5-6 QR gösterimi, gerçek: ${shown}`);

  const m = merged(h.rest);
  assert.strictEqual(m.status, 'disconnected');
  assert.strictEqual(m.error_code, 'qr_expired');
  assert.ok(!fs.existsSync(dir), 'qr_expired sonrası auth klasörü silinmeli');
});

// ---------------------------------------------------------------------------
// AC-5 / AC-8: kapanış sınıfları
// ---------------------------------------------------------------------------

test('AC-5: loggedOut (401) → logged_out, auth klasörü silinir, yeniden bağlanma planlanmaz', async () => {
  const h = harness();
  const dir = agentAuthDir(authRoot, AGENT);
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  emitOpen(h.sockets[0]);
  await flush();

  emitClose(h.sockets[0], LOGGED_OUT);
  await flush();

  assert.strictEqual(merged(h.rest).status, 'logged_out');
  assert.ok(!fs.existsSync(dir), 'loggedOut sonrası auth klasörü silinmeli');

  await runAllTimers(h);
  assert.strictEqual(h.sockets.length, 1, 'loggedOut sonrası makeSocket tekrar çağrılmamalı');
});

test('AC-8: connectionReplaced (440) → disconnected/replaced, otomatik yeniden bağlanma YOK', async () => {
  const h = harness();
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  emitOpen(h.sockets[0]);
  await flush();

  emitClose(h.sockets[0], REPLACED);
  await flush();

  const m = merged(h.rest);
  assert.strictEqual(m.status, 'disconnected');
  assert.strictEqual(m.error_code, 'replaced');
  assert.strictEqual(h.timers.length, 0, 'replaced sonrası yeniden bağlanma zamanlayıcısı kurulmamalı');

  await runAllTimers(h);
  assert.strictEqual(h.sockets.length, 1, 'replaced sonrası makeSocket tekrar çağrılmamalı');
});

test('AC-8: diğer kapanış (500) → backoff: ilk gecikme ~2 sn, artar, ≤ 5 dk; auth silinmez', async () => {
  const h = harness();
  const dir = agentAuthDir(authRoot, AGENT);
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  emitOpen(h.sockets[0]);
  await flush();

  emitClose(h.sockets[0], TRANSIENT);
  await flush();
  assert.ok(fs.existsSync(dir), 'geçici kopmada auth klasörü silinmemeli');

  const delays = [];
  for (let i = 0; i < 12; i += 1) {
    const t = h.timers.splice(0).pop();
    assert.ok(t, `kopma #${i + 1} için yeniden bağlanma setTimeout ile planlanmalı`);
    delays.push(t.ms);
    await t.fn();
    await flush();
    emitClose(h.sockets[h.sockets.length - 1], TRANSIENT);
    await flush();
  }

  assert.ok(delays[0] >= 1000 && delays[0] <= 2500, `ilk gecikme ~2000 ms olmalı, gerçek: ${delays[0]}`);
  for (const d of delays) {
    assert.ok(d <= 300_000, `gecikme 5 dakikayı (300000 ms) aşmamalı, gerçek: ${d}`);
  }
  assert.ok(delays[11] >= 150_000, `12. denemede gecikme üst sınıra yakın olmalı, gerçek: ${delays[11]}`);
  assert.ok(delays[2] > delays[0], 'gecikme artmalı (üstel backoff)');
  assert.strictEqual(h.sockets.length, 13, 'her kopmada bir kez yeniden makeSocket çağrılmalı');
});

// ---------------------------------------------------------------------------
// Bağlantı kesme (AC-3)
// ---------------------------------------------------------------------------

test('AC-3: disconnect isteği → sock.logout, auth silinir, rest satırı silinir ve event kaydedilir', async () => {
  const h = harness();
  const dir = agentAuthDir(authRoot, AGENT);
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  emitOpen(h.sockets[0]);
  await flush();

  queueRow(h.rest, 'disconnect');
  await h.manager.tick();

  assert.strictEqual(h.sockets[0].logoutCalls, 1, 'sock.logout() bir kez çağrılmalı');
  assert.ok(!fs.existsSync(dir), 'disconnect sonrası auth klasörü silinmeli');
  assert.ok(
    h.rest.calls.some((c) => c.method === 'deleteConnection' && c.agentId === AGENT),
    'wa_connections satırı silinmeli',
  );
  assert.ok(
    h.rest.calls.some((c) => c.method === 'insertEvent' && c.agentId === AGENT),
    'disconnect için wa_connection_events kaydı düşmeli',
  );
});

// ---------------------------------------------------------------------------
// Kapasite / yapılandırma (AC-10 / AC-S3 / AC-11)
// ---------------------------------------------------------------------------

test('AC-10: kapasite dolu → error/capacity, makeSocket çağrılmaz', async () => {
  const h = harness({ maxSessions: 1 });
  queueRow(h.rest, 'connect', AGENT);
  await h.manager.tick();

  queueRow(h.rest, 'connect', AGENT_B);
  await h.manager.tick();

  assert.strictEqual(h.sockets.length, 1, 'kapasite dolunca yeni makeSocket çağrılmamalı');
  const m = merged(h.rest, AGENT_B);
  assert.strictEqual(m.status, 'error');
  assert.strictEqual(m.error_code, 'capacity');
});

for (const key of [undefined, '']) {
  const label = key === undefined ? 'undefined' : 'boş string';
  test(`AC-S3/AC-11: WA_AUTH_KEY yok (${label}) → kişisel bağlantı sidecar_misconfigured, makeSocket çağrılmaz`, async () => {
    const h = harness({ key });
    queueRow(h.rest, 'connect');

    await h.manager.tick();

    assert.strictEqual(h.sockets.length, 0, 'anahtar yokken soket açılmamalı');
    const m = merged(h.rest);
    assert.strictEqual(m.status, 'error');
    assert.strictEqual(m.error_code, 'sidecar_misconfigured');
  });
}

// ---------------------------------------------------------------------------
// Kalıcılık hatası (AC-S3 kısmi başarısızlık)
// ---------------------------------------------------------------------------

test('creds kaydı başarısız → error/creds_persist_failed, logout ve auth silinir', async () => {
  const dir = agentAuthDir(authRoot, AGENT);
  const h = harness({
    onMake: (sock, socketOpts) => {
      // saveCreds'in yazacağı klasörü dosyaya çevir: yazma ENOTDIR ile hata verir (platformdan bağımsız).
      const d = agentAuthDir(authRoot, socketOpts.agentId);
      fs.rmSync(d, { recursive: true, force: true });
      fs.writeFileSync(d, 'not-a-directory');
    },
  });
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  const sock = h.sockets[0];

  sock.ev.emit('creds.update', {});
  await flush();

  const m = merged(h.rest);
  assert.strictEqual(m.status, 'error');
  assert.strictEqual(m.error_code, 'creds_persist_failed');
  assert.ok(sock.logoutCalls >= 1, 'kalıcılık hatasında logout çağrılmalı');
  assert.ok(!fs.existsSync(dir), 'kalıcılık hatasında auth klasörü silinmeli');
});

// ---------------------------------------------------------------------------
// Güvenlik: yazma kapsamı ve log (AC-S5 / AC-S6)
// ---------------------------------------------------------------------------

test('AC-S6: rest.update çağrılarında yalnız izinli alanlar bulunur', async () => {
  const h = harness();
  queueRow(h.rest, 'connect');
  await h.manager.tick();
  emitQr(h.sockets[0], QR_OK);
  await flush();
  emitOpen(h.sockets[0]);
  await flush();
  queueRow(h.rest, 'disconnect');
  await h.manager.tick();

  const updates = h.rest.calls.filter((c) => c.method === 'update');
  assert.ok(updates.length > 0, 'en az bir rest.update çağrısı olmalı');

  const disallowed = updates
    .flatMap((c) => Object.keys(c.fields))
    .filter((k) => !ALLOWED_UPDATE_FIELDS.has(k));
  assert.deepStrictEqual(disallowed, [], 'izin verilmeyen alanlar yazılmamalı');
});

test('AC-S5: console çıktısında QR string ve tam telefon numarası geçmez', async () => {
  const captured = [];
  const methods = ['log', 'error', 'warn', 'info'];
  const originals = {};
  for (const m of methods) {
    originals[m] = console[m];
    console[m] = (...args) => captured.push(util.format(...args));
  }

  try {
    const h = harness();
    queueRow(h.rest, 'connect');
    await h.manager.tick();
    emitQr(h.sockets[0], QR_OK);
    await flush();
    emitOpen(h.sockets[0]);
    await flush();
    emitClose(h.sockets[0], TRANSIENT);
    await flush();
  } finally {
    for (const m of methods) console[m] = originals[m];
  }

  const text = captured.join('\n');
  assert.ok(!text.includes(QR_OK), 'QR string loglanmamalı');
  assert.ok(!text.includes('QRSECRET'), 'QR içeriği loglanmamalı');
  assert.ok(!text.includes(PHONE_FULL), 'tam telefon numarası loglanmamalı');
  assert.ok(!text.includes(PHONE_JID), 'ham JID loglanmamalı');
});

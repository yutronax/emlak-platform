// EML-105 / EML-104 AC-7, AC-8, AC-9 + heartbeat: SessionManager yaşam döngüsü.
// Sahte saat (fakeClock) ile start() döngüleri: açılış sırası, abonelik kontrolü,
// 45 sn QR zaman aşımı, heartbeat alanları.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const { SessionManager } = require('./manager');

const A = '11111111-2222-4333-8444-555555555555';
const B = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const C = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const ATTEMPT = '99999999-8888-4777-8666-555555555555';
const KEY = crypto.randomBytes(32).toString('hex');
const PHONE_JID = '905321234512@s.whatsapp.net';
const QR = '2@LIFECYCLE-QR';

let authRoot;

beforeEach(() => {
  authRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-lifecycle-test-'));
});

afterEach(() => {
  fs.rmSync(authRoot, { recursive: true, force: true });
});

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r));
};

// Sahte saat: setTimeout kayıtları due zamanına göre sırayla çalışır.
function fakeClock(start = Date.parse('2026-10-31T10:00:00.000Z')) {
  let now = start;
  let seq = 0;
  let queue = [];
  return {
    now: () => now,
    setTimeout(fn, ms) {
      seq += 1;
      queue.push({ due: now + ms, fn, seq });
      return seq;
    },
    clearTimeout(id) {
      queue = queue.filter((t) => t.seq !== id);
    },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        queue.sort((a, b) => a.due - b.due || a.seq - b.seq);
        const next = queue[0];
        if (!next || next.due > target) break;
        queue.shift();
        now = next.due;
        await next.fn();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

function makeRest({ connected = [], active = () => true } = {}) {
  const rest = {
    calls: [],
    pending: [],
    connected,
    async fetchPendingRequests() {
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
      rest.calls.push({ method: 'heartbeat', payload: { ...payload } });
    },
    async isSubscriptionActive(agentId) {
      return active(agentId);
    },
    async listConnectedAgents() {
      return [...rest.connected];
    },
  };
  return rest;
}

function harness(opts = {}) {
  const key = 'key' in opts ? opts.key : KEY;
  const clock = fakeClock();
  const rest = makeRest({ connected: opts.connected, active: opts.active });
  const sockets = [];
  const makeSocket = (socketOpts) => {
    const sock = {
      ev: new EventEmitter(),
      opts: socketOpts,
      user: undefined,
      logoutCalls: 0,
      async logout() {
        sock.logoutCalls += 1;
      },
    };
    sockets.push(sock);
    return sock;
  };
  const manager = new SessionManager({
    rest,
    makeSocket,
    authRoot,
    key,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    rnd: () => 0.5,
  });
  return { clock, rest, sockets, manager };
}

function queueConnect(rest, agentId) {
  rest.pending.push({ agent_id: agentId, requested_action: 'connect', attempt_id: ATTEMPT });
}

function emitOpen(sock) {
  sock.user = { id: PHONE_JID };
  sock.ev.emit('connection.update', { connection: 'open' });
}

function errorUpdates(rest, agentId) {
  return rest.calls.filter((c) => c.method === 'update' && c.agentId === agentId && c.fields.error_code);
}

function lastHeartbeat(rest) {
  const beats = rest.calls.filter((c) => c.method === 'heartbeat');
  return beats[beats.length - 1].payload;
}

test('start: bağlı agent\'lar 2 sn arayla ve sırayla açılır (AC-8)', async () => {
  const h = harness({ connected: [A, B, C] });
  await h.manager.start();

  await h.clock.advance(0);
  assert.deepStrictEqual(h.sockets.map((s) => s.opts.agentId), [A]);

  await h.clock.advance(1999);
  assert.strictEqual(h.sockets.length, 1, '2 sn dolmadan ikinci oturum açılmamalı');

  await h.clock.advance(1);
  assert.deepStrictEqual(h.sockets.map((s) => s.opts.agentId), [A, B]);

  await h.clock.advance(2000);
  assert.deepStrictEqual(h.sockets.map((s) => s.opts.agentId), [A, B, C]);

  h.manager.stop();
});

test('AC-9: 10 dk abonelik kontrolünde erişimsiz agent kapatılır, aktif agent açık kalır', async () => {
  const h = harness({ active: (id) => id === A });
  await h.manager.start();

  queueConnect(h.rest, A);
  queueConnect(h.rest, B);
  await h.manager.tick();
  assert.strictEqual(h.sockets.length, 2);
  emitOpen(h.sockets[0]);
  emitOpen(h.sockets[1]);
  await flush();

  await h.clock.advance(10 * 60_000 - 1);
  assert.strictEqual(h.sockets[1].logoutCalls, 0, 'kontrol zamanından önce kapatma olmamalı');

  await h.clock.advance(1);

  assert.strictEqual(h.sockets[1].logoutCalls, 1, 'erişimsiz agent logout edilmeli');
  assert.strictEqual(h.sockets[0].logoutCalls, 0, 'aktif agent kapatılmamalı');
  assert.ok(!fs.existsSync(path.join(authRoot, B)), 'erişimsiz agent auth klasörü silinmeli');
  assert.ok(fs.existsSync(path.join(authRoot, A)), 'aktif agent auth klasörü korunmalı');

  const bUpdate = h.rest.calls
    .filter((c) => c.method === 'update' && c.agentId === B && c.fields.status)
    .pop();
  assert.strictEqual(bUpdate.fields.status, 'disconnected');
  assert.strictEqual(bUpdate.fields.error_code, 'subscription_inactive');

  h.manager.stop();
});

test('AC-7: 45 sn içinde QR gelmezse error/no_qr_generated; soket kapanır, auth silinir', async () => {
  const h = harness();
  await h.manager.start();
  queueConnect(h.rest, A);
  await h.manager.tick();

  await h.clock.advance(44_000);
  assert.deepStrictEqual(errorUpdates(h.rest, A), [], '45 sn dolmadan hata yazılmamalı');

  await h.clock.advance(1000);

  const errs = errorUpdates(h.rest, A);
  assert.strictEqual(errs.length, 1);
  assert.strictEqual(errs[0].fields.status, 'error');
  assert.strictEqual(errs[0].fields.error_code, 'no_qr_generated');
  assert.strictEqual(h.sockets[0].logoutCalls, 1, 'QR gelmeyen oturum kapatılmalı');
  assert.ok(!fs.existsSync(path.join(authRoot, A)), 'QR gelmeyen oturumun auth klasörü silinmeli');

  h.manager.stop();
});

test('AC-7: 10 sn\'de QR gelirse 45 sn zaman aşımı tetiklenmez', async () => {
  const h = harness();
  await h.manager.start();
  queueConnect(h.rest, A);
  await h.manager.tick();

  await h.clock.advance(10_000);
  h.sockets[0].ev.emit('connection.update', { qr: QR });
  await flush();

  await h.clock.advance(60_000);

  assert.deepStrictEqual(errorUpdates(h.rest, A), [], 'QR alındıktan sonra no_qr_generated olmamalı');
  assert.strictEqual(h.sockets[0].logoutCalls, 0);

  h.manager.stop();
});

test('heartbeat: sessions_open ve misconfigured:false içerir (anahtar varken)', async () => {
  const h = harness();
  await h.manager.start();

  assert.strictEqual(lastHeartbeat(h.rest).sessions_open, 0);
  assert.strictEqual(lastHeartbeat(h.rest).misconfigured, false);

  queueConnect(h.rest, A);
  await h.manager.tick();
  emitOpen(h.sockets[0]);
  await flush();

  await h.clock.advance(30_000);

  const hb = lastHeartbeat(h.rest);
  assert.strictEqual(hb.sessions_open, 1);
  assert.strictEqual(hb.misconfigured, false);
  assert.ok(hb.counters && typeof hb.counters === 'object', 'counters nesnesi gönderilmeli');

  h.manager.stop();
});

test('yarış: abonelik kontrolü beklerken _resume + tick(connect) aynı agent için TEK soket açar', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const h = harness({ active: async () => { await gate; return true; } });

  const resumeP = h.manager._resume(A);
  queueConnect(h.rest, A);
  await h.manager.tick();
  release();
  await resumeP;
  await flush();

  assert.strictEqual(h.sockets.length, 1, 'aynı agent için makeSocket tam bir kez çağrılmalı');
  assert.strictEqual(h.sockets[0].opts.agentId, A);
});

test('yarış: abonelik kontrolü hata verirse rezervasyon temizlenir, sonraki connect çalışır', async () => {
  let fail = true;
  const h = harness({
    active: async () => {
      if (fail) throw new Error('db down');
      return true;
    },
  });

  await assert.rejects(h.manager._resume(A), /db down/);
  assert.strictEqual(h.manager.sessions.has(A), false, 'hata sonrası slot serbest kalmalı');

  fail = false;
  queueConnect(h.rest, A);
  await h.manager.tick();
  assert.strictEqual(h.sockets.length, 1, 'rezervasyon temizlendikten sonra connect soket açmalı');
});

test('yarış: abonelik yok ise _resume rezervasyonu sonlandırır, tick connect soket açmaz', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const h = harness({ active: async () => { await gate; return false; } });

  const resumeP = h.manager._resume(A);
  queueConnect(h.rest, A);
  await h.manager.tick();
  release();
  await resumeP;
  await flush();

  assert.strictEqual(h.sockets.length, 0, 'abonelik yokken soket açılmamalı');
  assert.strictEqual(h.manager.sessions.has(A), false);
});

test('regresyon: no_qr ve subscription_inactive aynı anda — tek durum yazımı ve tek olay', async () => {
  const h = harness({ active: () => false });
  await h.manager.start();
  queueConnect(h.rest, A);
  await h.manager.tick();

  const s = h.manager.sessions.get(A);
  s.startedAt = h.clock.now() - 60_000; // 45 sn QR zaman aşımını geçmiş

  // İki süpürme aynı oturumu aynı anda yakalar.
  await Promise.all([h.manager._sweepNoQr(), h.manager._checkSubscriptions()]);
  await flush();
  await h.manager._sweepNoQr();
  await h.manager._checkSubscriptions();
  await flush();

  const events = h.rest.calls.filter((c) => c.method === 'insertEvent' && c.agentId === A && c.ev.to_status !== 'pending');
  const terminalUpdates = h.rest.calls.filter((c) => c.method === 'update' && c.agentId === A && c.fields.status && c.fields.status !== 'connected' && c.fields.status !== 'pending');
  assert.strictEqual(events.length, 1, 'tek sonlandırma olayı yazılmalı');
  assert.strictEqual(terminalUpdates.length, 1, 'tek durum yazımı yapılmalı');
  assert.strictEqual(h.manager.counters.terminated, 1);
  assert.strictEqual(h.sockets[0].logoutCalls, 1);

  h.manager.stop();
});

test('regresyon: _terminate aynı oturum için ikinci kez çağrılırsa durum/olay yazmaz', async () => {
  const h = harness();
  await h.manager.start();
  queueConnect(h.rest, A);
  await h.manager.tick();
  const s = h.manager.sessions.get(A);

  const fields = { status: 'error', error_code: 'no_qr_generated', qr: null, qr_expires_at: null };
  await h.manager._terminate(s, fields, { logout: true, deleteAuth: true });
  await h.manager._terminate(s, fields, { logout: true, deleteAuth: true });

  const events = h.rest.calls.filter((c) => c.method === 'insertEvent' && c.agentId === A && c.ev.to_status === 'error');
  assert.strictEqual(events.length, 1);
  assert.strictEqual(h.manager.counters.terminated, 1);

  h.manager.stop();
});

test('heartbeat: WA_AUTH_KEY yokken misconfigured:true; kişisel connect sidecar_misconfigured', async () => {
  const h = harness({ key: undefined });
  await h.manager.start();

  assert.strictEqual(lastHeartbeat(h.rest).misconfigured, true);
  assert.strictEqual(lastHeartbeat(h.rest).sessions_open, 0);

  queueConnect(h.rest, A);
  await h.manager.tick();

  assert.strictEqual(h.sockets.length, 0, 'anahtar yokken soket açılmamalı');
  const errs = errorUpdates(h.rest, A);
  assert.strictEqual(errs.length, 1);
  assert.strictEqual(errs[0].fields.error_code, 'sidecar_misconfigured');

  h.manager.stop();
});

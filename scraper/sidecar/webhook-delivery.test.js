// Ortak webhook teslimatı (bridge.js + sessions/manager.js): deneme başına timeout, sınıflandırma
// (geçici/kalıcı), üstel backoff + jitter, sınırlı bellek-içi yeniden deneme kuyruğu.
// Gerçek ağ/uyku yok: fetch, zamanlayıcı, saat ve rastgelelik enjekte edilir.
const { test } = require('node:test');
const assert = require('node:assert');

const {
  createWebhookDelivery,
  classifyStatus,
  retryDelay,
  RETRY_DELAYS_MS,
  ATTEMPT_TIMEOUT_MS,
  MAX_QUEUE,
  MAX_AGE_MS,
  MAX_CONCURRENCY,
} = require('./webhook-delivery');

const SECRET_TEXT = 'GIZLI-ILAN-METNI Kadıköy 2+1 0532 111 22 33';
const SECRET_JID = '120363999888777@g.us';
const AGENT = '11111111-2222-4333-8444-555555555555';

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r));
};

// Sahte saat + zamanlayıcı: advance(ms) vadesi gelenleri sırayla çalıştırır.
function fakeClock() {
  let t = 1_000_000;
  const timers = [];
  return {
    timers,
    now: () => t,
    setTimeout(fn, ms) {
      const h = { fn, at: t + ms, ms, cleared: false, fired: false, unrefCalled: false };
      h.unref = () => {
        h.unrefCalled = true;
        return h;
      };
      timers.push(h);
      return h;
    },
    clearTimeout(h) {
      if (h) h.cleared = true;
    },
    async advance(ms) {
      const target = t + ms;
      for (;;) {
        const due = timers
          .filter((h) => !h.cleared && !h.fired && h.at <= target)
          .sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        t = Math.max(t, due.at);
        due.fired = true;
        due.fn();
        await flush();
      }
      t = target;
      await flush();
    },
    live() {
      return timers.filter((h) => !h.cleared && !h.fired);
    },
  };
}

function payload(id = 'm-1') {
  return { id, text: SECRET_TEXT, group: SECRET_JID, groupName: 'Grup', agentId: AGENT };
}

// responses: her çağrı için sırayla 'ok' | sayı (HTTP kodu) | 'throw' | 'timeout' | 'hang'; tükenince sonuncusu.
function makeFetch(responses) {
  const calls = [];
  const fetchImpl = (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (r === 'throw') return Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    if (r === 'timeout') return Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    if (r === 'hang') {
      return new Promise((_, rej) => {
        init.signal.addEventListener('abort', () => rej(init.signal.reason));
      });
    }
    if (r === 'ok') return Promise.resolve({ ok: true, status: 200, statusText: 'OK' });
    return Promise.resolve({ ok: r >= 200 && r < 300, status: r, statusText: 'X' });
  };
  return { calls, fetchImpl };
}

function makeHarness(responses, opts = {}) {
  const clock = fakeClock();
  const f = makeFetch(responses);
  const logs = [];
  const failed = [];
  const delivered = [];
  const d = createWebhookDelivery({
    url: 'http://127.0.0.1:8090/baileys-webhook',
    secret: 'test-secret',
    fetchImpl: f.fetchImpl,
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    rnd: () => 0.5, // jitter çarpanı tam 1.0
    logError: (...args) => logs.push(args.join(' ')),
    onFailed: (info) => failed.push(info),
    onDelivered: (info) => delivered.push(info),
    ...opts,
  });
  return { d, clock, calls: f.calls, logs, failed, delivered };
}

// ---------------------------------------------------------------------------
// Sınıflandırma ve takvim
// ---------------------------------------------------------------------------

test('classifyStatus: 2xx ok; 5xx/429/408 geçici; diğer 4xx kalıcı', () => {
  assert.strictEqual(classifyStatus(200), 'ok');
  assert.strictEqual(classifyStatus(204), 'ok');
  for (const s of [500, 502, 503, 504, 429, 408]) assert.strictEqual(classifyStatus(s), 'retry', String(s));
  for (const s of [400, 401, 403, 404, 409, 413, 422]) assert.strictEqual(classifyStatus(s), 'permanent', String(s));
});

test('takvim sabitleri: 1s,2s,5s,15s,30s,60s; toplam pencere ~2 dk; sınırlar', () => {
  assert.deepStrictEqual(RETRY_DELAYS_MS, [1000, 2000, 5000, 15000, 30000, 60000]);
  const total = RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
  assert.ok(total >= 100_000 && total <= 150_000, `toplam ${total}`);
  assert.strictEqual(ATTEMPT_TIMEOUT_MS, 10_000);
  assert.strictEqual(MAX_QUEUE, 500);
  assert.strictEqual(MAX_AGE_MS, 10 * 60_000);
  assert.strictEqual(MAX_CONCURRENCY, 4);
});

test('retryDelay: jitter ±%20 ile tabloya göre; uç değerler', () => {
  assert.strictEqual(retryDelay(0, () => 0.5), 1000);
  assert.strictEqual(retryDelay(3, () => 0.5), 15000);
  assert.strictEqual(retryDelay(0, () => 0), 800);
  assert.strictEqual(retryDelay(5, () => 1), 72000);
});

// ---------------------------------------------------------------------------
// Teslimat
// ---------------------------------------------------------------------------

test('ilk denemede başarı: delivered, kuyruk boş, Bearer + timeout signal gönderilir', async () => {
  const h = makeHarness(['ok']);
  const r = await h.d.deliver(payload());
  assert.strictEqual(r, 'delivered');
  assert.strictEqual(h.calls.length, 1);
  assert.strictEqual(h.calls[0].init.method, 'POST');
  assert.strictEqual(h.calls[0].init.headers.Authorization, 'Bearer test-secret');
  assert.ok(h.calls[0].init.signal instanceof AbortSignal, 'deneme başına timeout signal olmalı');
  assert.strictEqual(h.d.pending(), 0);
  assert.strictEqual(h.delivered.length, 1);
  assert.strictEqual(h.failed.length, 0);
});

test('geçici hata sonra başarı: queued döner, 1 sn sonra yeniden denenir ve teslim edilir', async () => {
  const h = makeHarness([503, 'ok']);
  const r = await h.d.deliver(payload('m-r'));
  assert.strictEqual(r, 'queued');
  assert.strictEqual(h.calls.length, 1);
  assert.strictEqual(h.d.pending(), 1);

  await h.clock.advance(999);
  assert.strictEqual(h.calls.length, 1, 'gecikme dolmadan yeniden deneme yok');
  await h.clock.advance(1);
  assert.strictEqual(h.calls.length, 2);
  assert.strictEqual(h.d.pending(), 0);
  assert.deepStrictEqual(h.delivered.map((x) => x.id), ['m-r']);
  assert.strictEqual(h.failed.length, 0);
  assert.strictEqual(h.calls[1].body.id, 'm-r');
});

test('ağ hatası (reddedilen fetch) geçicidir ve yeniden denenir', async () => {
  const h = makeHarness(['throw', 'ok']);
  assert.strictEqual(await h.d.deliver(payload()), 'queued');
  await h.clock.advance(1000);
  assert.strictEqual(h.calls.length, 2);
  assert.strictEqual(h.delivered.length, 1);
});

test('429 ve 408 geçicidir', async () => {
  for (const code of [429, 408]) {
    const h = makeHarness([code, 'ok']);
    assert.strictEqual(await h.d.deliver(payload()), 'queued', String(code));
    await h.clock.advance(1000);
    assert.strictEqual(h.delivered.length, 1, String(code));
  }
});

test('kalıcı 4xx (400/403/404) yeniden denenmez: failed + onFailed(permanent), kuyruk boş', async () => {
  for (const code of [400, 403, 404]) {
    const h = makeHarness([code]);
    assert.strictEqual(await h.d.deliver(payload('m-p')), 'failed');
    await h.clock.advance(10 * 60_000);
    assert.strictEqual(h.calls.length, 1, `${code} yeniden denenmemeli`);
    assert.strictEqual(h.d.pending(), 0);
    assert.deepStrictEqual(h.failed, [{ id: 'm-p', reason: 'permanent' }]);
  }
});

test('401: yeniden denenmez ve yüksek sesli BAILEYS_WEBHOOK_SECRET ipucu loglanır', async () => {
  const h = makeHarness([401]);
  assert.strictEqual(await h.d.deliver(payload()), 'failed');
  assert.strictEqual(h.calls.length, 1);
  assert.ok(h.logs.some((l) => l.includes('BAILEYS_WEBHOOK_SECRET uyuşmuyor')), h.logs.join('\n'));
});

test('timeout: asılı istek deneme timeout\'u ile iptal edilir ve geçici sayılıp yeniden denenir', async () => {
  // Gerçek AbortSignal.timeout, çok kısa süreyle (uyku yok denecek kadar kısa).
  const h = makeHarness(['hang', 'ok'], { timeoutMs: 5 });
  // AbortSignal.timeout zamanlayıcısı unref'lidir; beklerken olay döngüsü boşalmasın diye tutucu.
  const keepAlive = setTimeout(() => {}, 5000);
  let r;
  try {
    r = await h.d.deliver(payload('m-t'));
  } finally {
    clearTimeout(keepAlive);
  }
  assert.strictEqual(r, 'queued', 'timeout sonrası kuyruğa alınmalı');
  assert.ok(h.logs.some((l) => l.includes('TimeoutError')), h.logs.join('\n'));
  await h.clock.advance(1000);
  assert.strictEqual(h.calls.length, 2);
  assert.deepStrictEqual(h.delivered.map((x) => x.id), ['m-t']);
});

test('timeoutSignal enjekte edilebilir ve timeoutMs ile çağrılır', async () => {
  const seen = [];
  const h = makeHarness(['ok'], {
    timeoutMs: 1234,
    timeoutSignal: (ms) => {
      seen.push(ms);
      return new AbortController().signal;
    },
  });
  await h.d.deliver(payload());
  assert.deepStrictEqual(seen, [1234]);
});

test('takvim: art arda geçici hatalarda gecikmeler 1,2,5,15,30,60 sn; tükenince onFailed(max_retries)', async () => {
  const h = makeHarness([500]);
  assert.strictEqual(await h.d.deliver(payload('m-x')), 'queued');
  const observed = [];
  for (let i = 0; i < RETRY_DELAYS_MS.length; i += 1) {
    const live = h.clock.live();
    assert.strictEqual(live.length, 1, 'tek bir uyandırma zamanlayıcısı');
    assert.ok(live[0].unrefCalled, 'zamanlayıcı unref edilmeli');
    observed.push(live[0].ms);
    await h.clock.advance(live[0].ms);
  }
  assert.deepStrictEqual(observed, RETRY_DELAYS_MS);
  assert.strictEqual(h.calls.length, 1 + RETRY_DELAYS_MS.length, 'toplam 7 deneme');
  assert.deepStrictEqual(h.failed, [{ id: 'm-x', reason: 'max_retries' }]);
  assert.strictEqual(h.d.pending(), 0);
  assert.strictEqual(h.clock.live().length, 0, 'kuyruk boşken zamanlayıcı kalmaz');
});

test('kuyruk sınırı: dolunca EN ESKİ düşer ve onFailed(queue_overflow) yalnız id ile çağrılır', async () => {
  const h = makeHarness([500], { maxQueue: 3 });
  for (const id of ['a', 'b', 'c', 'd']) await h.d.deliver(payload(id));
  assert.strictEqual(h.d.pending(), 3);
  assert.deepStrictEqual(h.failed, [{ id: 'a', reason: 'queue_overflow' }]);
});

test('azami yaş: süresi dolan kayıt EN ESKİ olarak düşer ve onFailed(expired)', async () => {
  // Uzun gecikme tablosu: yaş sınırı yeniden denemeden önce dolar.
  const h = makeHarness([500], { maxAgeMs: 5000, delays: [10_000, 10_000] });
  await h.d.deliver(payload('old'));
  await h.clock.advance(3000);
  await h.d.deliver(payload('new'));
  await h.clock.advance(2500); // old: 5.5 sn, new: 2.5 sn
  assert.deepStrictEqual(h.failed, [{ id: 'old', reason: 'expired' }]);
  assert.strictEqual(h.d.pending(), 1);
});

test('eşzamanlılık sınırı: kuyruk boşaltılırken aynı anda en fazla N istek uçuşta', async () => {
  const clock = fakeClock();
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  const resolvers = [];
  const fetchImpl = () => {
    calls += 1;
    if (calls <= 10) return Promise.resolve({ ok: false, status: 503 }); // ilk denemeler: kuyruğa
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise((res) => resolvers.push(() => {
      inFlight -= 1;
      res({ ok: true, status: 200 });
    }));
  };
  const d = createWebhookDelivery({
    url: 'http://x/', secret: 's', fetchImpl, now: clock.now,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, rnd: () => 0.5,
    logError: () => {}, concurrency: 4,
  });
  for (let i = 0; i < 10; i += 1) await d.deliver(payload(`c${i}`));
  assert.strictEqual(d.pending(), 10);
  await clock.advance(1000);
  assert.strictEqual(maxInFlight, 4, 'aynı anda en fazla 4');
  while (resolvers.length) {
    resolvers.shift()();
    await flush();
  }
  assert.strictEqual(maxInFlight, 4);
  assert.strictEqual(d.pending(), 0, 'hepsi sonunda teslim edilmeli');
});

test('handler bloklanmaz: bekleyen yeniden denemeler varken deliver() yalnız ilk denemeyi bekler', async () => {
  const h = makeHarness([500]);
  await h.d.deliver(payload('x1'));
  await h.d.deliver(payload('x2'));
  // İkinci çağrı 1 sn'lik gecikmeyi beklemeden döndü: saat hiç ilerlemedi, 2 fetch yapıldı.
  assert.strictEqual(h.calls.length, 2);
  assert.strictEqual(h.d.pending(), 2);
});

test('clear(): kuyruğu ve zamanlayıcıyı temizler (onFailed çağrılmaz)', async () => {
  const h = makeHarness([500]);
  await h.d.deliver(payload());
  h.d.clear();
  assert.strictEqual(h.d.pending(), 0);
  assert.strictEqual(h.clock.live().length, 0);
  await h.clock.advance(120_000);
  assert.strictEqual(h.calls.length, 1);
  assert.strictEqual(h.failed.length, 0);
});

test('KVKK: başarısız + yeniden denenen + düşen teslimatta hiçbir log/geri çağrı metin, JID veya telefon içermez', async () => {
  const consoleLines = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = (...a) => consoleLines.push(a.join(' '));
  console.error = (...a) => consoleLines.push(a.join(' '));
  console.warn = (...a) => consoleLines.push(a.join(' '));
  let h;
  try {
    h = makeHarness(['throw', 503, 'timeout', 429, 401], { maxQueue: 1 });
    await h.d.deliver(payload('k1'));
    await h.d.deliver(payload('k2')); // k1 taşma ile düşer
    for (let i = 0; i < 8; i += 1) await h.clock.advance(60_000);
    // logError varsayılanı (console.error) da denenir.
    const d2 = createWebhookDelivery({ url: 'http://x/', secret: 's', fetchImpl: makeFetch([500]).fetchImpl,
      setTimeout: h.clock.setTimeout, clearTimeout: h.clock.clearTimeout, now: h.clock.now });
    await d2.deliver(payload('k3'));
    d2.clear();
  } finally {
    Object.assign(console, orig);
  }
  const all = [...h.logs, ...consoleLines, JSON.stringify(h.failed), JSON.stringify(h.delivered)].join('\n');
  assert.ok(h.logs.length > 0 && consoleLines.length > 0, 'test anlamlı olsun: log üretilmeli');
  for (const needle of ['GIZLI-ILAN-METNI', 'Kadıköy', '0532', '120363999888777', AGENT, 'test-secret']) {
    assert.ok(!all.includes(needle), `loglarda "${needle}" görünmemeli`);
  }
});

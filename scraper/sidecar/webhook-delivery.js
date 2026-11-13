// Ortak webhook teslimatı: ortak köprü (bridge.js) ve kişisel oturumlar (sessions/manager.js)
// aynı mantığı kullanır. Yeni bağımlılık yok: global fetch + AbortSignal.timeout.
//
// - Her deneme ATTEMPT_TIMEOUT_MS ile sınırlı (asılı istek mesaj akışını kilitlemez).
// - Sınıflandırma: ağ hatası/timeout, 5xx, 429, 408 -> geçici (yeniden denenir);
//   diğer 4xx (400/401/403/404...) -> kalıcı (yeniden denenmez).
// - İlk deneme çağıran tarafından beklenir; geçici hatada mesaj sınırlı bellek-içi kuyruğa alınır
//   ve çağıran HEMEN döner (messages.upsert / oturum sırası bloklanmaz).
// - Kuyruk: en fazla MAX_QUEUE kayıt, en fazla MAX_AGE_MS yaş; taşma/süre dolumunda EN ESKİ düşer.
//   Boşaltma en fazla MAX_CONCURRENCY eşzamanlı istekle (toparlanan worker'a yığılma olmaz).
//
// KVKK: yük (metin/JID) yalnız bellekte ve yalnız yukarıdaki sınırlar süresince tutulur; diske
// yazılmaz, hiçbir log satırına girmez. Geri çağrılara yalnız mesaj id + sabit neden verilir.
// Süreç kapanırsa kuyruktaki kayıtlar kaybolur (kabul edilen kalıntı risk).

// Worker yeniden başlatması (birkaç sn) ve kısa kesintiler (~2 dk) atlatılsın diye: toplam
// ~113 sn bekleme + 7 deneme. Worker mesaj id ile tekilleştirdiği için sıra/tekrar sorun değil.
const RETRY_DELAYS_MS = [1000, 2000, 5000, 15000, 30000, 60000];
const RETRY_JITTER = 0.2; // ±%20: aynı anda düşen mesajlar aynı anda yeniden denenmez
const ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_QUEUE = 500;
const MAX_AGE_MS = 10 * 60_000;
const MAX_CONCURRENCY = 4;

function classifyStatus(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 500 || status === 429 || status === 408) return 'retry';
  return 'permanent';
}

// retryIndex: 0 = ilk yeniden deneme. Tablonun sonundan sonrası son değeri kullanır.
function retryDelay(retryIndex, rnd = Math.random, delays = RETRY_DELAYS_MS) {
  const base = delays[Math.min(retryIndex, delays.length - 1)];
  return Math.round(base * (1 - RETRY_JITTER + rnd() * 2 * RETRY_JITTER));
}

function safeCall(fn, arg) {
  try {
    fn(arg);
  } catch (_) {
    // Geri çağrı hatası teslimat akışını durdurmaz.
  }
}

function createWebhookDelivery({
  url,
  secret,
  fetchImpl = (...args) => globalThis.fetch(...args),
  timeoutMs = ATTEMPT_TIMEOUT_MS,
  timeoutSignal = (ms) => AbortSignal.timeout(ms),
  delays = RETRY_DELAYS_MS,
  maxQueue = MAX_QUEUE,
  maxAgeMs = MAX_AGE_MS,
  concurrency = MAX_CONCURRENCY,
  now = Date.now,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: unschedule = globalThis.clearTimeout,
  rnd = Math.random,
  logError = (...args) => console.error(...args),
  onFailed = () => {}, // ({ id, reason }) reason: permanent | max_retries | queue_overflow | expired
  onDelivered = () => {}, // ({ id })
} = {}) {
  let items = []; // { payload, enqueuedAt, retries, dueAt, inFlight, done }
  let active = 0;
  let timer = null;
  let timerAt = Infinity;

  // Tek deneme -> 'ok' | 'retry' | 'permanent'. Hiçbir zaman fırlatmaz; loglar sabit şablonludur.
  async function attempt(payload) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify(payload),
        signal: timeoutSignal(timeoutMs),
      });
      const kind = classifyStatus(res.status);
      if (kind === 'ok') return kind;
      logError(`[WEBHOOK HATA] ${res.status} ${res.statusText || ''}`.trim());
      if (res.status === 401) {
        logError('[WEBHOOK AUTH HATASI] webhook auth failed (401), BAILEYS_WEBHOOK_SECRET uyuşmuyor');
      }
      return kind;
    } catch (e) {
      const name = (e && e.name) || 'error';
      const code = (e && e.cause && e.cause.code) || '';
      logError(`[WEBHOOK BAGLANTI HATASI] ${name}${code ? ` ${code}` : ''} (hedef: ${url}, orchestrator.py çalışıyor mu?)`);
      return 'retry';
    }
  }

  function drop(item, reason) {
    item.done = true;
    items = items.filter((x) => x !== item);
    safeCall(onFailed, { id: item.payload.id, reason });
  }

  function enqueue(payload) {
    const t = now();
    while (items.length >= maxQueue) drop(items[0], 'queue_overflow');
    items.push({ payload, enqueuedAt: t, retries: 0, dueAt: t + retryDelay(0, rnd, delays), inFlight: false, done: false });
    logError(`[WEBHOOK] geçici hata, yeniden deneme kuyruğuna alındı (kuyruk=${items.length})`);
    pump();
  }

  async function runRetry(item) {
    item.inFlight = true;
    active += 1;
    let kind;
    try {
      kind = await attempt(item.payload);
    } finally {
      active -= 1;
      item.inFlight = false;
    }
    if (!item.done) {
      if (kind === 'ok') {
        item.done = true;
        items = items.filter((x) => x !== item);
        safeCall(onDelivered, { id: item.payload.id });
      } else if (kind === 'permanent') {
        drop(item, 'permanent');
      } else {
        item.retries += 1;
        if (item.retries >= delays.length) drop(item, 'max_retries');
        else item.dueAt = now() + retryDelay(item.retries, rnd, delays);
      }
    }
    pump();
  }

  function pump() {
    const t = now();
    // Süresi dolanlar (uçuşta olmayan) en eskiden başlayarak düşer.
    for (const item of [...items]) {
      if (!item.inFlight && t - item.enqueuedAt >= maxAgeMs) drop(item, 'expired');
    }
    for (const item of items) {
      if (active >= concurrency) break;
      if (!item.inFlight && item.dueAt <= t) runRetry(item);
    }
    // Bekleyenlerin en yakın GELECEK vadesine (yeniden deneme ya da yaş sınırı) tek, unref'li
    // zamanlayıcı. Vadesi gelmiş ama eşzamanlılık dolu olduğu için bekleyenler, uçuştaki bir
    // deneme bitince (runRetry -> pump) ele alınır; 0 ms'lik zamanlayıcı döngüsü kurulmaz.
    let next = Infinity;
    for (const x of items) {
      if (x.inFlight) continue;
      for (const at of [x.dueAt, x.enqueuedAt + maxAgeMs]) if (at > t && at < next) next = at;
    }
    if (next === Infinity) {
      if (timer) unschedule(timer);
      timer = null;
      timerAt = Infinity;
      return;
    }
    if (timer && timerAt <= next) return;
    if (timer) unschedule(timer);
    timerAt = next;
    timer = schedule(() => {
      timer = null;
      timerAt = Infinity;
      pump();
    }, Math.max(0, next - t));
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  // İlk deneme beklenir. Dönüş: 'delivered' | 'queued' (arka planda yeniden denenecek) | 'failed'.
  async function deliver(payload) {
    const kind = await attempt(payload);
    if (kind === 'ok') {
      safeCall(onDelivered, { id: payload.id });
      return 'delivered';
    }
    if (kind === 'permanent') {
      safeCall(onFailed, { id: payload.id, reason: 'permanent' });
      return 'failed';
    }
    enqueue(payload);
    return 'queued';
  }

  // Kuyruğu ve zamanlayıcıyı bırakır (testler/kapanış). Uçuştaki deneme sonucu yok sayılır.
  function clear() {
    for (const item of items) item.done = true;
    items = [];
    if (timer) unschedule(timer);
    timer = null;
    timerAt = Infinity;
  }

  return { deliver, pending: () => items.length, clear };
}

module.exports = {
  createWebhookDelivery,
  classifyStatus,
  retryDelay,
  RETRY_DELAYS_MS,
  RETRY_JITTER,
  ATTEMPT_TIMEOUT_MS,
  MAX_QUEUE,
  MAX_AGE_MS,
  MAX_CONCURRENCY,
};

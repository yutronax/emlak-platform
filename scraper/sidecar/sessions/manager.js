// EML-105 / EML-104 AC-2..AC-S6: Kişisel WhatsApp oturumlarının durum makinesi.
//
// Tek süreçte agentId -> session Map'i. Her oturum makeSocket ile (Baileys veya test sahtesi)
// açılır; connection.update / creds.update olayları bu sınıfta işlenir.
// Dış bağımlılıklar enjekte edilir: rest (Supabase), makeSocket, zamanlayıcılar, saat.
//
// EML-107: Grup senkronu (bağlantı + 6 sa + groups.update), messages.upsert dinleyicisi (bağlantı
// açılınca her zaman bağlanır; seçili olmayan/DM mesajlar yalnız sayaç), sayaçlar.
const { useEncryptedAuthState } = require('./crypto-auth-state');
const { agentAuthDir, removeAgentAuth, isValidAgentId } = require('./paths');
const { maskPhone, redact } = require('./mask');
const {
  classifyIncoming,
  capGroups,
  createCounters,
  bump,
  toGroupRows,
  messageText,
  MAX_GROUPS,
} = require('./groups');

const POLL_MS = 3000;
const HEARTBEAT_MS = 30_000;
const SUBSCRIPTION_CHECK_MS = 10 * 60_000;
const RESUME_GAP_MS = 2000;
const QR_TTL_MS = 20_000;
const QR_MAX_SHOWS = 5;
const NO_QR_TIMEOUT_MS = 45_000;
const NO_QR_SWEEP_MS = 1000;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 300_000;
const DEFAULT_MAX_SESSIONS = 50;
const GROUP_SYNC_MS = 6 * 60 * 60_000;
const SELECTION_TTL_MS = 60_000;
const WEBHOOK_MAX_ATTEMPTS = 3;

// Baileys DisconnectReason değerleri (bağımlılık yüklemeden sabit).
const LOGGED_OUT = 401;
const CONNECTION_REPLACED = 440;

function backoffDelay(retries, rnd = Math.random) {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** retries);
  const jitter = 0.9 + rnd() * 0.2; // ±%10
  return Math.min(BACKOFF_MAX_MS, Math.round(base * jitter));
}

function log(message, fields = {}) {
  console.log(`[wa] ${message} ${JSON.stringify(redact(fields))}`);
}

function logError(message, fields = {}) {
  console.error(`[wa] ${message} ${JSON.stringify(redact(fields))}`);
}

// Logout denemesi; hata (ör. kayıtlı olmayan soket) yutulur, olay akışı bozulmaz.
function closeSocket(sock) {
  try {
    const r = sock.logout();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (_) {
    // yoksay
  }
}

class SessionManager {
  constructor({
    rest,
    makeSocket,
    authRoot,
    key,
    maxSessions = DEFAULT_MAX_SESSIONS,
    now = Date.now,
    setTimeout: schedule = globalThis.setTimeout,
    clearTimeout: unschedule = globalThis.clearTimeout,
    rnd = Math.random,
    webhook = null,
  }) {
    this.rest = rest;
    this.makeSocket = makeSocket;
    this.authRoot = authRoot;
    this.key = key || null;
    this.maxSessions = Number.isInteger(maxSessions) && maxSessions > 0 ? maxSessions : DEFAULT_MAX_SESSIONS;
    this.now = now;
    this._schedule = schedule;
    this._unschedule = unschedule;
    this.rnd = rnd;
    // { url, secret, fetchImpl }: yalnız seçili grup ilanları buraya POST edilir.
    this.webhook = webhook;

    this.sessions = new Map();
    this.running = false;
    this._ticking = false;
    this.counters = { ticks: 0, reconnects: 0, terminated: 0 };
    this.msgCounters = createCounters();
  }

  _iso(ms) {
    return new Date(ms).toISOString();
  }

  async _guard(label, fn) {
    try {
      await fn();
    } catch (e) {
      logError(`${label} hata`, { error: (e && (e.code || e.name)) || 'error' });
    }
  }

  // -------------------------------------------------------------------------
  // Yaşam döngüsü
  // -------------------------------------------------------------------------

  async start() {
    if (this.running) return;
    this.running = true;

    if (!this.key) {
      logError('WA_AUTH_KEY tanımlı değil; kişisel bağlantılar sidecar_misconfigured ile reddedilir');
    }

    await this._guard('heartbeat', () => this._beat());

    let ids = [];
    if (this.key) {
      try {
        ids = await this.rest.listConnectedAgents();
      } catch (e) {
        logError('bağlı agent listesi alınamadı', { error: e.name || 'error' });
      }
    }
    // Açılışta bağlı oturumlar 2 sn arayla yeniden açılır (AC-8).
    ids.forEach((id, i) => {
      this._schedule(() => this._guard('resume', () => this._resume(id)), i * RESUME_GAP_MS);
    });

    this._loop(POLL_MS, () => this.tick());
    this._loop(NO_QR_SWEEP_MS, () => this._sweepNoQr());
    this._loop(HEARTBEAT_MS, () => this._beat());
    this._loop(SUBSCRIPTION_CHECK_MS, () => this._checkSubscriptions());
    this._loop(GROUP_SYNC_MS, () => this._syncAllGroups());
    this._loop(SELECTION_TTL_MS, () => this._refreshAllSelections());
  }

  _loop(ms, fn) {
    const run = async () => {
      if (!this.running) return;
      await this._guard('döngü', fn);
      if (this.running) this._schedule(run, ms);
    };
    this._schedule(run, ms);
  }

  stop() {
    this.running = false;
    for (const s of this.sessions.values()) {
      if (s.sock) {
        try {
          if (typeof s.sock.end === 'function') s.sock.end(undefined);
        } catch (_) {
          // yoksay
        }
      }
    }
    this.sessions.clear();
  }

  async _beat() {
    await this.rest.heartbeat({
      sessions_open: this.sessions.size,
      misconfigured: !this.key,
      counters: { ...this.counters, ...this.msgCounters },
    });
  }

  // -------------------------------------------------------------------------
  // İstek poll'u
  // -------------------------------------------------------------------------

  async tick() {
    if (this._ticking) return;
    this._ticking = true;
    this.counters.ticks += 1;
    try {
      const rows = await this.rest.fetchPendingRequests();
      for (const row of rows) {
        await this._guard('istek', () => this._handle(row));
      }
    } finally {
      this._ticking = false;
    }
  }

  async _handle(row) {
    const agentId = row && row.agent_id;
    const attemptId = (row && row.attempt_id) || null;
    if (!isValidAgentId(agentId)) {
      logError('geçersiz agent_id içeren istek atlandı');
      return;
    }
    if (row.requested_action === 'connect') return this._connect(agentId, attemptId);
    if (row.requested_action === 'disconnect') return this._disconnect(agentId, attemptId);
    return this.rest.update(agentId, { requested_action: null });
  }

  async _connect(agentId, attemptId) {
    if (!this.key) {
      return this._failRequest(agentId, attemptId, 'sidecar_misconfigured');
    }
    if (this.sessions.has(agentId)) {
      return this.rest.update(agentId, { requested_action: null });
    }
    if (this.sessions.size >= this.maxSessions) {
      return this._failRequest(agentId, attemptId, 'capacity');
    }

    // Yeni eşleştirme temiz başlar: eski kalıntı creds ile giriş denenmez.
    removeAgentAuth(this.authRoot, agentId);
    const s = {
      agentId,
      attemptId,
      sock: null,
      status: 'pending',
      qrCount: 0,
      opened: false,
      retries: 0,
      fresh: true,
    };
    this.sessions.set(agentId, s);
    await this.rest.update(agentId, { requested_action: null, last_seen_at: this._iso(this.now()) });
    log('bağlantı başlatıldı', { agent_id: agentId });
    await this._startOrFail(s);
  }

  async _failRequest(agentId, attemptId, errorCode) {
    await this.rest.update(agentId, {
      status: 'error',
      error_code: errorCode,
      requested_action: null,
      last_seen_at: this._iso(this.now()),
    });
    await this.rest.insertEvent(agentId, {
      attempt_id: attemptId,
      from_status: null,
      to_status: 'error',
      error_code: errorCode,
    });
    logError('istek reddedildi', { agent_id: agentId, error_code: errorCode });
  }

  async _disconnect(agentId, attemptId) {
    const s = this.sessions.get(agentId);
    const from = s ? s.status : null;
    if (s) {
      s.terminated = true;
      this.sessions.delete(agentId);
      const sock = s.sock;
      s.sock = null;
      if (sock) closeSocket(sock);
    }
    removeAgentAuth(this.authRoot, agentId);
    await this.rest.deleteConnection(agentId);
    await this.rest.insertEvent(agentId, {
      attempt_id: attemptId,
      from_status: from,
      to_status: 'disconnected',
      error_code: null,
    });
    log('bağlantı kaldırıldı', { agent_id: agentId });
  }

  // -------------------------------------------------------------------------
  // Soket açma
  // -------------------------------------------------------------------------

  async _resume(agentId) {
    if (!this.key || this.sessions.has(agentId)) return;
    if (this.sessions.size >= this.maxSessions) {
      logError('kapasite dolu, açılışta oturum atlandı', { agent_id: agentId });
      return;
    }
    // Slot await'ten ÖNCE senkron rezerve edilir: bu sırada tick()->_connect aynı agent için
    // ikinci soket açamaz (_connect sessions.has ile erken döner).
    const s = this._newSession(agentId, null, 'connected', false);
    this.sessions.set(agentId, s);

    let active;
    try {
      active = await this.rest.isSubscriptionActive(agentId);
    } catch (e) {
      this._release(s);
      throw e;
    }
    // Bekleme sırasında oturum sonlandırıldı/kaldırıldı ise devam etme.
    if (this.sessions.get(agentId) !== s) return;

    if (!active) {
      return this._terminate(
        s,
        { status: 'disconnected', error_code: 'subscription_inactive', qr: null, qr_expires_at: null },
        { logout: false, deleteAuth: true },
      );
    }
    await this._startOrFail(s);
  }

  // Rezervasyonu (henüz soket açılmamış oturumu) geri al.
  _release(s) {
    if (this.sessions.get(s.agentId) === s) this.sessions.delete(s.agentId);
  }

  _newSession(agentId, attemptId, status, fresh) {
    return { agentId, attemptId, sock: null, status, qrCount: 0, opened: false, retries: 0, fresh };
  }

  async _startOrFail(s) {
    try {
      await this._spawn(s, s.fresh);
    } catch (e) {
      logError('oturum açılamadı', { agent_id: s.agentId, error: e.name || 'error' });
      await this._terminate(
        s,
        { status: 'error', error_code: 'auth_load_failed', qr: null, qr_expires_at: null },
        { logout: false, deleteAuth: true },
      );
    }
  }

  async _spawn(s, fresh) {
    const { state, saveCreds } = await useEncryptedAuthState(
      agentAuthDir(this.authRoot, s.agentId),
      this.key,
    );
    // Auth okunurken oturum iptal edildiyse soket açılmaz.
    if (this.sessions.get(s.agentId) !== s) return;

    // Aynı oturumda canlı bir soket varsa yenisini açmadan önce kapat (sızıntı olmasın).
    if (s.sock) {
      closeSocket(s.sock);
      s.sock = null;
    }

    const sock = this.makeSocket({
      agentId: s.agentId,
      auth: state,
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    s.sock = sock;
    s.fresh = fresh;
    s.startedAt = this.now();

    sock.ev.on('connection.update', (u) => this._guard('bağlantı olayı', () => this._onUpdate(s, sock, u)));
    sock.ev.on('creds.update', () => this._guard('creds olayı', () => this._onCreds(s, sock, saveCreds)));
    sock.ev.on('groups.update', () => this._guard('grup güncelleme', () => this._syncGroups(s, sock)));
  }

  _isCurrent(s, sock) {
    return this.sessions.get(s.agentId) === s && s.sock === sock;
  }

  // -------------------------------------------------------------------------
  // Baileys olayları
  // -------------------------------------------------------------------------

  async _onUpdate(s, sock, u) {
    if (!this._isCurrent(s, sock)) return;
    const { connection, lastDisconnect, qr } = u || {};
    if (qr) return this._onQr(s, qr);
    if (connection === 'open') return this._onOpen(s, sock);
    if (connection === 'close') {
      return this._onClose(s, sock, lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
        ? lastDisconnect.error.output.statusCode
        : undefined);
    }
    return undefined;
  }

  async _onQr(s, qr) {
    s.qrCount += 1;
    if (s.qrCount > QR_MAX_SHOWS) {
      return this._terminate(
        s,
        { status: 'disconnected', error_code: 'qr_expired', qr: null, qr_expires_at: null },
        { logout: true, deleteAuth: true },
      );
    }
    const prev = s.status;
    s.status = 'qr';
    await this.rest.update(s.agentId, {
      status: 'qr',
      qr,
      qr_expires_at: this._iso(this.now() + QR_TTL_MS),
      qr_count: s.qrCount,
      error_code: null,
    });
    if (prev !== 'qr') {
      await this.rest.insertEvent(s.agentId, {
        attempt_id: s.attemptId,
        from_status: prev,
        to_status: 'qr',
        error_code: null,
      });
    }
  }

  async _onOpen(s, sock) {
    s.opened = true;
    s.fresh = false;
    s.retries = 0;
    const prev = s.status;
    s.status = 'connected';
    await this.rest.update(s.agentId, {
      status: 'connected',
      phone_masked: maskPhone(sock.user && sock.user.id),
      qr: null,
      qr_expires_at: null,
      error_code: null,
      last_seen_at: this._iso(this.now()),
    });
    await this.rest.insertEvent(s.agentId, {
      attempt_id: s.attemptId,
      from_status: prev,
      to_status: 'connected',
      error_code: null,
    });
    log('bağlandı', { agent_id: s.agentId });
    // EML-107: dinleyici bağlıyken HER gelen mesaj sınıflandırılır (seçim boş olsa bile); seçili
    // olmayan grup/DM yalnız sayaç artırır. Seçim yokluğu dinleyiciyi kapatmaz.
    this._attachMessages(s, sock);
    await this._guard('grup senkronu', () => this._syncGroups(s, sock));
  }

  // -------------------------------------------------------------------------
  // Gruplar ve seçim (EML-107 AC-1, AC-S7)
  // -------------------------------------------------------------------------

  // wa_groups tam senkronu (hesap başına en fazla MAX_GROUPS); ardından seçim yenilenir.
  // Liste otoritedir: DB, gönderilen listede olmayan grupları siler (seçimler cascade). Boş liste
  // geçerli bir sonuçtur ve RPC çağrılır. Fetch hatası / geçersiz sonuç: RPC HİÇ çağrılmaz (pesimist).
  async _syncGroups(s, sock) {
    if (!this._isCurrent(s, sock) || typeof sock.groupFetchAllParticipating !== 'function') return;
    let meta;
    try {
      meta = await sock.groupFetchAllParticipating();
    } catch (e) {
      bump(this.msgCounters, 'groups_sync_error');
      logError('grup listesi alınamadı, eski kayıtlar korundu', { agent_id: s.agentId, error: (e && e.name) || 'error' });
      return;
    }
    if (!meta || typeof meta !== 'object') {
      bump(this.msgCounters, 'groups_sync_error');
      logError('grup listesi geçersiz, eski kayıtlar korundu', { agent_id: s.agentId });
      return;
    }
    const capped = capGroups(Object.values(meta), MAX_GROUPS);
    if (capped.truncated) bump(this.msgCounters, 'groups_truncated');
    const rows = toGroupRows(s.agentId, capped.groups);
    s.groupNames = new Map(rows.map((r) => [r.group_jid, r.name]));
    const result = await this.rest.upsertWaGroups(s.agentId, rows);
    if (result === 'not_connected') bump(this.msgCounters, 'groups_sync_rejected');
    await this._refreshSelection(s);
  }

  async _syncAllGroups() {
    for (const s of [...this.sessions.values()]) {
      if (s.opened && s.sock) await this._guard('grup periyodik', () => this._syncGroups(s, s.sock));
    }
  }

  // Seçim önbelleği (60 sn). Okuma hatasında boş küme: hiçbir grup işlenmez (pesimist).
  async _refreshSelection(s) {
    let set;
    try {
      const jids = await this.rest.fetchSelection(s.agentId);
      set = new Set(Array.isArray(jids) ? jids : []);
    } catch (e) {
      bump(this.msgCounters, 'selection_read_error');
      logError('grup seçimi okunamadı', { agent_id: s.agentId, error: (e && e.name) || 'error' });
      set = new Set();
    }
    s.selection = { set, at: this.now() };
    return set;
  }

  async _refreshAllSelections() {
    for (const s of [...this.sessions.values()]) {
      if (s.opened && s.sock) await this._guard('seçim yenileme', () => this._refreshSelection(s));
    }
  }

  async _selectionOf(s) {
    if (!s.selection || this.now() - s.selection.at >= SELECTION_TTL_MS) await this._refreshSelection(s);
    return s.selection ? s.selection.set : new Set();
  }

  // -------------------------------------------------------------------------
  // Mesaj işleme (yalnız seçili gruplar; DM ve seçilmeyenler içeriksiz sayaçla düşer)
  // -------------------------------------------------------------------------

  // Dinleyici oturum soketine en fazla bir kez bağlanır (yeniden bağlanmada yeni soket için tekrar).
  _attachMessages(s, sock) {
    if (s.msgSock === sock) return;
    s.msgSock = sock;
    sock.ev.on('messages.upsert', (u) => this._guard('mesaj olayı', () => this._onMessages(s, sock, u)));
  }

  async _onMessages(s, sock, u) {
    if (!this._isCurrent(s, sock)) return;
    const { messages, type } = u || {};
    if (type !== 'notify' || !Array.isArray(messages)) return;
    for (const msg of messages) {
      await this._guard('mesaj', () => this._onMessage(s, msg));
    }
  }

  async _onMessage(s, msg) {
    // Kendi gönderdiklerimiz gelen mesaj değildir.
    if (!msg || !msg.key || msg.key.fromMe) return;

    // Sınıflandırma metin çıkarmadan ÖNCE: seçili olmayan grup/DM içeriği hiç okunmaz (AC-S4).
    const remoteJid = msg.key.remoteJid;
    const selection = await this._selectionOf(s);
    const outcome = classifyIncoming({ remoteJid }, selection);
    if (outcome !== 'process') {
      bump(this.msgCounters, outcome);
      return;
    }

    // Seçili grup + metinsiz (tepki, protokol) mesaj: ilan adayı değildir, sayılmaz.
    const text = messageText(msg.message);
    if (!text) return;

    const groupName = (s.groupNames && s.groupNames.get(remoteJid)) || null;
    const payload = { id: msg.key.id, text, group: remoteJid, groupName, agentId: s.agentId };
    const ok = await this._postWebhook(payload);
    if (!ok) bump(this.msgCounters, 'webhook_post_failed');
  }

  // Ortak köprünün (bridge.js) webhook desenine uyumlu: 3 deneme, bekleme yok. İçerik loglanmaz.
  async _postWebhook(payload) {
    const { url, secret, fetchImpl = globalThis.fetch } = this.webhook || {};
    if (!url || !secret) return false;
    for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
      try {
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify(payload),
        });
        if (res.ok) return true;
        logError('webhook yanıtı başarısız', { status: res.status });
      } catch (e) {
        logError('webhook bağlantı hatası', { error: (e && e.name) || 'error' });
      }
    }
    return false;
  }

  async _onClose(s, sock, code) {
    if (code === CONNECTION_REPLACED) {
      // Başka yerde açıldı: otomatik yeniden bağlanma YOK (AC-8).
      return this._terminate(
        s,
        { status: 'disconnected', error_code: 'replaced', qr: null, qr_expires_at: null },
        { logout: false, deleteAuth: false },
      );
    }
    if (code === LOGGED_OUT) {
      // Telefondan çıkarıldı (AC-5): auth silinir, yeniden bağlanma yok.
      return this._terminate(
        s,
        { status: 'logged_out', error_code: null, qr: null, qr_expires_at: null, phone_masked: null },
        { logout: false, deleteAuth: true },
      );
    }
    // Geçici kopma: üstel backoff ile yeniden aç; auth korunur.
    const delay = backoffDelay(s.retries, this.rnd);
    s.retries += 1;
    s.sock = null;
    this.counters.reconnects += 1;
    log('bağlantı koptu, yeniden denenecek', { agent_id: s.agentId, status_code: code, retry_in_ms: delay });
    this._schedule(() => this._guard('yeniden bağlanma', () => this._reopen(s)), delay);
  }

  async _reopen(s) {
    if (this.sessions.get(s.agentId) !== s || s.sock) return;
    await this._startOrFail(s);
  }

  async _onCreds(s, sock, saveCreds) {
    if (!this._isCurrent(s, sock)) return;
    try {
      await saveCreds();
    } catch (e) {
      // Kayıt başarısız: bağlantı kalıcı değil; kapat, temizle (AC-S3).
      await this._terminate(
        s,
        { status: 'error', error_code: 'creds_persist_failed', qr: null, qr_expires_at: null },
        { logout: true, deleteAuth: true },
      );
    }
  }

  // Eşleştirme oturumu 45 sn içinde QR üretmediyse kapat (AC-7). Ayrı zamanlayıcı yok:
  // start() döngüsü her saniye tarar (oturum başına timer kurulmaz).
  async _sweepNoQr() {
    const nowMs = this.now();
    for (const s of [...this.sessions.values()]) {
      if (!s.fresh || s.opened || s.qrCount > 0 || !s.sock) continue;
      if (nowMs - s.startedAt < NO_QR_TIMEOUT_MS) continue;
      await this._guard('QR zaman aşımı', () => this._terminate(
        s,
        { status: 'error', error_code: 'no_qr_generated', qr: null, qr_expires_at: null },
        { logout: true, deleteAuth: true },
      ));
    }
  }

  // -------------------------------------------------------------------------
  // Abonelik (AC-9)
  // -------------------------------------------------------------------------

  async _checkSubscriptions() {
    for (const s of [...this.sessions.values()]) {
      let active;
      try {
        active = await this.rest.isSubscriptionActive(s.agentId);
      } catch (e) {
        // Geçici DB hatası oturumu kapatmaz; bir sonraki turda tekrar bakılır.
        continue;
      }
      if (!active && this.sessions.get(s.agentId) === s) {
        await this._terminate(
          s,
          { status: 'disconnected', error_code: 'subscription_inactive', qr: null, qr_expires_at: null },
          { logout: true, deleteAuth: true },
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Ortak sonlandırma: oturumu kaldır, istenirse logout + auth sil, durum + olay yaz.
  // -------------------------------------------------------------------------

  async _terminate(s, fields, { logout = false, deleteAuth = false } = {}) {
    // İdempotent: aynı oturum için ikinci sonlandırma (ör. iki süpürmenin aynı anda
    // yakaladığı oturum) durum yazmaz ve olay üretmez.
    if (s.terminated) return;
    s.terminated = true;
    if (this.sessions.get(s.agentId) === s) this.sessions.delete(s.agentId);
    const sock = s.sock;
    s.sock = null;
    if (logout && sock) closeSocket(sock);
    if (deleteAuth) removeAgentAuth(this.authRoot, s.agentId);

    this.counters.terminated += 1;
    const from = s.status;
    s.status = fields.status;
    log('oturum sonlandı', { agent_id: s.agentId, to_status: fields.status, error_code: fields.error_code || null });

    await this.rest.update(s.agentId, {
      ...fields,
      requested_action: null,
      last_seen_at: this._iso(this.now()),
    });
    await this.rest.insertEvent(s.agentId, {
      attempt_id: s.attemptId,
      from_status: from,
      to_status: fields.status,
      error_code: fields.error_code || null,
    });
  }
}

module.exports = { SessionManager, backoffDelay };

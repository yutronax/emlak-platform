// EML-105: Kişisel oturum yöneticisinin gerçek (Baileys) bağlantısı.
// bridge.js girişinden çağrılır: WA_MULTI_SESSION !== '0' ise startSessions().
// Ortak köprü (bridge.js) bu modülden bağımsız çalışır; burada hata olursa ortak köprü durmaz.
const path = require('node:path');
const pino = require('pino');
const { default: makeWASocket } = require('@whiskeysockets/baileys');
const { SessionManager } = require('./manager');
const { SupabaseRest } = require('./supabase-rest');

const DEFAULT_MAX_SESSIONS = 50;

function parseMaxSessions(raw) {
  const n = Number.parseInt(raw || '', 10);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_SESSIONS;
}

// Baileys soketi: mesaj geçmişi ve çevrimiçi işaretleme kapalı; messages.upsert dinleyicisi
// bu fabrikada veya yöneticide EKLENMEZ (AC-4).
function makeSocket(opts) {
  return makeWASocket({
    auth: opts.auth,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    shouldSyncHistoryMessage: () => false,
  });
}

function startSessions(env = process.env) {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('[wa] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY yok; kişisel oturumlar başlatılmadı');
    return null;
  }

  const manager = new SessionManager({
    rest: new SupabaseRest({ url, serviceKey }),
    makeSocket,
    authRoot: env.WA_AUTH_ROOT || path.join(__dirname, '..', 'wa-auth'),
    key: env.WA_AUTH_KEY,
    maxSessions: parseMaxSessions(env.WA_MAX_SESSIONS),
  });

  manager.start().catch((e) => {
    console.error('[wa] oturum yöneticisi başlatılamadı', e && (e.name || 'error'));
  });
  return manager;
}

module.exports = { startSessions, makeSocket };

// Baileys -> Python orchestrator (/baileys-webhook) köprüsü.
// maviLojistik/sidecar/bridge.js'teki üretimde doğrulanmış bağlantı/mesaj
// ayrıştırma mantığının MVP'ye indirgenmiş portu (grup-adı zenginleştirme,
// risk log'u ve retry-getMessage desteği bu aşamada yok — ileride eklenebilir).
//
// Kullanım: node bridge.js
// Ortam değişkenleri:
//   WEBHOOK_URL (varsayılan: http://localhost:8090/baileys-webhook)

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8090/baileys-webhook';
const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || path.join(__dirname, 'session');

const WEBHOOK_SECRET = process.env.BAILEYS_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.error('[YAPILANDIRMA HATASI] BAILEYS_WEBHOOK_SECRET env değişkeni set edilmemiş, köprü başlatılmıyor.');
  process.exit(1);
}

function extractText(message) {
  if (!message) return null;
  const unwrapped =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message;

  return (
    unwrapped.conversation ||
    unwrapped.extendedTextMessage?.text ||
    unwrapped.imageMessage?.caption ||
    unwrapped.videoMessage?.caption ||
    null
  );
}

function toWebhookPayload(msg) {
  const from = msg.key.remoteJid;
  const text = extractText(msg.message);
  if (!text) return null; // Metin çıkarılamayan mesajları (reaction, protokol vb.) gönderme

  return {
    id: msg.key.id,
    text,
    group: from,
  };
}

async function postMessage(payload) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[WEBHOOK HATA] ${res.status} ${res.statusText}`);
      if (res.status === 401) {
        console.error('[WEBHOOK AUTH HATASI] webhook auth failed (401), BAILEYS_WEBHOOK_SECRET uyuşmuyor');
      }
    }
  } catch (e) {
    console.error('[WEBHOOK BAGLANTI HATASI]', e.message, `(hedef: ${WEBHOOK_URL}, orchestrator.py çalışıyor mu?)`);
  }
}

async function bridge() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'warn' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n=== QR KODU (WhatsApp Web ile taratın) ===\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.connectionReplaced) {
        console.log('[BAGLANTI KAPANDI] conflict/replaced — YENIDEN BAGLANMIYOR. Diğer bağlantıyı kapatıp elle yeniden başlatın.');
        return;
      }

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[BAGLANTI KAPANDI] statusCode=${statusCode} yenidenBaglan=${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(bridge, 2000);
      } else {
        console.log(`[OTURUM KAPANDI] ${AUTH_DIR} klasörünü silip yeniden QR taratmanız gerekir.`);
      }
    } else if (connection === 'open') {
      console.log(`[BAGLANDI] Köprü aktif. Mesajlar -> ${WEBHOOK_URL}`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const payload = toWebhookPayload(msg);
      if (payload) {
        await postMessage(payload);
      }
    }
  });
}

bridge().catch((e) => {
  console.error('[BRIDGE BAŞLATMA HATASI]', e);
  process.exit(1);
});

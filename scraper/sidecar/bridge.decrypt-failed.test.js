// Node'un yerleşik test runner'ı — yeni bir npm bağımlılığı eklemez.
// scraper/sidecar/package.json: "type": "commonjs" -> require() kullanılır.
//
// ATDD EML-77, AC-1 [High]: decrypt edilemeyen mesaj (message null/undefined veya
// messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT) ya da sadece protokol
// içeriği taşıyan mesaj (protocolMessage / senderKeyDistributionMessage, gerçek metin yok)
// webhook'a POST EDİLMEZ; bridge_unhandled_messages.log'a reason alanlı, PII'siz 1 satır
// yazılır: reason "decrypt_failed" veya "protocol_only".
//
// Beklenen durum: Bu testler BAŞARISIZ (red) olmalı — bridge.js henüz decrypt/protocol
// sınıflandırması yapmıyor.
//
// Varsayım: processIncomingMessage(msg, sock) ikinci argümanla Baileys socket'ini alır
// (groupMetadata için). Bu testlerde grup metadata'sına ihtiyaç yok, sock sadece sözleşme
// gereği geçilir.

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { proto } = require('@whiskeysockets/baileys');

const bridge = require('./bridge.js');
const { processIncomingMessage } = bridge || {};

const UNHANDLED_LOG = path.join(__dirname, 'bridge_unhandled_messages.log');
const GROUP_JID = '120363xxx@g.us';
const PHONE = '905551234567';
const CIPHERTEXT_STUB = proto.WebMessageInfo.StubType.CIPHERTEXT;

function removeLogFile() {
  if (fs.existsSync(UNHANDLED_LOG)) fs.rmSync(UNHANDLED_LOG, { force: true });
}

function readUnhandledEntries() {
  if (!fs.existsSync(UNHANDLED_LOG)) return [];
  return fs
    .readFileSync(UNHANDLED_LOG, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

function captureConsole() {
  const originals = { log: console.log, error: console.error, warn: console.warn };
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));
  console.warn = (...args) => lines.push(args.join(' '));
  return {
    lines,
    restore() {
      console.log = originals.log;
      console.error = originals.error;
      console.warn = originals.warn;
    },
  };
}

const sock = {
  groupMetadata: async () => ({ subject: 'Test Grubu' }),
};

const originalFetch = global.fetch;
let fetchCallCount = 0;

beforeEach(() => {
  fetchCallCount = 0;
  global.fetch = async () => {
    fetchCallCount += 1;
    return { ok: true, status: 200, statusText: 'OK' };
  };
  removeLogFile();
});

afterEach(() => {
  global.fetch = originalFetch;
  removeLogFile();
});

// ---------------------------------------------------------------------------
// AC-1 [High]: decrypt_failed
// ---------------------------------------------------------------------------

test('AC-1: message null (decrypt edilemedi) -> webhook POST EDİLMEZ (fetch 0 kez)', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      { key: { remoteJid: GROUP_JID, id: 'msg-decrypt-1', fromMe: false }, message: null },
      sock,
    );
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCallCount, 0);
});

test('AC-1: message null -> bridge_unhandled_messages.log reason="decrypt_failed" ile 1 satır yazar', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      { key: { remoteJid: GROUP_JID, id: 'msg-decrypt-2', fromMe: false }, message: null },
      sock,
    );
  } finally {
    capture.restore();
  }

  const entries = readUnhandledEntries();
  assert.strictEqual(entries.length, 1, 'Tam 1 satır yazılmalı');
  assert.strictEqual(entries[0].reason, 'decrypt_failed');
  assert.strictEqual(entries[0].messageId, 'msg-decrypt-2');
  assert.strictEqual(entries[0].jidType, 'group');
  assert.match(entries[0].timestamp, /^\d{4}-\d{2}-\d{2}T/, 'ISO timestamp olmalı');
});

test('AC-1: messageStubType CIPHERTEXT (message yok) -> reason="decrypt_failed" ile sınıflandırılır', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      {
        key: { remoteJid: GROUP_JID, id: 'msg-decrypt-3', fromMe: false },
        messageStubType: CIPHERTEXT_STUB,
      },
      sock,
    );
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCallCount, 0, 'CIPHERTEXT mesajı webhook a gönderilmemeli');
  const entries = readUnhandledEntries();
  assert.strictEqual(entries.length, 1, 'Tam 1 satır yazılmalı');
  assert.strictEqual(entries[0].reason, 'decrypt_failed');
  assert.strictEqual(entries[0].messageId, 'msg-decrypt-3');
});

test('AC-1: decrypt_failed log satırı PII içermez (ham JID, telefon numarası yok)', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      { key: { remoteJid: GROUP_JID, id: 'msg-decrypt-4', fromMe: false }, message: null },
      sock,
    );
  } finally {
    capture.restore();
  }

  const content = fs.readFileSync(UNHANDLED_LOG, 'utf8');
  assert.ok(!content.includes(GROUP_JID), 'Log, ham grup JID içermemeli');
  assert.ok(!content.includes('120363xxx'), 'Log, JID kökünü içermemeli');
  assert.ok(!content.includes('@g.us'), 'Log, JID sonekini içermemeli');
  assert.ok(!content.includes(PHONE), 'Log, telefon numarası içermemeli');
});

// ---------------------------------------------------------------------------
// AC-1 [High]: protocol_only
// ---------------------------------------------------------------------------

test('AC-1: sadece protocolMessage (gerçek metin yok) -> webhook POST EDİLMEZ (fetch 0 kez)', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      {
        key: { remoteJid: GROUP_JID, id: 'msg-proto-1', fromMe: false },
        message: { protocolMessage: { type: 0 } },
      },
      sock,
    );
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCallCount, 0);
});

test('AC-1: sadece protocolMessage -> bridge_unhandled_messages.log reason="protocol_only" ile 1 satır yazar', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      {
        key: { remoteJid: GROUP_JID, id: 'msg-proto-2', fromMe: false },
        message: { protocolMessage: { type: 0 } },
      },
      sock,
    );
  } finally {
    capture.restore();
  }

  const entries = readUnhandledEntries();
  assert.strictEqual(entries.length, 1, 'Tam 1 satır yazılmalı');
  assert.strictEqual(entries[0].reason, 'protocol_only');
  assert.strictEqual(entries[0].messageId, 'msg-proto-2');
  assert.strictEqual(entries[0].jidType, 'group');
});

test('AC-1: sadece senderKeyDistributionMessage -> reason="protocol_only"', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      {
        key: { remoteJid: GROUP_JID, id: 'msg-proto-3', fromMe: false },
        message: {
          senderKeyDistributionMessage: {
            groupId: GROUP_JID,
            axolotlSenderKeyDistributionMessage: 'opaque',
          },
        },
      },
      sock,
    );
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCallCount, 0);
  const entries = readUnhandledEntries();
  assert.strictEqual(entries.length, 1, 'Tam 1 satır yazılmalı');
  assert.strictEqual(entries[0].reason, 'protocol_only');
});

test('AC-1: protocol_only log satırı PII içermez (ham JID yok)', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      {
        key: { remoteJid: GROUP_JID, id: 'msg-proto-4', fromMe: false },
        message: { protocolMessage: { type: 0 } },
      },
      sock,
    );
  } finally {
    capture.restore();
  }

  const content = fs.readFileSync(UNHANDLED_LOG, 'utf8');
  assert.ok(!content.includes(GROUP_JID), 'Log, ham grup JID içermemeli');
  assert.ok(!content.includes('120363xxx'), 'Log, JID kökünü içermemeli');
  assert.ok(!content.includes('@g.us'), 'Log, JID sonekini içermemeli');
});

test('AC-1: decrypt_failed ve protocol_only birbirinden ayrışır (aynı reason değil)', async () => {
  const capture = captureConsole();
  try {
    await processIncomingMessage(
      { key: { remoteJid: GROUP_JID, id: 'msg-split-A', fromMe: false }, message: null },
      sock,
    );
    await processIncomingMessage(
      {
        key: { remoteJid: GROUP_JID, id: 'msg-split-B', fromMe: false },
        message: { protocolMessage: { type: 0 } },
      },
      sock,
    );
  } finally {
    capture.restore();
  }

  const entries = readUnhandledEntries();
  const byId = Object.fromEntries(entries.map((e) => [e.messageId, e.reason]));
  assert.strictEqual(byId['msg-split-A'], 'decrypt_failed');
  assert.strictEqual(byId['msg-split-B'], 'protocol_only');
});

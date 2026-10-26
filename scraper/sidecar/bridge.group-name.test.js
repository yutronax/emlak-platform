// Node'un yerleşik test runner'ı — yeni bir npm bağımlılığı eklemez.
// scraper/sidecar/package.json: "type": "commonjs" -> require() kullanılır.
//
// ATDD EML-77, AC-2 [Medium]: grup metadata'sı başarıyla alınabiliyorsa webhook payload'ında
// groupName: "<subject>" olur. Ayrıca cache hook'u: aynı JID için ikinci mesajda
// sock.groupMetadata TEKRAR çağrılmaz (TTL cache'den okunur).
//
// Beklenen durum: Bu testler BAŞARISIZ (red) olmalı — bridge.js henüz groupMetadata
// entegrasyonu ve groupName alanı içermiyor.
//
// Varsayımlar:
// - processIncomingMessage(msg, sock) ikinci argümanla Baileys socket'ini alır.
// - Cache modül-içi (bridge.js kapsamında) tutulur; testler birbirini etkilememesi için
//   her test kendi benzersiz JID'ini kullanır.

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const bridge = require('./bridge.js');
const { processIncomingMessage } = bridge || {};

const UNHANDLED_LOG = path.join(__dirname, 'bridge_unhandled_messages.log');
const RISK_LOG = path.join(__dirname, 'bridge_risk.log');

const originalFetch = global.fetch;
let fetchBodies = [];

beforeEach(() => {
  fetchBodies = [];
  global.fetch = async (url, init) => {
    fetchBodies.push(JSON.parse(init.body));
    return { ok: true, status: 200, statusText: 'OK' };
  };
});

afterEach(() => {
  global.fetch = originalFetch;
  if (fs.existsSync(UNHANDLED_LOG)) fs.rmSync(UNHANDLED_LOG, { force: true });
  if (fs.existsSync(RISK_LOG)) fs.rmSync(RISK_LOG, { force: true });
});

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

function textGroupMessage(groupJid, id) {
  return {
    key: { remoteJid: groupJid, id, fromMe: false },
    message: { conversation: 'Kadıköy 2+1 satılık daire 2.500.000 TL' },
  };
}

// ---------------------------------------------------------------------------
// AC-2 [Medium]: metadata başarılı -> payload groupName = subject
// ---------------------------------------------------------------------------

test('AC-2: groupMetadata başarılıysa webhook payload groupName = "Kadıköy Emlak Grubu"', async () => {
  const sock = {
    groupMetadata: async () => ({ subject: 'Kadıköy Emlak Grubu', id: '120363na1@g.us' }),
  };
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363na1@g.us', 'msg-name-1'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchBodies.length, 1, 'Mesaj webhook a 1 kez gönderilmeli');
  assert.strictEqual(fetchBodies[0].groupName, 'Kadıköy Emlak Grubu');
});

test('AC-2: payload group alanı (JID) groupName eklenince DEĞİŞMEZ', async () => {
  const sock = {
    groupMetadata: async () => ({ subject: 'Kadıköy Emlak Grubu' }),
  };
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363na2@g.us', 'msg-name-2'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchBodies[0].group, '120363na2@g.us', 'JID source_group olarak aynen kalmalı');
  assert.strictEqual(fetchBodies[0].id, 'msg-name-2');
  assert.strictEqual(fetchBodies[0].text, 'Kadıköy 2+1 satılık daire 2.500.000 TL');
});

test('AC-2: groupMetadata çağrılır (grup adı için sorgulanır)', async () => {
  let calls = 0;
  const sock = {
    groupMetadata: async () => {
      calls += 1;
      return { subject: 'Kadıköy Emlak Grubu' };
    },
  };
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363na3@g.us', 'msg-name-3'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(calls, 1, 'Grup adı için groupMetadata tam 1 kez çağrılmalı');
});

// ---------------------------------------------------------------------------
// AC-2 cache: cachedGroupMetadata / TTL cache — aynı JID için tekrar çağrı YOK
// ---------------------------------------------------------------------------

test('AC-2 cache: aynı JID için ikinci mesajda sock.groupMetadata TEKRAR çağrılmaz (sayaç 1 kalır)', async () => {
  const jid = '120363cache1@g.us';
  let calls = 0;
  const sock = {
    groupMetadata: async () => {
      calls += 1;
      return { subject: 'Kadıköy Emlak Grubu' };
    },
  };
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage(jid, 'msg-cache-1'), sock);
    await processIncomingMessage(textGroupMessage(jid, 'msg-cache-2'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(calls, 1, '2 mesaj aynı JID ile geldiğinde groupMetadata yalnız 1 kez çağrılmalı');
  assert.strictEqual(fetchBodies.length, 2, 'Her iki mesaj da webhook a gönderilmeli');
  assert.strictEqual(fetchBodies[0].groupName, 'Kadıköy Emlak Grubu');
  assert.strictEqual(fetchBodies[1].groupName, 'Kadıköy Emlak Grubu', 'Cache den okunan grup adı aynı olmalı');
});

test('AC-2 cache: farklı JID\'ler için her biri ayrı groupMetadata çağrısı yapar (cache anahtarı JID)', async () => {
  let calls = 0;
  const sock = {
    groupMetadata: async (jid) => {
      calls += 1;
      return { subject: `Grup ${jid}` };
    },
  };
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363cache2a@g.us', 'msg-cache-2a'), sock);
    await processIncomingMessage(textGroupMessage('120363cache2b@g.us', 'msg-cache-2b'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(calls, 2, 'Farklı JID ler için 2 ayrı çağrı yapılmalı');
});

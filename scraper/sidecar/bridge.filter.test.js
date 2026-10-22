// Node'un yerleşik test runner'ı — yeni bir npm bağımlılığı eklemez.
// scraper/sidecar/package.json: "type": "commonjs" -> require() kullanılır.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// bridge.js henüz isGroupJid'i dışa açmıyor (module.exports yok) -> bu require
// şu an undefined döner, aşağıdaki testler "undefined is not a function" ile
// RED olacak. Bu BEKLENEN davranış (red step), code-copilot bunu yeşile çevirecek.
const bridge = require('./bridge.js');
const { isGroupJid, processIncomingMessage } = bridge || {};

test('isGroupJid: AC-1 — grup JID (@g.us ile biten) -> true', () => {
  assert.strictEqual(isGroupJid('120363xxx@g.us'), true);
});

test('isGroupJid: AC-2 — DM JID (@s.whatsapp.net) -> false', () => {
  assert.strictEqual(isGroupJid('905551234567@s.whatsapp.net'), false);
});

test('isGroupJid: AC-3 — @broadcast -> false', () => {
  assert.strictEqual(isGroupJid('xxx@broadcast'), false);
});

test('isGroupJid: AC-3 — @newsletter -> false', () => {
  assert.strictEqual(isGroupJid('xxx@newsletter'), false);
});

test('isGroupJid: AC-3 — @lid -> false', () => {
  assert.strictEqual(isGroupJid('xxx@lid'), false);
});

test('isGroupJid: AC-S2 — "@g.us" sonek sahteciliği (120363xxx@g.us.evil) -> false', () => {
  assert.strictEqual(isGroupJid('120363xxx@g.us.evil'), false);
});

test('isGroupJid: AC-S2 — "@g.us" iç içe sahtecilik (fake@g.us@s.whatsapp.net) -> false', () => {
  assert.strictEqual(isGroupJid('fake@g.us@s.whatsapp.net'), false);
});

test('isGroupJid: AC-S2 — tam olmayan sonek (xxx@g.usX) -> false', () => {
  assert.strictEqual(isGroupJid('xxx@g.usX'), false);
});

test('isGroupJid: AC-4 — null -> false', () => {
  assert.strictEqual(isGroupJid(null), false);
});

test('isGroupJid: AC-4 — undefined -> false', () => {
  assert.strictEqual(isGroupJid(undefined), false);
});

test('isGroupJid: AC-4 — boş string -> false', () => {
  assert.strictEqual(isGroupJid(''), false);
});

test('isGroupJid: AC-S4 — sayı (string değil) -> false, exception fırlatmaz', () => {
  assert.strictEqual(isGroupJid(12345), false);
});

test('isGroupJid: AC-S4 — obje (string değil) -> false, exception fırlatmaz', () => {
  assert.strictEqual(isGroupJid({}), false);
});

// --- Integration: postMessage/fetch akışı ---
// AC-1/AC-2/AC-S1: filtre kararına göre dış ağ çağrısının (postMessage -> fetch)
// GERÇEKTEN yapılıp yapılmadığı, doğrudan fetch mock'unun çağrı sayısıyla doğrulanır
// (dolaylı bir sinyal — dosya/string varlığı vb. — KULLANILMAZ).
const originalFetch = global.fetch;
let fetchCallCount = 0;

beforeEach(() => {
  fetchCallCount = 0;
  global.fetch = async (...args) => {
    fetchCallCount += 1;
    return { ok: true, status: 200, statusText: 'OK' };
  };
});

afterEach(() => {
  global.fetch = originalFetch;
});

test('Integration AC-1/AC-S1: grup JID -> postMessage TAM 1 KEZ çağrılır (fetch 1 kez)', async () => {
  const groupJid = '120363xxx@g.us';

  // Gerçek handler akışı (processIncomingMessage) doğrudan tetiklenir — bu testin
  // kendi if/filtre dalı YOK, filtre kararı tamamen bridge.js'in kendi kod yolundan gelir.
  await processIncomingMessage({
    key: { remoteJid: groupJid, id: 'msg-1', fromMe: false },
    message: { conversation: 'merhaba' },
  });

  assert.strictEqual(fetchCallCount, 1);
});

test('Integration AC-2/AC-S1: DM JID -> postMessage SIFIR KEZ çağrılır (fetch 0 kez)', async () => {
  const dmJid = '905551234567@s.whatsapp.net';

  await processIncomingMessage({
    key: { remoteJid: dmJid, id: 'msg-2', fromMe: false },
    message: { conversation: 'özel mesaj' },
  });

  assert.strictEqual(fetchCallCount, 0);
});

// AC-6: grup JID'i filtreyi geçse de metin çıkarılamayan (reaction/protokol vb.)
// mesajlar da "skipped" sayacına eklenir ve type=no_text ile loglanır — sessizce kaybolmaz.
test('Integration AC-6: grup JID ama metin yok -> postMessage ÇAĞRILMAZ ve log type=no_text görünür', async () => {
  const originalConsoleLog = console.log;
  const capturedLines = [];
  console.log = (...args) => capturedLines.push(args.join(' '));

  try {
    const groupJid = '120363xxx@g.us';

    await processIncomingMessage({
      key: { remoteJid: groupJid, id: 'msg-4', fromMe: false },
      message: {},
    });

    assert.strictEqual(fetchCallCount, 0);

    const loggedText = capturedLines.join('\n');
    assert.match(loggedText, /\[filter\] skipped \(type=no_text, total_skipped=\d+\)/);
  } finally {
    console.log = originalConsoleLog;
  }
});

// --- Log testi: AC-5, AC-S3 ---
// Atlanan bir mesaj için üretilen log, sabit şablonda olmalı ve ham JID/telefon/metin İÇERMEMELİ.
test('Log AC-5/AC-S3: atlanan mesaj logu sabit şablonda, ham JID/telefon/metin içermez', async () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const capturedLines = [];
  console.log = (...args) => capturedLines.push(args.join(' '));
  console.error = (...args) => capturedLines.push(args.join(' '));

  try {
    const dmJid = '905551234567@s.whatsapp.net';
    const dmMessageBody = 'bu gizli bir DM mesajı metni';

    // Gerçek handler akışı (processIncomingMessage) doğrudan tetiklenir — log üretimi
    // tamamen bridge.js'in kendi kod yolundan gelir, testin kendi dalı YOK.
    await processIncomingMessage({
      key: { remoteJid: dmJid, id: 'msg-3', fromMe: false },
      message: { conversation: dmMessageBody },
    });

    assert.ok(capturedLines.length > 0, 'Atlanan mesaj için bir log satırı üretilmeli');

    const loggedText = capturedLines.join('\n');

    // Sabit şablon: [filter] skipped (type=<enum>, total_skipped=<int>)
    assert.match(loggedText, /\[filter\] skipped \(type=(dm|other|invalid), total_skipped=\d+\)/);

    // Ham JID/telefon numarası/mesaj metni ASLA loglanmamalı.
    assert.ok(!loggedText.includes(dmJid), 'Log, ham JID içermemeli');
    assert.ok(!loggedText.includes('905551234567'), 'Log, telefon numarası içermemeli');
    assert.ok(!loggedText.includes(dmMessageBody), 'Log, mesaj metnini içermemeli');
  } finally {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
});

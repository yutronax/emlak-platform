// Node'un yerleşik test runner'ı — yeni bir npm bağımlılığı eklemez.
// scraper/sidecar/package.json: "type": "commonjs" -> require() kullanılır.
//
// ATDD EML-66, AC-5/AC-6, Davranış Sözleşmesi #5 ve #6.
// processIncomingMessage'ın "metin çıkarılamayan grup mesajı" (type=no_text) dalında
// bridge_unhandled_messages.log dosyasına PII'siz 1 satır yazılmalı (AC-5) ve
// bu yazım başarısız olursa asıl akış durmadan konsola [LOG-YAZMA HATASI] düşmeli (AC-6).
//
// Not: fs.appendFileSync, bridge.js içinde `fs.appendFileSync(...)` olarak (modül
// nesnesi üzerinden, çağrı anında) kullanılmalı ki bu testteki patch'ten etkilensin.
//
// Beklenen durum: Bu testler BAŞARISIZ (red) olmalı — bridge.js henüz log yazmıyor.

const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const bridge = require('./bridge.js');
const { processIncomingMessage } = bridge || {};

const UNHANDLED_LOG = path.join(__dirname, 'bridge_unhandled_messages.log');
const GROUP_JID = '120363xxx@g.us';
const MESSAGE_ID = 'msg-unhandled-eml66';

function unhandledGroupMessage(id = MESSAGE_ID) {
  // Reaction mesajı: toWebhookPayload -> extractText null -> no_text dalı.
  return {
    key: { remoteJid: GROUP_JID, id, fromMe: false },
    message: { reactionMessage: {} },
  };
}

function removeLogFile() {
  if (fs.existsSync(UNHANDLED_LOG)) fs.rmSync(UNHANDLED_LOG, { force: true });
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

const originalAppendFileSync = fs.appendFileSync;

afterEach(() => {
  fs.appendFileSync = originalAppendFileSync;
  removeLogFile();
});

// ---------------------------------------------------------------------------
// AC-5 [High]: metin çıkarılamayan mesaj -> konsol logu YANINDA log dosyasına 1 PII'siz satır
// ---------------------------------------------------------------------------

test('AC-5: metin çıkarılamayan grup mesajı -> bridge_unhandled_messages.log dosyasına 1 satır eklenir', async () => {
  removeLogFile();
  const capture = captureConsole();
  try {
    await processIncomingMessage(unhandledGroupMessage());
  } finally {
    capture.restore();
  }

  assert.ok(fs.existsSync(UNHANDLED_LOG), 'Log dosyası oluşturulmalı');
  const content = fs.readFileSync(UNHANDLED_LOG, 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  assert.strictEqual(lines.length, 1, 'Tam 1 satır yazılmalı');
  assert.ok(lines[0].includes(MESSAGE_ID), 'Satır mesaj ID içermeli');
  assert.match(lines[0], /\d{4}-\d{2}-\d{2}/, 'Satır timestamp (tarih) içermeli');
  assert.match(lines[0], /group/, 'Satır jidType=group bilgisini içermeli');
});

test('AC-5: log satırı PII içermez (ham JID, telefon numarası yok)', async () => {
  removeLogFile();
  const capture = captureConsole();
  try {
    await processIncomingMessage(unhandledGroupMessage());
  } finally {
    capture.restore();
  }

  const content = fs.readFileSync(UNHANDLED_LOG, 'utf8');
  assert.ok(!content.includes(GROUP_JID), 'Log, ham grup JID içermemeli');
  assert.ok(!content.includes('120363xxx'), 'Log, JID kökünü içermemeli');
  assert.ok(!content.includes('@g.us'), 'Log, JID sonekini içermemeli');
});

test('AC-5: mevcut konsol logu (type=no_text) korunur, dosya logu onun YANINDA yazılır', async () => {
  removeLogFile();
  const capture = captureConsole();
  try {
    await processIncomingMessage(unhandledGroupMessage());
  } finally {
    capture.restore();
  }

  const consoleText = capture.lines.join('\n');
  assert.match(consoleText, /\[filter\] skipped \(type=no_text, total_skipped=\d+\)/);
  assert.ok(fs.existsSync(UNHANDLED_LOG), 'Konsol logu varken dosya logu da yazılmalı');
});

test('AC-5: her atlanan mesaj için dosyaya yeni satır eklenir (üst üste yazar, ezmez)', async () => {
  removeLogFile();
  const capture = captureConsole();
  try {
    await processIncomingMessage(unhandledGroupMessage('msg-unhandled-A'));
    await processIncomingMessage(unhandledGroupMessage('msg-unhandled-B'));
  } finally {
    capture.restore();
  }

  const content = fs.readFileSync(UNHANDLED_LOG, 'utf8');
  assert.ok(content.includes('msg-unhandled-A'), 'İlk mesaj satırı korunmalı');
  assert.ok(content.includes('msg-unhandled-B'), 'İkinci mesaj satırı eklenmeli');
});

// ---------------------------------------------------------------------------
// AC-6 [Medium]: log dosyası yazılamıyor -> akış durmaz, konsola [LOG-YAZMA HATASI]
// ---------------------------------------------------------------------------

test('AC-6: appendFileSync hata fırlatsa bile processIncomingMessage exception fırlatmaz', async () => {
  let writeAttempts = 0;
  fs.appendFileSync = () => {
    writeAttempts += 1;
    const err = new Error('EACCES: permission denied (simulated)');
    err.code = 'EACCES';
    throw err;
  };

  const capture = captureConsole();
  try {
    await assert.doesNotReject(processIncomingMessage(unhandledGroupMessage('msg-fail-1')));
  } finally {
    capture.restore();
  }

  assert.ok(writeAttempts >= 1, 'Yazım denenmiş olmalı (mock gerçekten çağrılmalı)');
});

test('AC-6: yazım hatasında konsola [LOG-YAZMA HATASI] uyarısı düşer', async () => {
  fs.appendFileSync = () => {
    throw new Error('ENOSPC: no space left on device (simulated)');
  };

  const capture = captureConsole();
  try {
    await processIncomingMessage(unhandledGroupMessage('msg-fail-2'));
  } finally {
    capture.restore();
  }

  const consoleText = capture.lines.join('\n');
  assert.match(consoleText, /\[LOG-YAZMA HATASI\]/);
});

test('AC-6: yazım hatasında asıl akış devam eder (no_text konsol logu hâlâ basılır)', async () => {
  fs.appendFileSync = () => {
    throw new Error('EACCES: permission denied (simulated)');
  };

  const capture = captureConsole();
  try {
    await processIncomingMessage(unhandledGroupMessage('msg-fail-3'));
  } finally {
    capture.restore();
  }

  const consoleText = capture.lines.join('\n');
  assert.match(
    consoleText,
    /\[filter\] skipped \(type=no_text, total_skipped=\d+\)/,
    'Log hatası, filtre kararının akışını durdurmamalı',
  );
});

test('AC-6: yazım hatasında hata mesajı PII içermez (ham JID/mesaj ID yok)', async () => {
  fs.appendFileSync = () => {
    throw new Error('EACCES: permission denied (simulated)');
  };

  const capture = captureConsole();
  try {
    await processIncomingMessage(unhandledGroupMessage('msg-fail-4'));
  } finally {
    capture.restore();
  }

  const consoleText = capture.lines.join('\n');
  assert.ok(!consoleText.includes(GROUP_JID), 'Uyarı, ham grup JID içermemeli');
});

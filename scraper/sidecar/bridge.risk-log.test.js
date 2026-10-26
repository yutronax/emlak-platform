// Node'un yerleşik test runner'ı — yeni bir npm bağımlılığı eklemez.
// scraper/sidecar/package.json: "type": "commonjs" -> require() kullanılır.
//
// ATDD EML-77, AC-3 [Medium] (groupMetadata başarısız/timeout -> groupName:null + risk log),
// AC-4 [Medium] (webhook 3x başarısız -> mesaj düşer + risk log),
// AC-5 [Low] (log yazma başarısız -> akış durmaz, [LOG-YAZMA HATASI]),
// AC-S1 [Critical] (grup adı log-injection: log dosyalarında grup adı İÇERİĞİ görünmez).
//
// Risk log dosyası: bridge_risk.log (bridge.js __dirname altında). Satırlar JSON,
// alan listesi sabit: {timestamp, category, count?, messageId?}.
//
// Beklenen durum: Bu testler BAŞARISIZ (red) olmalı — bridge.js henüz risk log'u,
// groupMetadata çağrısı ve webhook retry'ı içermiyor.
//
// Varsayımlar:
// - processIncomingMessage(msg, sock) ikinci argümanla Baileys socket'ini alır.
// - Webhook retry sayısı 3 (sabit, bekleme yok): fetch tam 3 kez çağrılır.
// - Timeout 3s; timeout testi için groupMetadata asla resolve etmeyen Promise döner.

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const bridge = require('./bridge.js');
const { processIncomingMessage } = bridge || {};

const UNHANDLED_LOG = path.join(__dirname, 'bridge_unhandled_messages.log');
const RISK_LOG = path.join(__dirname, 'bridge_risk.log');

function removeLogFiles() {
  if (fs.existsSync(UNHANDLED_LOG)) fs.rmSync(UNHANDLED_LOG, { force: true });
  if (fs.existsSync(RISK_LOG)) fs.rmSync(RISK_LOG, { force: true });
}

function readRiskEntries() {
  if (!fs.existsSync(RISK_LOG)) return [];
  return fs
    .readFileSync(RISK_LOG, 'utf8')
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

function textGroupMessage(groupJid, id) {
  return {
    key: { remoteJid: groupJid, id, fromMe: false },
    message: { conversation: 'Kadıköy 2+1 satılık daire 2.500.000 TL' },
  };
}

function makeSock(groupMetadataImpl) {
  return { groupMetadata: groupMetadataImpl };
}

const originalFetch = global.fetch;
const originalAppendFileSync = fs.appendFileSync;
let fetchCalls = [];

function setFetchAlwaysRejects() {
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    throw new Error('ECONNREFUSED (simulated)');
  };
}

function setFetchAlwaysNonOk() {
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    return { ok: false, status: 500, statusText: 'Internal Server Error' };
  };
}

function setFetchAlwaysOk() {
  global.fetch = async (...args) => {
    fetchCalls.push(args);
    return { ok: true, status: 200, statusText: 'OK' };
  };
}

beforeEach(() => {
  fetchCalls = [];
  removeLogFiles();
});

afterEach(() => {
  global.fetch = originalFetch;
  fs.appendFileSync = originalAppendFileSync;
  removeLogFiles();
});

// ---------------------------------------------------------------------------
// AC-3 [Medium]: groupMetadata başarısız/timeout -> mesaj yine gönderilir, groupName null
// ---------------------------------------------------------------------------

test('AC-3: groupMetadata reject ederse -> mesaj YİNE webhook a gönderilir (fetch 1 kez)', async () => {
  setFetchAlwaysOk();
  const sock = makeSock(async () => {
    throw new Error('rate-limited (simulated)');
  });
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363ag1@g.us', 'msg-risk-ag1'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCalls.length, 1, 'Mesaj webhook a 1 kez gönderilmeli');
});

test('AC-3: groupMetadata reject -> webhook body groupName:null taşır', async () => {
  setFetchAlwaysNonOk();
  const sock = makeSock(async () => {
    throw new Error('rate-limited (simulated)');
  });
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363ag2@g.us', 'msg-risk-ag2'), sock);
  } finally {
    capture.restore();
  }

  const body = JSON.parse(fetchCalls[0][1].body);
  assert.strictEqual(body.groupName, null);
  assert.strictEqual(body.id, 'msg-risk-ag2');
});

test('AC-3: groupMetadata reject -> bridge_risk.log category="group_metadata_failed" satırı yazılır', async () => {
  setFetchAlwaysNonOk();
  const sock = makeSock(async () => {
    throw new Error('rate-limited (simulated)');
  });
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363ag3@g.us', 'msg-risk-ag3'), sock);
  } finally {
    capture.restore();
  }

  const entries = readRiskEntries();
  const match = entries.filter((e) => e.category === 'group_metadata_failed');
  assert.strictEqual(match.length, 1, 'Tam 1 group_metadata_failed satırı yazılmalı');
  assert.match(match[0].timestamp, /^\d{4}-\d{2}-\d{2}T/, 'ISO timestamp olmalı');
});

test(
  'AC-3: groupMetadata 3 saniyeden uzun sürerse (timeout) -> groupName:null ve group_metadata_failed',
  { timeout: 10000 },
  async () => {
    setFetchAlwaysOk();
    const sock = makeSock(() => new Promise(() => {})); // asla resolve olmaz
    const capture = captureConsole();
    const started = Date.now();
    try {
      await processIncomingMessage(textGroupMessage('120363ag4@g.us', 'msg-risk-ag4'), sock);
    } finally {
      capture.restore();
    }

    const elapsed = Date.now() - started;
    assert.ok(elapsed < 5000, `Timeout 3s civarında kesilmeli, geçen süre ${elapsed}ms`);
    assert.strictEqual(fetchCalls.length, 1, 'Timeout sonrası mesaj yine gönderilmeli');
    const body = JSON.parse(fetchCalls[0][1].body);
    assert.strictEqual(body.groupName, null);

    const entries = readRiskEntries();
    const match = entries.filter((e) => e.category === 'group_metadata_failed');
    assert.strictEqual(match.length, 1, 'Timeout için group_metadata_failed satırı yazılmalı');
  },
);

// ---------------------------------------------------------------------------
// AC-4 [Medium]: webhook 3x başarısız -> mesaj düşer, risk log webhook_post_failed_max_retries
// ---------------------------------------------------------------------------

test('AC-4: webhook fetch reject -> tam 3 deneme yapılır (fetch 3 kez)', async () => {
  setFetchAlwaysRejects();
  const sock = makeSock(async () => ({ subject: 'Test Grubu' }));
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363wh1@g.us', 'msg-retry-1'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCalls.length, 3, '3 deneme yapılmalı');
});

test('AC-4: webhook 3x non-ok -> fetch 3 kez çağrılır, 4. deneme yok', async () => {
  setFetchAlwaysNonOk();
  const sock = makeSock(async () => ({ subject: 'Test Grubu' }));
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363wh2@g.us', 'msg-retry-2'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCalls.length, 3, 'Tam 3 deneme yapılmalı, daha fazla değil');
});

test('AC-4: 3. deneme de başarısızsa -> bridge_risk.log category="webhook_post_failed_max_retries", messageId dolu', async () => {
  setFetchAlwaysRejects();
  const sock = makeSock(async () => ({ subject: 'Test Grubu' }));
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363wh3@g.us', 'msg-retry-3'), sock);
  } finally {
    capture.restore();
  }

  const entries = readRiskEntries();
  const match = entries.filter((e) => e.category === 'webhook_post_failed_max_retries');
  assert.strictEqual(match.length, 1, 'Tam 1 webhook_post_failed_max_retries satırı yazılmalı');
  assert.strictEqual(match[0].messageId, 'msg-retry-3');
});

test('AC-4: webhook düşürülse bile bridge çalışmaya devam eder (processIncomingMessage reject etmez)', async () => {
  setFetchAlwaysRejects();
  const sock = makeSock(async () => ({ subject: 'Test Grubu' }));
  const capture = captureConsole();
  try {
    await assert.doesNotReject(
      processIncomingMessage(textGroupMessage('120363wh4@g.us', 'msg-retry-4'), sock),
    );
  } finally {
    capture.restore();
  }
});

// ---------------------------------------------------------------------------
// AC-5 [Low]: log yazma başarısız -> akış durmaz, [LOG-YAZMA HATASI] konsola düşer
// (AC-6 testleriyle AYNI desen, risk log için tekrarlandı)
// ---------------------------------------------------------------------------

test('AC-5: risk log appendFileSync hata fırlatsa bile processIncomingMessage exception fırlatmaz', async () => {
  setFetchAlwaysRejects();
  let writeAttempts = 0;
  fs.appendFileSync = () => {
    writeAttempts += 1;
    const err = new Error('EACCES: permission denied (simulated)');
    err.code = 'EACCES';
    throw err;
  };

  const sock = makeSock(async () => ({ subject: 'Test Grubu' }));
  const capture = captureConsole();
  try {
    await assert.doesNotReject(
      processIncomingMessage(textGroupMessage('120363lg1@g.us', 'msg-logfail-1'), sock),
    );
  } finally {
    capture.restore();
  }

  assert.ok(writeAttempts >= 1, 'Risk log yazımı denenmiş olmalı (mock gerçekten çağrılmalı)');
});

test('AC-5: risk log yazım hatasında konsola [LOG-YAZMA HATASI] düşer', async () => {
  setFetchAlwaysRejects();
  fs.appendFileSync = () => {
    throw new Error('ENOSPC: no space left on device (simulated)');
  };

  const sock = makeSock(async () => ({ subject: 'Test Grubu' }));
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363lg2@g.us', 'msg-logfail-2'), sock);
  } finally {
    capture.restore();
  }

  const consoleText = capture.lines.join('\n');
  assert.match(consoleText, /\[LOG-YAZMA HATASI\]/);
});

test('AC-5: risk log yazım hatasında akış devam eder (webhook denemeleri tamamlanır: fetch 3 kez)', async () => {
  setFetchAlwaysRejects();
  fs.appendFileSync = () => {
    throw new Error('EACCES: permission denied (simulated)');
  };

  const sock = makeSock(async () => ({ subject: 'Test Grubu' }));
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363lg3@g.us', 'msg-logfail-3'), sock);
  } finally {
    capture.restore();
  }

  assert.strictEqual(fetchCalls.length, 3, 'Log hatası webhook retry akışını durdurmamalı');
});

// ---------------------------------------------------------------------------
// AC-S1 [Critical]: log-injection — grup adı İÇERİĞİ log dosyalarında GÖRÜNMEZ
// ---------------------------------------------------------------------------

test('AC-S1: newline/sahte satır içeren grup adı -> unhandled ve risk loglarında içerik yok', async () => {
  const injectedSubject = 'Grup\n[FAKE] admin girişi başarılı';
  setFetchAlwaysRejects();
  const sock = makeSock(async () => ({ subject: injectedSubject }));
  const capture = captureConsole();
  try {
    // 1) metin çıkarılamayan (reaction) grup mesajı -> bridge_unhandled_messages.log
    await processIncomingMessage(
      {
        key: { remoteJid: '120363inj1@g.us', id: 'msg-inj-1', fromMe: false },
        message: { reactionMessage: {} },
      },
      sock,
    );
    // 2) metinli grup mesajı, webhook 3x düşer -> bridge_risk.log
    await processIncomingMessage(textGroupMessage('120363inj2@g.us', 'msg-inj-2'), sock);
  } finally {
    capture.restore();
  }

  assert.ok(fs.existsSync(UNHANDLED_LOG), 'Unhandled log oluşmalı (test anlamlı olsun)');
  assert.ok(fs.existsSync(RISK_LOG), 'Risk log oluşmalı (test anlamlı olsun)');

  const unhandledContent = fs.readFileSync(UNHANDLED_LOG, 'utf8');
  const riskContent = fs.readFileSync(RISK_LOG, 'utf8');

  for (const [name, content] of [
    ['bridge_unhandled_messages.log', unhandledContent],
    ['bridge_risk.log', riskContent],
  ]) {
    assert.ok(!content.includes('FAKE'), `${name} grup adı parçasını (FAKE) içermemeli`);
    assert.ok(!content.includes('admin girişi'), `${name} grup adı parçasını içermemeli`);
    assert.ok(!content.includes('Grup'), `${name} grup adının içeriğini içermemeli`);
  }
});

test('AC-S1: injected grup adı konsol satırlarında da log-injection olarak satır kırmaz', async () => {
  const injectedSubject = 'Grup\n[FAKE] admin girişi başarılı';
  setFetchAlwaysRejects();
  const sock = makeSock(async () => ({ subject: injectedSubject }));
  const capture = captureConsole();
  try {
    await processIncomingMessage(textGroupMessage('120363inj3@g.us', 'msg-inj-3'), sock);
  } finally {
    capture.restore();
  }

  const riskContent = fs.existsSync(RISK_LOG) ? fs.readFileSync(RISK_LOG, 'utf8') : '';
  assert.ok(!riskContent.includes('[FAKE]'), 'Risk log, sahte log satırı içermemeli');
  assert.ok(!riskContent.includes('admin girişi'), 'Risk log, sahte mesajı içermemeli');
});

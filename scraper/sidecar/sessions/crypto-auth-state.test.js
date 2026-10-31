// EML-105 / AC-S3: Kişisel oturum auth state'i diskte AES-256-GCM ile şifreli olmalı.
// Arayüz (Baileys useMultiFileAuthState ile uyumlu):
//   const { state, saveCreds } = await useEncryptedAuthState(dir, keyHex)
//   state.creds, state.keys.get(type, ids), state.keys.set(data)
// keyHex: 64 karakterlik hex (32 bayt). Yanlış anahtar / bozuk dosya -> throw.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { useEncryptedAuthState } = require('./crypto-auth-state');

const KEY = crypto.randomBytes(32).toString('hex');
const WRONG_KEY = crypto.randomBytes(32).toString('hex');

const NOISE_PRIV = Buffer.from('NOISE-PRIVATE-SECRET-0123456789ABCDEF');
const IDENTITY_PRIV = Buffer.from('IDENTITY-PRIVATE-SECRET-FEDCBA987654');
const PREKEY_PRIV = Buffer.from('PREKEY-PRIVATE-SECRET-11');

let root;

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-crypto-test-'));
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function sampleCreds() {
  return {
    noiseKey: { private: NOISE_PRIV, public: Buffer.from('NOISE-PUBLIC-0001') },
    signedIdentityKey: { private: IDENTITY_PRIV, public: Buffer.from('IDENTITY-PUBLIC-0001') },
    registrationId: 4242,
    advSecretKey: 'adv-secret-xyz',
  };
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full) : [full];
  });
}

async function seedDir(dir, key = KEY) {
  const { state, saveCreds } = await useEncryptedAuthState(dir, key);
  Object.assign(state.creds, sampleCreds());
  await state.keys.set({
    'pre-key': { 11: { private: PREKEY_PRIV, public: Buffer.from('PREKEY-PUBLIC-11') } },
  });
  await saveCreds();
  return { state, saveCreds };
}

test('round-trip: creds aynı anahtarla yazılıp yeniden okunabilir (Buffer dahil)', async () => {
  const dir = path.join(root, 'round-trip');
  await seedDir(dir);

  const reopened = await useEncryptedAuthState(dir, KEY);

  assert.strictEqual(reopened.state.creds.registrationId, 4242);
  assert.ok(Buffer.isBuffer(reopened.state.creds.noiseKey.private));
  assert.deepStrictEqual(reopened.state.creds.noiseKey.private, NOISE_PRIV);
  assert.deepStrictEqual(reopened.state.creds.signedIdentityKey.private, IDENTITY_PRIV);
});

test('keys: set ile yazılan pre-key yeniden açınca get ile okunur', async () => {
  const dir = path.join(root, 'keys-round-trip');
  await seedDir(dir);

  const reopened = await useEncryptedAuthState(dir, KEY);
  const got = await reopened.state.keys.get('pre-key', ['11']);

  assert.ok(got['11'], 'pre-key 11 okunabilmeli');
  assert.deepStrictEqual(got['11'].private, PREKEY_PRIV);
});

test('AC-S3: diskteki dosyalarda düz "noiseKey"/"signedIdentityKey" ve özel anahtar baytları geçmez', async () => {
  const dir = path.join(root, 'plaintext-check');
  await seedDir(dir);

  const files = listFiles(dir);
  assert.ok(files.length > 0, 'en az bir auth dosyası yazılmalı (aksi halde test anlamsız)');

  const everything = Buffer.concat(files.map((f) => fs.readFileSync(f)));

  assert.ok(!everything.includes('"noiseKey"'), 'düz "noiseKey" JSON anahtarı diskte olmamalı');
  assert.ok(!everything.includes('"signedIdentityKey"'), 'düz "signedIdentityKey" JSON anahtarı diskte olmamalı');
  assert.ok(!everything.includes('noiseKey'), 'noiseKey metni diskte olmamalı');
  assert.ok(!everything.includes('signedIdentityKey'), 'signedIdentityKey metni diskte olmamalı');
  assert.ok(!everything.includes(NOISE_PRIV), 'noise özel anahtarı ham baytlarıyla diskte olmamalı');
  assert.ok(!everything.includes(NOISE_PRIV.toString('base64')), 'noise özel anahtarı base64 ile diskte olmamalı');
  assert.ok(!everything.includes(PREKEY_PRIV), 'pre-key özel anahtarı diskte olmamalı');
});

test('AC-S3: yanlış anahtarla okuma throw eder', async () => {
  const dir = path.join(root, 'wrong-key');
  await seedDir(dir);

  await assert.rejects(() => useEncryptedAuthState(dir, WRONG_KEY));
});

test('AC-S3: bozulmuş/kurcalanmış şifreli dosya okunurken throw eder (GCM auth tag)', async () => {
  const dir = path.join(root, 'tampered');
  await seedDir(dir);

  for (const f of listFiles(dir)) {
    const buf = fs.readFileSync(f);
    buf[buf.length - 1] ^= 0xff;
    fs.writeFileSync(f, buf);
  }

  await assert.rejects(() => useEncryptedAuthState(dir, KEY));
});

test('AC-S3: aynı creds iki kez kaydedilince dosya baytları farklı (rastgele IV)', async () => {
  const dir = path.join(root, 'random-iv');
  const { saveCreds } = await seedDir(dir);

  const before1 = Buffer.concat(listFiles(dir).sort().map((f) => fs.readFileSync(f)));
  await saveCreds();
  const after1 = Buffer.concat(listFiles(dir).sort().map((f) => fs.readFileSync(f)));

  assert.notStrictEqual(Buffer.compare(before1, after1), 0, 'aynı içerik iki kez yazılınca şifreli çıktı aynı olmamalı');
});

test('AC-S3: anahtar 32 bayt değilse (16 bayt hex) oluşturma throw eder', async () => {
  const shortKey = Buffer.alloc(16).toString('hex');
  await assert.rejects(() => useEncryptedAuthState(path.join(root, 'key-16-bytes'), shortKey));
});

test('AC-S3: anahtar 32 bayt değilse (33 bayt hex) oluşturma throw eder', async () => {
  const longKey = Buffer.alloc(33).toString('hex');
  await assert.rejects(() => useEncryptedAuthState(path.join(root, 'key-33-bytes'), longKey));
});

test('AC-S3: anahtar çok kısa bir string ise oluşturma throw eder', async () => {
  await assert.rejects(() => useEncryptedAuthState(path.join(root, 'key-short'), 'abcd'));
});

test('AC-S3: anahtar yoksa (undefined) oluşturma throw eder', async () => {
  await assert.rejects(() => useEncryptedAuthState(path.join(root, 'key-undefined'), undefined));
});

test('yeni klasörde (henüz yok) başlatılır; saveCreds klasörü oluşturur', async () => {
  const dir = path.join(root, 'fresh', 'nested');

  const { state, saveCreds } = await useEncryptedAuthState(dir, KEY);

  assert.ok(state && typeof state.creds === 'object', 'state.creds nesnesi dönmeli');
  assert.strictEqual(typeof saveCreds, 'function');
  await saveCreds();
  assert.ok(fs.existsSync(dir), 'saveCreds sonrası klasör var olmalı');
});

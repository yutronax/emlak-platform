// EML-105 / AC-S3: Kişisel WhatsApp oturumunun auth state'i diskte AES-256-GCM ile şifreli tutulur.
//
// Arayüz (Baileys useMultiFileAuthState ile aynı şekil):
//   const { state, saveCreds } = await useEncryptedAuthState(dir, keyHex)
//   state.creds, state.keys.get(type, ids), state.keys.set(data)
//
// Dosya biçimi: iv(12 bayt) | authTag(16 bayt) | ciphertext
// Anahtar: WA_AUTH_KEY, 64 karakter hex (32 bayt). Geçersiz anahtar -> throw.
// Dosya adları anahtar tipi/kimliğinden türetilmiş SHA-256 özetidir (yol kaçışı yok).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;
const CREDS_FILE = 'creds.bin';

function parseKey(keyHex) {
  if (typeof keyHex !== 'string' || !KEY_HEX_RE.test(keyHex)) {
    throw new Error('WA_AUTH_KEY 32 bayt olmalı (64 karakter hex)');
  }
  return Buffer.from(keyHex, 'hex');
}

function encrypt(key, plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

// Tag tutmazsa (yanlış anahtar veya kurcalama) final() throw eder.
function decrypt(key, blob) {
  if (blob.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('şifreli auth dosyası bozuk');
  }
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const body = blob.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function writeEncrypted(key, file, plaintext) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, encrypt(key, plaintext), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readDecrypted(key, file) {
  if (!fs.existsSync(file)) return undefined;
  return decrypt(key, fs.readFileSync(file));
}

function keyFileName(type, id) {
  const digest = crypto.createHash('sha256').update(`${type}\u0000${id}`).digest('hex');
  return `k-${digest.slice(0, 40)}.bin`;
}

async function useEncryptedAuthState(dir, keyHex) {
  const key = parseKey(keyHex);
  const credsFile = path.join(dir, CREDS_FILE);

  const storedCreds = readDecrypted(key, credsFile);
  const creds = storedCreds === undefined
    ? initAuthCreds()
    : JSON.parse(storedCreds, BufferJSON.reviver);

  const keys = {
    async get(type, ids) {
      const out = {};
      for (const id of ids) {
        const raw = readDecrypted(key, path.join(dir, keyFileName(type, id)));
        if (raw !== undefined) out[id] = JSON.parse(raw, BufferJSON.reviver);
      }
      return out;
    },
    async set(data) {
      for (const type of Object.keys(data)) {
        for (const id of Object.keys(data[type])) {
          const value = data[type][id];
          const file = path.join(dir, keyFileName(type, id));
          if (value == null) {
            fs.rmSync(file, { force: true });
          } else {
            ensureDir(dir);
            writeEncrypted(key, file, JSON.stringify(value, BufferJSON.replacer));
          }
        }
      }
    },
  };

  const state = { creds, keys };

  const saveCreds = async () => {
    ensureDir(dir);
    writeEncrypted(key, credsFile, JSON.stringify(state.creds, BufferJSON.replacer));
  };

  return { state, saveCreds };
}

module.exports = { useEncryptedAuthState };

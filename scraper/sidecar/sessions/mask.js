// EML-105 / AC-S5: Telefon maskeleme ve log redaksiyonu.
const JID_RE = /^(\d{10,15})(?::\d+)?@s\.whatsapp\.net$/;

// Baileys JID (örn. "905321234512:12@s.whatsapp.net") -> "+90 5** *** **12".
// Ülke kodu = son 10 haneden önceki kısım; yerel kısmın ilk ve son 2 hanesi görünür.
function maskPhone(jid) {
  if (typeof jid !== 'string') return null;
  const m = JID_RE.exec(jid);
  if (!m) return null;
  const digits = m[1];
  const cc = digits.slice(0, digits.length - 10);
  const local = digits.slice(-10);
  return `+${cc} ${local[0]}** *** **${local.slice(-2)}`;
}

const REDACT_KEYS = new Set([
  'qr',
  'creds',
  'phone',
  'jid',
  'noiseKey',
  'signedIdentityKey',
  'advSecretKey',
  'private',
  'pairingCode',
]);

// Derin kopya; hassas anahtarların değeri '[redacted]' olur. Girdi değişmez.
function redact(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.has(k) ? '[redacted]' : redact(v);
  }
  return out;
}

module.exports = { maskPhone, redact };

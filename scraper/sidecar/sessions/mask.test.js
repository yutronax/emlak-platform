// EML-105 / AC-5 + AC-S5: Telefon maskeleme ve log redaksiyonu.
// Arayüz: maskPhone(jid) -> string | null ; redact(obj) -> yeni nesne (girdi değişmez).
const { test } = require('node:test');
const assert = require('node:assert');

const { maskPhone, redact } = require('./mask');

test('maskPhone: TR numarası JID’den maskeli biçimde döner', () => {
  assert.strictEqual(maskPhone('905321234512@s.whatsapp.net'), '+90 5** *** **12');
});

test('maskPhone: cihaz eki (":12") olan Baileys JID’i de aynı maskeyi üretir', () => {
  assert.strictEqual(maskPhone('905321234512:12@s.whatsapp.net'), '+90 5** *** **12');
});

test('maskPhone: geçersiz girdi -> null', () => {
  const invalid = [
    null,
    undefined,
    '',
    12345,
    '@s.whatsapp.net',
    '123@s.whatsapp.net',
    '90532a1234@s.whatsapp.net',
    '120363000000000000@g.us',
  ];
  for (const v of invalid) {
    assert.strictEqual(maskPhone(v), null, `girdi ${JSON.stringify(v)} için null beklenir`);
  }
});

test('maskPhone: tam numara çıktıda yer almaz', () => {
  const masked = maskPhone('905321234512@s.whatsapp.net');
  assert.ok(!masked.includes('905321234512'));
  assert.ok(!masked.includes('5321234'));
});

test('redact: qr, creds ve phone alanları [redacted] olur', () => {
  const input = {
    qr: '2@abc-secret',
    creds: { noiseKey: { private: 'x' }, signedIdentityKey: 'y' },
    phone: '905321234512',
    agent_id: '11111111-2222-4333-8444-555555555555',
    status: 'qr',
  };

  const out = redact(input);

  assert.strictEqual(out.qr, '[redacted]');
  assert.strictEqual(out.creds, '[redacted]');
  assert.strictEqual(out.phone, '[redacted]');
  assert.strictEqual(out.status, 'qr', 'redaksiyon olmayan alan korunmalı');
  assert.strictEqual(out.agent_id, input.agent_id);
});

test('redact: iç içe nesnedeki hassas alanlar da redakte edilir', () => {
  const out = redact({ session: { qr: '2@nested-secret', noiseKey: 'k' } });

  assert.strictEqual(out.session.qr, '[redacted]');
  assert.strictEqual(out.session.noiseKey, '[redacted]');
});

test('redact: girdi nesnesini değiştirmez', () => {
  const input = { qr: '2@keep-me', phone: '905321234512' };

  redact(input);

  assert.strictEqual(input.qr, '2@keep-me');
  assert.strictEqual(input.phone, '905321234512');
});

test('redact: zaten maskeli telefon (phone_masked) korunur', () => {
  const out = redact({ phone_masked: '+90 5** *** **12' });

  assert.strictEqual(out.phone_masked, '+90 5** *** **12');
});

test('redact: null/undefined girdide exception fırlatmaz', () => {
  assert.doesNotThrow(() => redact(null));
  assert.doesNotThrow(() => redact(undefined));
});

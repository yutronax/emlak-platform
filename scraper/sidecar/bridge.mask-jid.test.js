// Güvenlik değerlendirmesi 2026-11-16 Y1: kalıcı köprü loglarında maskelenmemiş JID.
const { test } = require('node:test');
const assert = require('node:assert');
const { Writable } = require('stream');
const pino = require('pino');

process.env.BAILEYS_WEBHOOK_SECRET = process.env.BAILEYS_WEBHOOK_SECRET || 'test-secret';
const { maskJids } = require('./bridge');

test('tüm JID türleri maskelenir, son ek korunur', () => {
  const input = [
    '905551112233@s.whatsapp.net',
    '905551112233:12@s.whatsapp.net',
    '120363012345678901@g.us',
    '23456789012345@lid',
    '905551112233@c.us',
  ].join(' ');
  assert.strictEqual(
    maskJids(input),
    '[gizli]@s.whatsapp.net [gizli]@s.whatsapp.net [gizli]@g.us [gizli]@lid [gizli]@c.us',
  );
});

test('JID olmayan metin ve kısa sayılar değişmez', () => {
  const input = 'messageId=AC84B30E25 count=12345 status@broadcast-yok 1234@lid';
  assert.strictEqual(maskJids(input), input);
});

test('pino streamWrite kancasıyla sender/author gibi iç alanlar da maskelenir', () => {
  let out = '';
  const sink = new Writable({
    write(chunk, _enc, cb) {
      out += chunk;
      cb();
    },
  });
  const logger = pino({ level: 'warn', hooks: { streamWrite: maskJids } }, sink);
  logger.error(
    { err: { messageType: 'skmsg', sender: '120363012345678901@g.us', author: '23456789012345@lid' } },
    'çözülemedi 905551112233@s.whatsapp.net',
  );
  assert.ok(!/\d{5,}@/.test(out), `maskelenmemiş JID kaldı: ${out}`);
  assert.ok(out.includes('"sender":"[gizli]@g.us"'));
  assert.ok(out.includes('"author":"[gizli]@lid"'));
});

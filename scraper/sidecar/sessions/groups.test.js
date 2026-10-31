// EML-107 / AC-1, AC-5, AC-S4, AC-S7 (sidecar tarafı): grup senkron, seçim filtresi ve sayaç saf fonksiyonları.
//
// Arayüz sözleşmesi (implementasyonun uyması gereken, groups.js):
//   classifyIncoming({remoteJid, isListing}, selectedSet) -> 'process' | 'skipped_unselected' | 'skipped_dm'
//       selectedSet: Set<string> (seçili grup JID'leri). DM kontrolü seçimden bağımsızdır.
//   capGroups(groups, limit) -> { groups, truncated: boolean }   (limit = 500 hesap başına)
//   createCounters() -> yeni, sıfırlanmış sayaç nesnesi (her çağrıda ayrı nesne)
//   bump(counters, key) -> counters nesnesini YERİNDE artırır (manager.js'teki counters ile aynı desen)
//   toGroupRows(agentId, groupMetadataList) -> [{ agent_id, group_jid, name }]
//       groupMetadataList: Baileys groupFetchAllParticipating() öğeleri, { id, subject }.
//       subject yoksa name null; 200 karakteri aşan jid satırı elenir.
//
// Bu dosya kasıtlı olarak KIRMIZI (red): groups.js henüz yok.
const { test } = require('node:test');
const assert = require('node:assert');
const util = require('node:util');

const { classifyIncoming, capGroups, createCounters, bump, toGroupRows } = require('./groups');

const AGENT = '11111111-2222-4333-8444-555555555555';
const GROUP_SELECTED = '120363000000000001@g.us';
const GROUP_OTHER = '120363000000000002@g.us';
const DM_JID = '905321234512@s.whatsapp.net';
const DM_FULL = '905321234512';
const SECRET_TEXT = 'GIZLI-ILAN-METNI 3+1 Kadıköy 5321234512';

// ---------------------------------------------------------------------------
// classifyIncoming — AC-5 / satır 5-6 (Davranış Sözleşmesi, Sidecar mesaj işleme)
// ---------------------------------------------------------------------------

test('AC-5: seçili grup + ilan mesajı -> process (Python yoluna geçer)', () => {
  const selected = new Set([GROUP_SELECTED]);
  assert.strictEqual(classifyIncoming({ remoteJid: GROUP_SELECTED, isListing: true }, selected), 'process');
});

test('AC-5 satır 5: seçilmemiş grup -> skipped_unselected', () => {
  const selected = new Set([GROUP_SELECTED]);
  assert.strictEqual(classifyIncoming({ remoteJid: GROUP_OTHER, isListing: true }, selected), 'skipped_unselected');
});

test('AC-5 satır 5: seçim boşken her grup -> skipped_unselected (eski davranış: kişisel mesaj işlenmez)', () => {
  assert.strictEqual(classifyIncoming({ remoteJid: GROUP_SELECTED, isListing: true }, new Set()), 'skipped_unselected');
});

test('AC-5 satır 6: birebir DM -> skipped_dm', () => {
  assert.strictEqual(classifyIncoming({ remoteJid: DM_JID, isListing: true }, new Set()), 'skipped_dm');
});

test('AC-5 satır 6: DM, seçim kümesinde olsa bile -> skipped_dm (DM asla işlenmez)', () => {
  const selected = new Set([DM_JID, GROUP_SELECTED]);
  assert.strictEqual(classifyIncoming({ remoteJid: DM_JID, isListing: true }, selected), 'skipped_dm');
});

// ---------------------------------------------------------------------------
// AC-S4 (I, KVKK): seçilmemiş/DM mesajın içeriği, numarası veya JID'si hiçbir
// log çıktısına yazılmaz. Sahte mesaj -> console'a yakalanan metinde aranır.
// ---------------------------------------------------------------------------

test('AC-S4: DM ve seçilmemiş grup sınıflandırması console çıktısında içerik/numara/JID bırakmaz', () => {
  const captured = [];
  const methods = ['log', 'error', 'warn', 'info', 'debug'];
  const originals = {};
  for (const m of methods) {
    originals[m] = console[m];
    console[m] = (...args) => captured.push(util.format(...args));
  }

  let results;
  try {
    const selected = new Set([GROUP_SELECTED]);
    const fakeDm = { remoteJid: DM_JID, isListing: true, text: SECRET_TEXT, participant: DM_JID };
    const fakeOther = { remoteJid: GROUP_OTHER, isListing: true, text: SECRET_TEXT, participant: DM_JID };
    results = [classifyIncoming(fakeDm, selected), classifyIncoming(fakeOther, selected)];
  } finally {
    for (const m of methods) console[m] = originals[m];
  }

  assert.deepStrictEqual(results, ['skipped_dm', 'skipped_unselected']);

  const text = captured.join('\n');
  assert.ok(!text.includes('GIZLI-ILAN'), 'mesaj metni loglanmamalı');
  assert.ok(!text.includes(DM_FULL), 'gönderen numarası loglanmamalı');
  assert.ok(!text.includes(DM_JID), 'DM JID loglanmamalı');
  assert.ok(!text.includes(GROUP_OTHER), 'seçilmemiş grup JID loglanmamalı');
});

test('AC-S4: dönüş değeri yalnız üç sabit sınıftan biridir; içerik/JID sızdırmaz', () => {
  const allowed = ['process', 'skipped_unselected', 'skipped_dm'];
  const r = classifyIncoming({ remoteJid: DM_JID, isListing: true, text: SECRET_TEXT }, new Set());
  assert.ok(allowed.includes(r), `beklenmeyen dönüş: ${String(r)}`);
  assert.strictEqual(r, 'skipped_dm');
});

// ---------------------------------------------------------------------------
// AC-S7 (D) / AC-1: grup upsert üst sınırı 500, fazlası atlanır, truncated=true
// ---------------------------------------------------------------------------

function fakeGroups(n) {
  return Array.from({ length: n }, (_, i) => ({ jid: `1203630000${String(i).padStart(5, '0')}@g.us`, name: `G${i}` }));
}

test('AC-S7: 3 grup -> hepsi döner, truncated=false', () => {
  const input = fakeGroups(3);
  const out = capGroups(input, 500);
  assert.strictEqual(out.truncated, false);
  assert.strictEqual(out.groups.length, 3);
  assert.deepStrictEqual(out.groups, input);
});

test('AC-S7: tam 500 grup -> kesilmez, truncated=false (sınır dahil)', () => {
  const out = capGroups(fakeGroups(500), 500);
  assert.strictEqual(out.groups.length, 500);
  assert.strictEqual(out.truncated, false);
});

test('AC-S7: 501 grup -> 500 döner, truncated=true, sıra korunur (ilk 500)', () => {
  const input = fakeGroups(501);
  const out = capGroups(input, 500);
  assert.strictEqual(out.truncated, true);
  assert.strictEqual(out.groups.length, 500);
  assert.strictEqual(out.groups[0].jid, input[0].jid);
  assert.strictEqual(out.groups[499].jid, input[499].jid);
  assert.ok(!out.groups.some((g) => g.jid === input[500].jid), '501. grup yazılmamalı');
});

test('AC-S7: 600 grup -> 500 döner, truncated=true', () => {
  const out = capGroups(fakeGroups(600), 500);
  assert.strictEqual(out.groups.length, 500);
  assert.strictEqual(out.truncated, true);
});

test('AC-1: boş liste -> boş, truncated=false (boş ≠ hata)', () => {
  const out = capGroups([], 500);
  assert.deepStrictEqual(out, { groups: [], truncated: false });
});

// ---------------------------------------------------------------------------
// Sayaçlar — Davranış Sözleşmesi "Hiçbir şey yapılamadı ama hata yok":
// her durumun ayrı sayacı var, sessiz geçiş yok.
// ---------------------------------------------------------------------------

const REQUIRED_COUNTER_KEYS = [
  'personal_auto_approved', // satır 1
  'personal_queued', // satır 2
  'personal_queued_noscore', // satır 3
  'personal_not_listing', // satır 4
  'skipped_unselected', // satır 5
  'skipped_dm', // satır 6
  'personal_duplicate', // satır 7
  'personal_write_error', // satır 8
  'threshold_fallback', // satır 10
  'groups_truncated', // AC-S7
];

test('sayaç: createCounters her Davranış Sözleşmesi durumu için sıfır sayaç içerir', () => {
  const c = createCounters();
  for (const key of REQUIRED_COUNTER_KEYS) {
    assert.ok(Object.prototype.hasOwnProperty.call(c, key), `sayaç eksik: ${key}`);
    assert.strictEqual(c[key], 0, `${key} başlangıçta 0 olmalı`);
  }
});

test('sayaç: createCounters her çağrıda ayrı nesne döner (paylaşılan durum yok)', () => {
  const a = createCounters();
  bump(a, 'skipped_dm');
  const b = createCounters();
  assert.strictEqual(b.skipped_dm, 0, 'ikinci nesne birinciden etkilenmemeli');
});

test('sayaç: bump ilgili sayacı 1 artırır, tekrar çağrıda birikir', () => {
  const c = createCounters();
  bump(c, 'skipped_unselected');
  assert.strictEqual(c.skipped_unselected, 1);
  bump(c, 'skipped_unselected');
  assert.strictEqual(c.skipped_unselected, 2);
  assert.strictEqual(c.skipped_dm, 0, 'diğer sayaçlar etkilenmemeli');
});

test('sayaç satır 5-6: skipped_unselected ve skipped_dm birbirinden bağımsız artar', () => {
  const c = createCounters();
  bump(c, 'skipped_dm');
  bump(c, 'skipped_dm');
  bump(c, 'skipped_unselected');
  assert.strictEqual(c.skipped_dm, 2);
  assert.strictEqual(c.skipped_unselected, 1);
});

test('sayaç AC-S7: groups_truncated bump ile artar', () => {
  const c = createCounters();
  bump(c, 'groups_truncated');
  assert.strictEqual(c.groups_truncated, 1);
});

// ---------------------------------------------------------------------------
// toGroupRows — AC-1 (wa_groups upsert satırları), AC-6 (name null) / Sözleşme satır 6
// ---------------------------------------------------------------------------

test('AC-1: grup metadatası wa_groups satırlarına (agent_id, group_jid, name) dönüşür', () => {
  const rows = toGroupRows(AGENT, [
    { id: GROUP_SELECTED, subject: 'Kadıköy Emlak' },
    { id: GROUP_OTHER, subject: 'Beşiktaş İlanları' },
  ]);
  assert.deepStrictEqual(rows, [
    { agent_id: AGENT, group_jid: GROUP_SELECTED, name: 'Kadıköy Emlak' },
    { agent_id: AGENT, group_jid: GROUP_OTHER, name: 'Beşiktaş İlanları' },
  ]);
});

test('Sözleşme satır 6: subject yoksa name null (UI "(adsız grup)" gösterir)', () => {
  const rows = toGroupRows(AGENT, [{ id: GROUP_SELECTED }]);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].name, null);
  assert.strictEqual(rows[0].group_jid, GROUP_SELECTED);
});

test('AC-1: her satır çağıran oturumun agent_id değerini taşır (başka agent sızmaz)', () => {
  const rows = toGroupRows(AGENT, [{ id: GROUP_SELECTED, subject: 'X' }, { id: GROUP_OTHER, subject: 'Y' }]);
  for (const r of rows) {
    assert.strictEqual(r.agent_id, AGENT);
  }
});

test('toGroupRows: 200 karakter sınırı — 200 kabul, 201 elenir (sessizce atlanır, hata fırlatmaz)', () => {
  const jid200 = 'a'.repeat(200 - '@g.us'.length) + '@g.us';
  const jid201 = 'a'.repeat(201 - '@g.us'.length) + '@g.us';
  assert.strictEqual(jid200.length, 200);
  assert.strictEqual(jid201.length, 201);

  const rows = toGroupRows(AGENT, [
    { id: jid201, subject: 'Uzun' },
    { id: jid200, subject: 'Tam' },
  ]);
  assert.strictEqual(rows.length, 1, '201 karakterli jid elenmeli');
  assert.strictEqual(rows[0].group_jid, jid200);
});

test('toGroupRows: boş girdi -> boş dizi', () => {
  assert.deepStrictEqual(toGroupRows(AGENT, []), []);
});

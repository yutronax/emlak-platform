// EML-107 / AC-1, AC-5, AC-S4, AC-S7: Kişisel oturumlar için grup ve mesaj sınıflandırma saf fonksiyonları.
// Dış bağımlılık yok; manager.js bu fonksiyonları kullanır.

const GROUP_SUFFIX = '@g.us';
const MAX_JID_LENGTH = 200;
const MAX_GROUPS = 500;

// Sayaç sözleşmesi (Davranış Sözleşmesi "Sidecar mesaj işleme" satır 1-10 + AC-S7).
// personal_* ve threshold_fallback sayaçlarını DB (ingest_personal_listing / bump_sidecar_counter)
// 'orchestrator' alt nesnesine yazar; sidecar bu anahtarları artırmaz. Sidecar kendi
// sayaçlarını 'sidecar' alt nesnesine yazar (set_sidecar_counters).
const COUNTER_KEYS = [
  'personal_auto_approved',
  'personal_queued',
  'personal_queued_noscore',
  'personal_not_listing',
  'personal_duplicate',
  'personal_write_error',
  'threshold_fallback',
  'skipped_unselected',
  'skipped_dm',
  'groups_truncated',
  'groups_sync_rejected',
  'groups_sync_error',
  'webhook_post_failed',
  'selection_read_error',
];

// Yalnız grup JID'leri işlenir; DM ve grup-dışı JID'ler (yayın vb.) 'skipped_dm' sayılır.
// Sınıflandırma içerik, gönderen numarası veya JID loglamaz (AC-S4).
// isListing parametresi kabul edilir ama sınıflandırmayı etkilemez: metinsiz mesajlar manager'da elenir.
function classifyIncoming({ remoteJid } = {}, selectedSet) {
  if (typeof remoteJid !== 'string' || !remoteJid.endsWith(GROUP_SUFFIX)) return 'skipped_dm';
  if (!selectedSet || !selectedSet.has(remoteJid)) return 'skipped_unselected';
  return 'process';
}

// Hesap başına grup üst sınırı; fazlası yazılmaz, truncated=true döner (AC-S7).
function capGroups(groups, limit = MAX_GROUPS) {
  const list = Array.isArray(groups) ? groups : [];
  return { groups: list.slice(0, limit), truncated: list.length > limit };
}

function createCounters() {
  const counters = {};
  for (const key of COUNTER_KEYS) counters[key] = 0;
  return counters;
}

// Sayacı yerinde artırır; yalnız ilgili anahtar değişir.
function bump(counters, key) {
  counters[key] = (counters[key] || 0) + 1;
  return counters;
}

// Baileys groupFetchAllParticipating öğelerini wa_groups satırlarına çevirir.
// subject yoksa name null; 200 karakteri aşan JID sessizce elenir.
function toGroupRows(agentId, metadataList) {
  if (!Array.isArray(metadataList)) return [];
  const rows = [];
  for (const g of metadataList) {
    const jid = g && g.id;
    if (typeof jid !== 'string' || jid.length === 0 || jid.length > MAX_JID_LENGTH) continue;
    const name = typeof g.subject === 'string' && g.subject.length > 0 ? g.subject : null;
    rows.push({ agent_id: agentId, group_jid: jid, name });
  }
  return rows;
}

// Baileys mesaj gövdesinden düz metin (bridge.js extractText ile aynı kurallar).
function messageText(message) {
  if (!message) return null;
  const unwrapped =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message;
  return (
    unwrapped.conversation ||
    unwrapped.extendedTextMessage?.text ||
    unwrapped.imageMessage?.caption ||
    unwrapped.videoMessage?.caption ||
    null
  );
}

module.exports = {
  classifyIncoming,
  capGroups,
  createCounters,
  bump,
  toGroupRows,
  messageText,
  MAX_GROUPS,
  COUNTER_KEYS,
};

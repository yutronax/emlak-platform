// EML-105 / AC-S6: Sidecar'ın Supabase (PostgREST) istemcisi. Yeni bağımlılık yok: global fetch.
// Yazma kapsamı: wa_connections (yalnız ALLOWED_UPDATE_FIELDS), wa_connection_events,
// wa_connections silme, sidecar_heartbeat. Başka tabloya yazmaz.
// Her agent sorgusu agent_id eq filtreli; istek alma sorgusu yalnız requested_action dolu satırlar.
const { isValidAgentId } = require('./paths');

const ALLOWED_UPDATE_FIELDS = new Set([
  'status',
  'qr',
  'qr_expires_at',
  'qr_count',
  'phone_masked',
  'error_code',
  'last_seen_at',
  'requested_action',
  'updated_at',
]);

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

class SupabaseRest {
  constructor({ url, serviceKey, fetchImpl = globalThis.fetch, now = Date.now }) {
    if (!url || !serviceKey) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
    this.base = `${String(url).replace(/\/+$/, '')}/rest/v1`;
    this.serviceKey = serviceKey;
    this.fetch = fetchImpl;
    this.now = now;
  }

  _headers(extra = {}) {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async _request(method, pathAndQuery, { body, prefer } = {}) {
    const res = await this.fetch(`${this.base}/${pathAndQuery}`, {
      method,
      headers: this._headers(prefer ? { Prefer: prefer } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      // Hata metninde anahtar/gövde yok; yalnız yöntem, tablo yolu ve HTTP kodu.
      throw new Error(`supabase ${method} ${pathAndQuery.split('?')[0]} -> ${res.status}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  _agentFilter(agentId) {
    if (!isValidAgentId(agentId)) throw new Error('geçersiz agent_id');
    return `agent_id=eq.${agentId}`;
  }

  // Bekleyen connect/disconnect istekleri (poll).
  async fetchPendingRequests() {
    const rows = await this._request(
      'GET',
      'wa_connections?select=agent_id,requested_action,attempt_id&requested_action=not.is.null',
    );
    return Array.isArray(rows) ? rows : [];
  }

  // Yalnız izinli durum alanları yazılır; diğer alan denenirse hata.
  async update(agentId, fields) {
    const filter = this._agentFilter(agentId);
    const keys = Object.keys(fields || {});
    const disallowed = keys.filter((k) => !ALLOWED_UPDATE_FIELDS.has(k));
    if (disallowed.length > 0) throw new Error(`izinsiz alan: ${disallowed.join(',')}`);
    if (keys.length === 0) return;
    await this._request('PATCH', `wa_connections?${filter}`, {
      body: fields,
      prefer: 'return=minimal',
    });
  }

  async insertEvent(agentId, ev) {
    if (!isValidAgentId(agentId)) throw new Error('geçersiz agent_id');
    await this._request('POST', 'wa_connection_events', {
      body: {
        agent_id: agentId,
        attempt_id: ev.attempt_id ?? null,
        from_status: ev.from_status ?? null,
        to_status: ev.to_status ?? null,
        error_code: ev.error_code ?? null,
      },
      prefer: 'return=minimal',
    });
  }

  async deleteConnection(agentId) {
    const filter = this._agentFilter(agentId);
    await this._request('DELETE', `wa_connections?${filter}`, { prefer: 'return=minimal' });
  }

  // Tek satır (id=1) upsert. Yalnız sayaçlar ve bayraklar.
  async heartbeat({ sessions_open, misconfigured, counters }) {
    await this._request('POST', 'sidecar_heartbeat?on_conflict=id', {
      body: {
        id: 1,
        last_beat_at: new Date(this.now()).toISOString(),
        sessions_open: Number.isInteger(sessions_open) ? sessions_open : 0,
        misconfigured: misconfigured === true,
        counters: counters && typeof counters === 'object' ? counters : {},
      },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  // Abonelik erişimi: active/trialing/past_due ve dönem sonu gelmemiş (AC-9).
  async isSubscriptionActive(agentId) {
    const filter = this._agentFilter(agentId);
    const rows = await this._request('GET', `subscriptions?select=status,current_period_end&${filter}`);
    const nowMs = this.now();
    return (Array.isArray(rows) ? rows : []).some(
      (r) => ACTIVE_STATUSES.has(r.status) && Date.parse(r.current_period_end) > nowMs,
    );
  }

  async listConnectedAgents() {
    const rows = await this._request('GET', 'wa_connections?select=agent_id&status=eq.connected');
    return (Array.isArray(rows) ? rows : []).map((r) => r.agent_id).filter(isValidAgentId);
  }
}

module.exports = { SupabaseRest, ALLOWED_UPDATE_FIELDS };

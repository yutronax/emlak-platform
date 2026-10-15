# Sistem Mimarisi

Şu ana kadar kurulan veri akışı (Faz 1-3).

```mermaid
flowchart TD
    WA["WhatsApp emlak gruplari"] --> SC["Baileys sidecar (Node.js)"]
    SC -- "POST /baileys-webhook" --> ORCH["orchestrator.py (queue + thread pool)"]
    ORCH --> PARSE["parser.py (Gemini)"]
    PARSE --> QG["quality_gate.py"]
    QG --> FP["fingerprint dedup"]
    FP --> RAW[("raw_listings (Supabase)")]

    ADMIN["/admin/listings (Next.js)"] -- "select, RLS: is_admin" --> RAW
    ADMIN -- "approve_raw_listing() RPC" --> LIST[("listings (Supabase)")]

    AGENT["/agent/dashboard (Next.js)"] -- "select, RLS: subscriber" --> LIST

    EDITOR["Editor: bitmis video"] -.Faz 5.-> ADMINV["/admin/videos"]
    ADMINV -.Faz 5.-> STORAGE[("Supabase Storage")]
    STORAGE -.Faz 5.-> PUBLIC["Public video galerisi"]
```

**Notlar**
- Kesikli oklar (Faz 5) henüz kurulmadı, planlanan akışı gösteriyor.
- `approve_raw_listing()` / `reject_raw_listing()` Postgres fonksiyonları `SECURITY INVOKER` — admin yetkisi fonksiyon içinde değil, RLS politikalarında (`supabase/migrations/0002_admin_review.sql`).
- Dedup üç katmanlı: Baileys sidecar'daki bellek-içi `_active_ids` seti, `fingerprint` kolonu üzerindeki kontrol, `raw_listings.source_message_id` üzerindeki unique index.

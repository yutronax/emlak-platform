"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { TextField } from "@/components/auth/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { diffEdits, scoreBand, validateEdits, type ScoreBand } from "@/lib/review-ui/edits";
import type { ParsedFields, RejectReason, ReviewItem, ReviewQuery, ReviewService } from "@/lib/review-ui/types";

import { ThresholdForm } from "./threshold-form";

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: ReviewItem[]; total: number; page: number; pageSize: number };

type Errors = Partial<Record<keyof ParsedFields, string>>;

const DEFAULT_QUERY: ReviewQuery = { order: "oldest", page: 1 };

const BAND: Record<ScoreBand, { label: string; className: string }> = {
  none: { label: "Skor yok", className: "bg-mist-200 text-ink-900" },
  low: { label: "Düşük", className: "bg-brick-700/10 text-brick-700" },
  mid: { label: "Orta", className: "bg-terracotta-600/10 text-terracotta-700" },
  high: { label: "Yüksek", className: "bg-moss-700/10 text-moss-700" },
};

const REASONS: { value: RejectReason; label: string }[] = [
  { value: "incomplete", label: "Eksik bilgi" },
  { value: "duplicate", label: "Mükerrer ilan" },
  { value: "not_listing", label: "İlan değil" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Diğer" },
];

const scoreText = (s: number | null) =>
  s === null ? BAND.none.label : `${BAND[scoreBand(s)].label} ${s.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;

const rtf = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });
function ago(iso: string) {
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  if (Math.abs(min) < 60 * 24) return rtf.format(Math.round(min / 60), "hour");
  return rtf.format(Math.round(min / 1440), "day");
}

const control =
  "rounded-md border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta-600";
const smallLabel = "text-xs font-medium text-slate-500";

function clean(q: ReviewQuery): ReviewQuery {
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== "")) as ReviewQuery;
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function ReviewDesk({ service }: { service: ReviewService }) {
  const [query, setQuery] = useState<ReviewQuery>(DEFAULT_QUERY);
  const [search, setSearch] = useState("");
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ParsedFields | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason>("incomplete");
  const [note, setNote] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [threshold, setThreshold] = useState<{ value: number; failed: boolean } | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "review">("list");
  const requestId = useRef(0);
  const paneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    service.cities().then(setCities, () => setCities([]));
    service.getThreshold().then(setThreshold, () => setThreshold({ value: 0.7, failed: true }));
  }, [service]);

  const load = useCallback(
    (q: ReviewQuery) => {
      const id = ++requestId.current;
      return service.list(q).then(
        (res) => {
          if (id !== requestId.current) return;
          if (res.status !== "ok") return setList({ status: "error" });
          setList({ ...res, status: "ready" });
          setSelectedId(res.items[0]?.id ?? null);
          setForm(res.items[0] ? { ...res.items[0].parsed } : null);
          setErrors({});
          setActionError(null);
        },
        () => id === requestId.current && setList({ status: "error" }),
      );
    },
    [service],
  );

  useEffect(() => {
    void load(query);
  }, [load, query]);

  function applyQuery(next: ReviewQuery) {
    setNotice(null);
    setList({ status: "loading" });
    setQuery(clean({ ...next, page: next.page ?? 1 }));
  }

  const items = list.status === "ready" ? list.items : [];
  const index = items.findIndex((i) => i.id === selectedId);
  const selected = index >= 0 ? items[index] : null;

  function select(item: ReviewItem | undefined, openOnMobile = true) {
    if (!item) return;
    setSelectedId(item.id);
    setForm({ ...item.parsed });
    setErrors({});
    setActionError(null);
    if (openOnMobile) setMobileView("review");
  }

  // İşlenen ilan kuyruktan düşer, aynı konumdaki (ya da bir önceki) ilan seçilir.
  function removeSelected(message: string) {
    if (list.status !== "ready" || !selected) return;
    const rest = list.items.filter((i) => i.id !== selected.id);
    setList({ ...list, items: rest, total: Math.max(0, list.total - 1) });
    const next = rest[Math.min(index, rest.length - 1)];
    setNotice(message);
    if (next) select(next, false);
    else {
      setSelectedId(null);
      setForm(null);
      setMobileView("list");
    }
  }

  async function run(kind: "approve" | "reject", action: () => ReturnType<ReviewService["approve"]>) {
    setPending(kind);
    setActionError(null);
    setNotice(null);
    try {
      const res = await action();
      if (res.status === "ok") {
        setRejecting(false);
        removeSelected(kind === "approve" ? "Onaylandı." : "Reddedildi.");
      } else if (res.status === "gone") {
        setRejecting(false);
        removeSelected("Bu ilan başka bir yönetici tarafından işlendi.");
      } else {
        setActionError(res.message ?? "İşlem tamamlanamadı, tekrar deneyin.");
      }
    } catch {
      setActionError("İşlem tamamlanamadı, tekrar deneyin.");
    } finally {
      setPending(null);
    }
  }

  function approve() {
    if (!selected || !form || pending) return;
    const invalid = validateEdits(form);
    setErrors(invalid);
    const first = Object.keys(invalid)[0];
    if (first) {
      paneRef.current?.querySelector<HTMLElement>(`#rv-${first}`)?.focus();
      return;
    }
    void run("approve", () => service.approve(selected.id, diffEdits(selected.parsed, form)));
  }

  function openReject() {
    if (!selected || pending) return;
    setReason("incomplete");
    setNote("");
    setRejecting(true);
  }

  // Klavye kısayolları: yazı alanında ve pencere açıkken devre dışı.
  // Dinleyici bir kez eklenir; en güncel durumu okuyan işleyici her render sonrası ref'e yazılır.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (rejecting || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "j") select(items[Math.min(index + 1, items.length - 1)]);
      else if (k === "k") select(items[Math.max(index - 1, 0)]);
      else if (k === "a") approve();
      else if (k === "r") openReject();
      else return;
      e.preventDefault();
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const filtered = Boolean(query.q || query.city || query.source || query.score);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    applyQuery({ ...query, q: search.trim() || undefined, page: 1 });
  }

  function clearFilters() {
    setSearch("");
    applyQuery(DEFAULT_QUERY);
  }

  const set = (k: keyof ParsedFields) => (e: { target: { value: string } }) => {
    const v = e.target.value;
    setForm((f) => {
      if (!f) return f;
      if (k === "price" || k === "areaM2") {
        const digits = v.replace(/\D/g, "");
        return { ...f, [k]: digits ? Number(digits) : null };
      }
      return { ...f, [k]: v };
    });
  };
  const changed = (k: keyof ParsedFields) => Boolean(selected && form && k in diffEdits(selected.parsed, form));

  const field = (k: keyof ParsedFields, label: string, extra: Record<string, unknown> = {}) => (
    <div className="relative">
      <TextField
        name={`rv-${k}`}
        label={label}
        value={form?.[k] === null || form?.[k] === undefined ? "" : String(form[k])}
        onChange={set(k)}
        error={errors[k]}
        disabled={pending !== null}
        {...extra}
      />
      {changed(k) && (
        <span className="absolute top-0 right-0 rounded bg-terracotta-600/10 px-1.5 text-[11px] font-semibold text-terracotta-700">
          düzenlendi
        </span>
      )}
    </div>
  );

  const range =
    list.status === "ready" && list.items.length > 0
      ? `${(list.page - 1) * list.pageSize + 1}–${(list.page - 1) * list.pageSize + list.items.length} / ${list.total}`
      : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 font-body text-ink-900 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-terracotta-700 uppercase">Yönetim</p>
          <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-normal tracking-[-0.03em]">İlan onay kuyruğu</h1>
        </div>
        <p className="hidden text-xs text-slate-500 lg:block">
          Kısayollar: <kbd className="rounded border border-mist-200 bg-white px-1">J</kbd>/
          <kbd className="rounded border border-mist-200 bg-white px-1">K</kbd> gezin ·{" "}
          <kbd className="rounded border border-mist-200 bg-white px-1">A</kbd> onayla ·{" "}
          <kbd className="rounded border border-mist-200 bg-white px-1">R</kbd> reddet
        </p>
      </div>

      <details className="rounded-leaf border border-mist-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Ayarlar · kişisel ilan otomatik onay eşiği</summary>
        {threshold && (
          <div className="pt-2">
            {threshold.failed && (
              <p className="text-xs text-brick-700">Mevcut eşik okunamadı; 0,70 varsayılan gösteriliyor.</p>
            )}
            <ThresholdForm value={threshold.value} onSave={(v) => service.saveThreshold(v)} />
          </div>
        )}
      </details>

      <div className="flex flex-col gap-3 rounded-leaf border border-mist-200 bg-white p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <form role="search" onSubmit={onSearch} className="flex flex-1 items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="rq-search" className={smallLabel}>
              Ara
            </label>
            <input
              id="rq-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Başlık veya mesaj metni"
              className={`${control} w-full`}
            />
          </div>
          <Button type="submit" variant="secondary">
            Bul
          </Button>
        </form>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex">
          <Select id="rq-city" label="Şehir" value={query.city ?? ""} onChange={(v) => applyQuery({ ...query, city: v || undefined, page: 1 })}>
            <option value="">Tümü</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select
            id="rq-source"
            label="Kaynak"
            value={query.source ?? ""}
            onChange={(v) => applyQuery({ ...query, source: (v || undefined) as ReviewQuery["source"], page: 1 })}
          >
            <option value="">Tümü</option>
            <option value="group">Ortak gruplar</option>
            <option value="personal">Kişisel</option>
          </Select>
          <Select
            id="rq-score"
            label="Skor"
            value={query.score ?? ""}
            onChange={(v) => applyQuery({ ...query, score: (v || undefined) as ReviewQuery["score"], page: 1 })}
          >
            <option value="">Tümü</option>
            <option value="low">Düşük (&lt;0,50)</option>
            <option value="mid">Orta (0,50–0,69)</option>
            <option value="high">Yüksek (≥0,70)</option>
          </Select>
          <Select
            id="rq-order"
            label="Sırala"
            value={query.order}
            onChange={(v) => applyQuery({ ...query, order: v as ReviewQuery["order"], page: 1 })}
          >
            <option value="oldest">Eski önce</option>
            <option value="newest">Yeni önce</option>
          </Select>
        </div>
      </div>

      <p role="status" className="text-sm font-medium text-moss-700 empty:hidden">
        {notice ?? ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`${mobileView === "review" ? "hidden" : "flex"} min-w-0 flex-col gap-3 lg:flex`}>
          {list.status === "loading" && (
            <ul aria-busy="true" aria-label="Kuyruk yükleniyor" className="flex animate-pulse flex-col gap-2 motion-reduce:animate-none">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="h-20 rounded-xl border border-mist-200 bg-white" />
              ))}
            </ul>
          )}

          {list.status === "error" && (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-leaf border border-mist-200 bg-white p-5">
              <p className="font-medium">Kuyruk yüklenemedi.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setList({ status: "loading" });
                  void load(query);
                }}
              >
                Tekrar dene
              </Button>
            </div>
          )}

          {list.status === "ready" && items.length === 0 && (
            <div className="flex flex-col items-start gap-3 rounded-leaf border border-mist-200 bg-white p-5">
              <p className="font-medium">{filtered ? "Bu filtrelere uyan ilan yok" : "İncelenecek ilan yok"}</p>
              {filtered && (
                <Button variant="secondary" onClick={clearFilters}>
                  Filtreleri temizle
                </Button>
              )}
            </div>
          )}

          {items.length > 0 && (
            <>
              <ul aria-label="Kuyruk" className="flex flex-col gap-2">
                {items.map((item) => {
                  const active = item.id === selectedId;
                  const band = BAND[scoreBand(item.score)];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => select(item)}
                        className={`flex w-full flex-col gap-1 rounded-xl border bg-white p-3 text-left focus-visible:outline-2 focus-visible:outline-terracotta-600 ${
                          active ? "border-terracotta-600 ring-1 ring-terracotta-600" : "border-mist-200 hover:border-slate-500/40"
                        }`}
                      >
                        <span className="line-clamp-1 text-sm font-medium">
                          {item.parsed.title || item.rawText.split("\n")[0]}
                        </span>
                        <span className="line-clamp-1 text-xs text-slate-500">
                          {item.owner ? `Kişisel — ${item.owner.companyName}` : (item.sourceGroup ?? "Bilinmeyen grup")}
                        </span>
                        <span className="flex items-center justify-between gap-2 text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-semibold ${band.className}`}>{scoreText(item.score)}</span>
                          <span className="text-slate-500">{ago(item.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between gap-2 text-sm">
                <Button
                  variant="secondary"
                  aria-label="Önceki sayfa"
                  disabled={query.page <= 1}
                  onClick={() => applyQuery({ ...query, page: query.page - 1 })}
                >
                  ←
                </Button>
                {range && <span className="text-slate-500 tabular-nums">{range}</span>}
                <Button
                  variant="secondary"
                  aria-label="Sonraki sayfa"
                  disabled={list.status !== "ready" || list.page * list.pageSize >= list.total}
                  onClick={() => applyQuery({ ...query, page: query.page + 1 })}
                >
                  →
                </Button>
              </div>
            </>
          )}
        </div>

        <section
          ref={paneRef}
          aria-label="İnceleme"
          className={`${mobileView === "list" ? "hidden" : "flex"} min-w-0 flex-col rounded-leaf border border-mist-200 bg-white lg:flex`}
        >
          {selected && form ? (
            <>
              <div className="flex flex-col gap-5 p-4 sm:p-6">
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  className="self-start text-sm font-medium text-terracotta-700 hover:underline lg:hidden"
                >
                  ← Kuyruğa dön
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {selected.owner ? `Kişisel — ${selected.owner.companyName}` : (selected.sourceGroup ?? "Bilinmeyen grup")} ·{" "}
                    {ago(selected.createdAt)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${BAND[scoreBand(selected.score)].className}`}>
                    {scoreText(selected.score)}
                  </span>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div>
                    <h2 className="text-xs font-medium text-slate-500">WhatsApp mesajı</h2>
                    <p className="mt-2 rounded-leaf rounded-tl-sm bg-[#e7f6e9] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-900">
                      {selected.rawText}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xs font-medium text-slate-500">Ayrıştırılan bilgiler</h2>
                    {field("title", "Başlık")}
                    <div className="grid grid-cols-[1fr_96px] gap-3">
                      {field("price", "Fiyat", { inputMode: "numeric" })}
                      <div className="flex flex-col gap-1">
                        <label htmlFor="rv-currency" className="text-sm font-medium">
                          Para birimi
                        </label>
                        <select
                          id="rv-currency"
                          value={form.currency}
                          onChange={set("currency")}
                          disabled={pending !== null}
                          className={`${control} py-2.5`}
                        >
                          <option>TRY</option>
                          <option>USD</option>
                          <option>EUR</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {field("rooms", "Oda")}
                      {field("areaM2", "m²", { inputMode: "numeric" })}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {field("city", "Şehir")}
                      {field("district", "İlçe")}
                    </div>
                    {field("neighborhood", "Mahalle")}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="rv-description" className="text-sm font-medium">
                        Açıklama
                      </label>
                      <textarea
                        id="rv-description"
                        rows={3}
                        value={form.description}
                        onChange={set("description")}
                        disabled={pending !== null}
                        className={control}
                      />
                    </div>
                  </div>
                </div>
                {actionError && <Alert variant="error">{actionError}</Alert>}
              </div>
              <div className="sticky bottom-0 mt-auto flex gap-2 rounded-b-2xl border-t border-mist-200 bg-white/95 p-4 backdrop-blur sm:px-6">
                <Button className="flex-1 sm:flex-none" isPending={pending === "approve"} disabled={pending !== null} onClick={approve}>
                  {pending === "approve" ? "Onaylanıyor…" : "Onayla"}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 border-brick-700 text-brick-700 sm:flex-none"
                  disabled={pending !== null}
                  onClick={openReject}
                >
                  Reddet
                </Button>
              </div>
            </>
          ) : (
            <p className="p-6 text-sm text-slate-500">
              {list.status === "loading" ? "Kuyruk yükleniyor…" : "İncelemek için kuyruktan bir ilan seçin."}
            </p>
          )}
        </section>
      </div>

      {rejecting && selected && (
        <ConfirmDialog
          title="İlanı reddet"
          confirmLabel="Reddet"
          tone="danger"
          pending={pending === "reject"}
          error={actionError}
          onClose={() => setRejecting(false)}
          onConfirm={() => void run("reject", () => service.reject(selected.id, reason, note.trim() || undefined))}
        >
          <fieldset className="mt-2 flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink-900">Gerekçe</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm text-ink-900">
                <input
                  type="radio"
                  name="reject-reason"
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="h-4 w-4 accent-brick-700"
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div className="mt-4 flex flex-col gap-1">
            <label htmlFor="reject-note" className="text-sm font-medium text-ink-900">
              Not (isteğe bağlı)
            </label>
            <textarea id="reject-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={control} />
          </div>
        </ConfirmDialog>
      )}
    </main>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={smallLabel}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={control}>
        {children}
      </select>
    </div>
  );
}

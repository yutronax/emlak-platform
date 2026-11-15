"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import type { Profile, ProfileService } from "@/lib/profile-ui/types";

import { CompanySection, ContactSection, NotificationsSection, SecuritySection } from "./sections";
import { TABS, type TabId } from "./tabs";

type ProfileViewProps = {
  service: ProfileService;
  initialTab?: TabId;
  navigate?: (url: string) => void;
};

const UNSAVED = "Kaydedilmemiş değişiklikler var; sekmeyi değiştirirseniz kaybolacak. Devam edilsin mi?";

// Tamamlanma: 5 madde, her biri %20.
function completionPercent(p: Profile): number {
  const filled = [p.companyName, p.contactName, p.city, p.logoUrl, p.whatsappPhone].filter(
    (v) => typeof v === "string" && v.trim() !== "",
  ).length;
  return filled * 20;
}

export function ProfileView({
  service,
  initialTab = "sirket",
  navigate = (url) => window.location.assign(url),
}: ProfileViewProps) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; profile: Profile }>({
    status: "loading",
  });
  const [tab, setTab] = useState<TabId>(initialTab);
  const dirty = useRef(false);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  // Durum yalnız servis yanıtında güncellenir; "loading"e geçişi çağıran taraf yapar.
  const load = useCallback(
    () =>
      service.load().then(
        (res) => setState(res.status === "ok" ? { status: "ready", profile: res.profile } : { status: "error" }),
        () => setState({ status: "error" }),
      ),
    [service],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function retry() {
    setState({ status: "loading" });
    void load();
  }

  function selectTab(next: TabId, focus = false) {
    if (next === tab) return;
    if (dirty.current && !window.confirm(UNSAVED)) return;
    dirty.current = false;
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
    if (focus) tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex((t) => t.id === tab);
    const last = TABS.length - 1;
    const target = {
      ArrowRight: i === last ? 0 : i + 1,
      ArrowDown: i === last ? 0 : i + 1,
      ArrowLeft: i === 0 ? last : i - 1,
      ArrowUp: i === 0 ? last : i - 1,
      Home: 0,
      End: last,
    }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    selectTab(TABS[target].id, true);
  }

  const profile = state.status === "ready" ? state.profile : null;
  const onSaved = (p: Profile) => setState({ status: "ready", profile: p });
  const onDirty = (d: boolean) => {
    dirty.current = d;
  };

  return (
    <main className="min-h-[70vh] bg-cream-50 text-ink-900">
      <header className="bg-ink-900 text-fog-50">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6 md:py-8">
          <div className="flex min-w-0 items-center gap-4">
            {profile &&
              (profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob/imzalı URL), optimizasyon gereksiz
                <img
                  src={profile.logoUrl}
                  alt="Şirket logosu"
                  className="h-14 w-14 shrink-0 rounded-xl border border-white/15 object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-ink-800 font-display text-lg font-bold text-fog-50"
                >
                  {profile.companyName.trim().slice(0, 2).toLocaleUpperCase("tr-TR")}
                </span>
              ))}
            <div className="min-w-0">
              <p className="font-body text-xs font-medium tracking-[0.2em] text-terracotta-600 uppercase">Profilim</p>
              <h1
                title={profile?.companyName || undefined}
                className="mt-2 font-display text-2xl leading-tight font-normal tracking-[-0.03em] break-words line-clamp-2 md:line-clamp-none md:truncate md:text-[1.75rem]"
              >
                {profile?.companyName || "Profil"}
              </h1>
              {profile && (
                <p className="mt-1 truncate font-body text-sm text-fog-50/70">
                  {[profile.contactName, profile.city].filter(Boolean).join(" · ")}
                </p>
              )}
              {profile && <p className="font-body text-sm text-fog-50/70 break-all">{profile.email}</p>}
            </div>
          </div>
          {profile && (
            <div className="font-body md:w-56 md:shrink-0">
              <div className="flex items-center justify-between text-xs text-fog-50/80">
                <span>Profil tamamlanma</span>
                <span>{completionPercent(profile) === 100 ? "Profil tamam" : `%${completionPercent(profile)}`}</span>
              </div>
              <div
                role="progressbar"
                aria-label="Profil tamamlanma"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completionPercent(profile)}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className="h-full rounded-full bg-terracotta-600 transition-[width] motion-reduce:transition-none"
                  style={{ width: `${completionPercent(profile)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:px-6 md:py-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <div
          role="tablist"
          aria-label="Profil bölümleri"
          aria-orientation="vertical"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 font-body lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {TABS.map((t) => {
            const selected = t.id === tab;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.id)}
                onKeyDown={onTabKeyDown}
                className={`shrink-0 rounded-md border-b-2 px-3 py-2 text-left text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-terracotta-600 lg:border-b-0 lg:border-l-2 ${
                  selected
                    ? "border-terracotta-600 bg-white font-semibold text-ink-900"
                    : "border-transparent text-slate-500 hover:bg-white/60 hover:text-ink-900"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <section
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          aria-busy={state.status === "loading" ? "true" : undefined}
          className="min-w-0 rounded-leaf border border-mist-200 bg-white p-5 font-body sm:p-8"
        >
          {state.status === "loading" && (
            <div className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
              <div className="h-6 w-40 rounded bg-mist-200" />
              <div className="h-10 rounded bg-mist-200/70" />
              <div className="h-10 rounded bg-mist-200/70" />
              <div className="h-10 w-2/3 rounded bg-mist-200/70" />
            </div>
          )}
          {state.status === "error" && (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="font-medium">Profil yüklenemedi.</p>
              <p className="text-sm text-slate-500">Bağlantınızı kontrol edip tekrar deneyin.</p>
              <Button variant="secondary" onClick={retry}>
                Tekrar dene
              </Button>
            </div>
          )}
          {profile && (
            <>
              {tab === "sirket" && (
                <CompanySection profile={profile} service={service} onSaved={onSaved} onDirty={onDirty} />
              )}
              {tab === "iletisim" && (
                <ContactSection profile={profile} service={service} onSaved={onSaved} onDirty={onDirty} />
              )}
              {tab === "guvenlik" && (
                <SecuritySection
                  profile={profile}
                  service={service}
                  onSaved={onSaved}
                  onDirty={onDirty}
                  navigate={navigate}
                />
              )}
              {tab === "bildirimler" && (
                <NotificationsSection profile={profile} service={service} onSaved={onSaved} onDirty={onDirty} />
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

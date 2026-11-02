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
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
          <p className="font-body text-xs font-medium tracking-[0.2em] text-terracotta-600 uppercase">Profilim</p>
          <h1 className="mt-2 font-display text-2xl leading-tight font-normal tracking-[-0.03em] text-pretty break-words md:text-[1.75rem]">
            {profile?.companyName || "Profil"}
          </h1>
          {profile && <p className="mt-1 font-body text-sm text-fog-50/70 break-all">{profile.email}</p>}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:px-6 md:py-10 lg:grid-cols-[200px_minmax(0,640px)] lg:gap-10">
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

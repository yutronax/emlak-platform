"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";

import { signOut } from "@/app/auth/actions";
import { isActivePath } from "@/lib/nav/is-active-path";

export type HeaderSection = { href: string; label: string; exact?: boolean };

const AGENT_SECTIONS: HeaderSection[] = [
  { href: "/agent/dashboard", label: "İlanlar" },
  { href: "/agent/whatsapp", label: "WhatsApp" },
  { href: "/agent/videos", label: "Videolar" },
];

type AppHeaderProps = {
  email: string | null;
  // Profil servisi yoksa /account/profile 404 döner; bağlantı gösterilmez.
  showProfile: boolean;
  // Varsayılanlar emlakçı paneli; admin alanı kendi bölümlerini verir.
  sections?: HeaderSection[];
  navLabel?: string;
  homeHref?: string;
};

const itemClass =
  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink-900 hover:bg-fog-50 focus-visible:bg-fog-50 focus-visible:outline-2 focus-visible:outline-terracotta-600";

function LogoutItem({ onKeyDown }: { onKeyDown: (e: KeyboardEvent<HTMLElement>) => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="menuitem"
      tabIndex={-1}
      disabled={pending}
      onKeyDown={onKeyDown}
      className={`${itemClass} text-brick-700 disabled:opacity-60`}
    >
      {pending ? "Çıkış yapılıyor…" : "Çıkış yap"}
    </button>
  );
}

export function AppHeader({
  email,
  showProfile,
  sections = AGENT_SECTIONS,
  navLabel = "Panel bölümleri",
  homeHref = "/agent/dashboard",
}: AppHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Sayfa değişince menü kapanır.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onItemKeyDown(e: KeyboardEvent<HTMLElement>) {
    const list = items();
    const i = list.indexOf(e.currentTarget);
    const next = { ArrowDown: (i + 1) % list.length, ArrowUp: (i - 1 + list.length) % list.length, Home: 0, End: list.length - 1 }[
      e.key
    ];
    if (next !== undefined) {
      e.preventDefault();
      list[next]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  }

  const initial = email ? email.trim().charAt(0).toLocaleUpperCase("tr-TR") : "?";

  return (
    <header className="border-b border-white/10 bg-ink-900 text-fog-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 md:h-14 md:flex-nowrap md:px-6">
        <Link
          href={homeHref}
          className="flex h-14 items-center font-display text-lg font-normal tracking-[-0.03em] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-terracotta-600 md:h-auto"
        >
          Emlak Platformu
        </Link>

        <nav
          aria-label={navLabel}
          style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}
          className="order-last -mx-4 grid basis-[calc(100%+2rem)] border-t border-white/10 md:order-none md:mx-0 md:flex md:basis-auto md:self-stretch md:border-t-0"
        >
          {sections.map((s) => {
            const active = s.exact ? pathname === s.href : isActivePath(pathname, s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center justify-center border-b-2 px-3 font-body text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta-600 md:h-full ${
                  active
                    ? "border-terracotta-600 font-semibold text-fog-50"
                    : "border-transparent text-fog-50/70 hover:text-fog-50"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>

        <div ref={wrapRef} className="relative ml-auto">
          <button
            ref={triggerRef}
            type="button"
            aria-label={`Hesap menüsü${email ? ` (${email})` : ""}`}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? "account-menu" : undefined}
            onClick={() => setOpen((o) => !o)}
            onKeyDown={onTriggerKeyDown}
            className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1 font-body text-sm text-fog-50/80 hover:text-fog-50 focus-visible:outline-2 focus-visible:outline-terracotta-600 md:pl-3"
          >
            <span className="hidden max-w-[220px] truncate md:inline">{email}</span>
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta-600 font-display text-sm font-bold text-white"
            >
              {initial}
            </span>
          </button>

          {open && (
            <div
              ref={menuRef}
              id="account-menu"
              role="menu"
              aria-label="Hesap"
              className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-mist-200 bg-white p-1.5 font-body text-ink-900 shadow-[0_16px_40px_-12px_rgb(16_37_63/0.35)]"
            >
              <p className="truncate px-3 pt-2 pb-2 text-xs text-slate-500">{email ?? "Hesabım"}</p>
              <div className="mb-1 h-px bg-mist-200" />
              {showProfile && (
                <Link href="/account/profile" role="menuitem" tabIndex={-1} onKeyDown={onItemKeyDown} className={itemClass}>
                  Profil
                </Link>
              )}
              <Link
                href="/account/subscription"
                role="menuitem"
                tabIndex={-1}
                onKeyDown={onItemKeyDown}
                className={itemClass}
              >
                Abonelik
              </Link>
              <div className="my-1 h-px bg-mist-200" />
              <form action={signOut}>
                <LogoutItem onKeyDown={onItemKeyDown} />
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

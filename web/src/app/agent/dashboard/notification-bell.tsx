"use client";

import { useEffect, useState } from "react";

import { formatBadge } from "@/lib/listings-feed/format";

import { markListingsSeen, refreshUnreadCount } from "./actions";

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const result = await refreshUnreadCount();
        if (result.ok) setCount(result.count);
      } catch {
        // Zaman aşımı/ağ hatası: son değer korunur.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  async function handleClick() {
    if (count === 0) return;
    try {
      const result = await markListingsSeen();
      if (result.ok) setCount(0);
    } catch {
      // Başarısız görüldü işareti: rozet kalır.
    }
  }

  const badge = formatBadge(count);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={badge ? `${badge} yeni ilan` : undefined}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-900 hover:bg-mist-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 min-w-5 rounded-full bg-ink-900 px-1.5 text-center text-xs font-semibold leading-5 text-white"
        >
          {badge}
        </span>
      ) : (
        <span className="sr-only">Bildirimler</span>
      )}
    </button>
  );
}

"use client";

import { useEffect, useRef } from "react";

// Vitrin kartı önizlemesi: fare kartın üstüne gelince (ya da karttaki bağlantı klavyeyle odaklanınca)
// sessiz video baştan oynar; ayrılınca durur, başa sarılır ve poster geri gelir. Hareket azaltma
// tercihi açıksa video hiç başlamaz. Olaylar kartın kendisinden (en yakın <article>) dinlenir: kartı
// kaplayan bağlantı katmanı fareyi videodan önce yakalar.
export function HoverVideo({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    const card = video?.closest("article");
    if (!video || !card) return;

    const start = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      video.currentTime = 0;
      // Tarayıcı oynatmayı reddederse (ör. veri tasarrufu) poster kalır.
      video.play().catch(() => {});
    };
    const stop = () => {
      video.pause();
      // load() posteri geri getirir ve başa sarar; aksi halde son kare ekranda kalır.
      video.load();
    };

    card.addEventListener("pointerenter", start);
    card.addEventListener("pointerleave", stop);
    card.addEventListener("focusin", start);
    card.addEventListener("focusout", stop);
    return () => {
      card.removeEventListener("pointerenter", start);
      card.removeEventListener("pointerleave", stop);
      card.removeEventListener("focusin", start);
      card.removeEventListener("focusout", stop);
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="none"
      tabIndex={-1}
      className="h-full w-full object-cover"
    />
  );
}

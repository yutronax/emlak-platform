"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ListingDetailInfo = {
  price: string;
  hasPrice: boolean;
  title: string;
  rooms: string | null;
  area: string | null;
  location: string;
  arrival: string;
  group: string;
  own: boolean;
  videoHref: string;
};

// Stitch önerisi: ilan detay penceresi. Yeni veri gerektirmez; kartın sunucuda biçimlenmiş bilgilerini
// büyük ve okunaklı gösterir, tek eylem olarak video siparişine götürür. Native <dialog>: odak hapsi,
// Escape ile kapanma ve arka planın etkisizleşmesi tarayıcıdan gelir.
export function ListingDetail({ info }: { info: ListingDetailInfo }) {
  const ref = useRef<HTMLDialogElement>(null);
  // İçerik yalnız açıkken render edilir: kapalı pencere kartın metinlerini DOM'da ikinci kez taşımasın.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal?.();
  }, [open]);

  const rows: [string, string][] = [
    ["Konum", info.location],
    ["Geliş", info.arrival],
    ...(info.rooms ? ([["Oda", info.rooms]] as [string, string][]) : []),
    ...(info.area ? ([["Alan", info.area]] as [string, string][]) : []),
    ["Kaynak grup", info.group],
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 shrink-0 rounded-lg border border-panel-line bg-panel-surface px-4 text-sm font-medium text-ink-900 hover:bg-panel-muted"
      >
        Ayrıntılar
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-label={`İlan ayrıntıları: ${info.title}`}
        onClick={(e) => {
          // Pencere dışına (backdrop) tıklayınca kapanır.
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-panel-line bg-panel-surface p-0 text-ink-900 shadow-[0_24px_64px_rgb(38_51_45/24%)] backdrop:bg-panel-deep/50 backdrop:backdrop-blur-sm"
      >
        {open && (
        <>
        <div aria-hidden="true" className="panel-placeholder h-36 border-b border-panel-line" />
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {info.own && (
                <span className="mb-2 inline-flex rounded-full bg-terracotta-600/10 px-2 py-1 text-[0.6875rem] font-medium text-terracotta-700">
                  Kendi grubun
                </span>
              )}
              <p className={info.hasPrice ? "font-display text-3xl tabular-nums" : "text-sm text-charcoal/70"}>
                {info.price}
              </p>
              <h2 className="mt-1 font-display text-xl leading-snug">{info.title}</h2>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Kapat"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-charcoal/70 hover:bg-panel-muted"
            >
              ×
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-panel-line bg-panel-line">
            {rows.map(([label, value], i) => (
              <div
                key={label}
                // Tek sayıda satırda son hücre boş kalmasın diye iki sütuna yayılır.
                className={`bg-panel-surface px-3 py-2.5 ${i === rows.length - 1 && rows.length % 2 === 1 ? "col-span-2" : ""}`}
              >
                <dt className="text-[0.6875rem] font-semibold tracking-[0.06em] text-charcoal/60 uppercase">{label}</dt>
                <dd className="mt-0.5 text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href={info.videoHref}
            className="flex min-h-11 items-center justify-center rounded-lg bg-terracotta-600 px-4 text-sm font-semibold text-white hover:bg-terracotta-700"
          >
            Bu ilan için 9:16 video sipariş et
          </Link>
        </div>
        </>
        )}
      </dialog>
    </>
  );
}

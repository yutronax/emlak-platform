import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
};

export default function GizlilikPage() {
  return (
    <main className="bg-cream-50 text-ink-900">
      <div className="mx-auto max-w-3xl px-6 py-16 font-body">
        <Alert variant="error">
          Taslak — bu metin henüz hukuki kontrolden geçmemiştir.
        </Alert>

        <h1 className="mt-10 font-display text-3xl font-normal tracking-[-0.03em]">Gizlilik Politikası</h1>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-normal tracking-[-0.03em]">Hangi verileri işliyoruz?</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-500">
            <li>Hesap bilgileri: e-posta adresiniz ve şirket adınız.</li>
            <li>Seçtiğiniz WhatsApp gruplarındaki ilan mesajları.</li>
            <li>Reklam videosu için yüklediğiniz fotoğraflar ve videolar.</li>
          </ul>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-normal tracking-[-0.03em]">Neden işliyoruz?</h2>
          <p className="text-slate-500">
            Verileri, ilanları size düzenli bir listede göstermek ve sizin için
            reklam videosu hazırlamak amacıyla işliyoruz.
          </p>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-normal tracking-[-0.03em]">Seçmediğiniz gruplar</h2>
          <p className="text-slate-500">
            Seçmediğiniz WhatsApp gruplarının mesajlarını saklamayız.
          </p>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-normal tracking-[-0.03em]">Verilerinizi silmek</h2>
          <p className="text-slate-500">
            Verilerinizin silinmesini istiyorsanız destek hattımıza WhatsApp
            üzerinden yazın:{" "}
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-terracotta-700 underline"
            >
              {SUPPORT_WHATSAPP_DISPLAY}
            </a>
          </p>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-normal tracking-[-0.03em]">Veri sorumlusu</h2>
          <p className="text-slate-500">[Şirket bilgileri eklenecek]</p>
        </section>
      </div>
    </main>
  );
}

import type { Metadata } from "next";

import { Alert } from "@/components/ui/alert";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Kullanım Şartları",
};

export default function KullanimSartlariPage() {
  return (
    <main className="bg-fog-50 text-ink-900">
      <div className="mx-auto max-w-3xl px-6 py-16 font-body">
        <Alert variant="error">
          Taslak — bu metin henüz hukuki kontrolden geçmemiştir.
        </Alert>

        <h1 className="mt-10 font-display text-3xl font-bold">Kullanım Şartları</h1>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Hizmetin kapsamı</h2>
          <p className="text-slate-500">
            Hizmet, WhatsApp gruplarınızdan gelen ilanların sitede düzenli ve
            filtrelenebilir bir listede gösterilmesini içerir. Reklam videosu
            ayrı ücretlendirilen bir ek hizmettir ve editörlerimiz tarafından
            hazırlanır.
          </p>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Deneme süresi</h2>
          <p className="text-slate-500">
            Ücretsiz deneme için kredi kartı bilgisi istenmez.
          </p>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Hesabınız</h2>
          <p className="text-slate-500">
            Hesabınızın güvenliğinden ve hesabınızla yapılan işlemlerden siz
            sorumlusunuz. Yüklediğiniz ilan bilgilerinin doğru olması sizin
            sorumluluğunuzdadır.
          </p>
        </section>

        <section className="mt-8 flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">Destek</h2>
          <p className="text-slate-500">
            Sorularınız için destek ekibimize WhatsApp üzerinden yazabilirsiniz:{" "}
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
          <h2 className="font-display text-xl font-semibold">Veri sorumlusu</h2>
          <p className="text-slate-500">[Şirket bilgileri eklenecek]</p>
        </section>
      </div>
    </main>
  );
}

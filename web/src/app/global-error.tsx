"use client";

import "./globals.css";

import { ErrorScreen } from "@/components/status/error-screen";

// Kök layout çöktüğünde onun yerine geçer: kendi <html>/<body>'si ve stilleri gerekir.
// Google fontları burada yüklenmez; sistem fontuna düşer.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Bir şeyler ters gitti · Emlak Platformu</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}

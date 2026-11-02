import { showcaseCities, showcaseGet, showcaseList } from "@/app/(marketing)/vitrin/actions";

import { createMockShowcaseService } from "./mock-service";
import type { ShowcaseService } from "./types";

// Sunucu aksiyonlarının sarmalayıcısı (istemciden de çağrılabilir).
export const realShowcaseService: ShowcaseService = {
  kind: "real",
  cities: () => showcaseCities(),
  list: (f, cursor) => showcaseList(f, cursor),
  get: (id) => showcaseGet(id),
};

// Varsayılan gerçek servis; mock yalnız dev'de bayrakla.
export function selectShowcaseService(env: {
  nodeEnv: string | undefined;
  mockFlag: string | undefined;
  delayMs?: number;
}): ShowcaseService {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Vitrin mock servisi production'da kullanılamaz.");
    return createMockShowcaseService(env.delayMs);
  }
  return realShowcaseService;
}

// Sunucu tarafı (sayfa ön-yüklemesi) yapay gecikme istemez.
export function getShowcaseService(opts: { delayMs?: number } = {}): ShowcaseService {
  return selectShowcaseService({
    nodeEnv: process.env.NODE_ENV,
    mockFlag: process.env.NEXT_PUBLIC_SHOWCASE_MOCK,
    delayMs: opts.delayMs,
  });
}

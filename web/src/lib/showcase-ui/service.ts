import { createMockShowcaseService } from "./mock-service";
import type { ShowcaseService } from "./types";

// Gerçek servis henüz yok → null: /vitrin* 404, ana sayfa önizlemesi gizli.
export function selectShowcaseService(env: {
  nodeEnv: string | undefined;
  mockFlag: string | undefined;
  delayMs?: number;
}): ShowcaseService | null {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Vitrin mock servisi production'da kullanılamaz.");
    return createMockShowcaseService(env.delayMs);
  }
  return null;
}

// Sunucu tarafı (sayfa ön-yüklemesi) yapay gecikme istemez.
export function getShowcaseService(opts: { delayMs?: number } = {}): ShowcaseService | null {
  return selectShowcaseService({
    nodeEnv: process.env.NODE_ENV,
    mockFlag: process.env.NEXT_PUBLIC_SHOWCASE_MOCK,
    delayMs: opts.delayMs,
  });
}

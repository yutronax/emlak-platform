import { mockProfileService } from "./mock-service";
import type { ProfileService } from "./types";

// Gerçek servis henüz yok (backend soruları: frontend_contract.md). null → sayfa gösterilmez.
export function selectProfileService(env: {
  nodeEnv: string | undefined;
  mockFlag: string | undefined;
}): ProfileService | null {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Profil mock servisi production'da kullanılamaz.");
    return mockProfileService;
  }
  return null;
}

export function getProfileService(): ProfileService | null {
  return selectProfileService({ nodeEnv: process.env.NODE_ENV, mockFlag: process.env.NEXT_PUBLIC_PROFILE_MOCK });
}

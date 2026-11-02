import { mockProfileService } from "./mock-service";
import { realProfileService } from "./real-service";
import type { ProfileService } from "./types";

// Varsayılan gerçek servis; mock yalnız dev'de bayrakla.
export function selectProfileService(env: {
  nodeEnv: string | undefined;
  mockFlag: string | undefined;
}): ProfileService {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Profil mock servisi production'da kullanılamaz.");
    return mockProfileService;
  }
  return realProfileService;
}

export function getProfileService(): ProfileService {
  return selectProfileService({ nodeEnv: process.env.NODE_ENV, mockFlag: process.env.NEXT_PUBLIC_PROFILE_MOCK });
}

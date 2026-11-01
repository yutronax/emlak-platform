import { mockAuthService } from "./mock-service";
import { serverActionService } from "./server-action-service";
import type { AuthService } from "./types";

export function selectAuthService(env: { nodeEnv: string | undefined; mockFlag: string | undefined }): AuthService {
  if (env.mockFlag === "1") {
    // Sahte veri production'a sessizce sızmasın.
    if (env.nodeEnv === "production") throw new Error("Auth mock servisi production'da kullanılamaz.");
    return mockAuthService;
  }
  return serverActionService;
}

export function getAuthService(): AuthService {
  return selectAuthService({
    nodeEnv: process.env.NODE_ENV,
    mockFlag: process.env.NEXT_PUBLIC_AUTH_MOCK,
  });
}

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Ödeme akışı testleri açık yolu doğrular; kapalı yol testlerde vi.stubEnv ile.
    env: { NEXT_PUBLIC_PAYMENTS_ENABLED: "1" },
  },
});

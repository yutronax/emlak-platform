import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // node_modules'ı bu ignores listesi ASLA dışarıda tutmuyor (eslint-config-next
  // + flat config kombinasyonunda bilinen bir davranış — global ignores dizin
  // taramasında node_modules'ı yine de tarıyor). Bu yüzden `npm run lint`
  // package.json'da "eslint src" olarak sınırlandırıldı, kök dizini taramıyor.
]);

export default eslintConfig;

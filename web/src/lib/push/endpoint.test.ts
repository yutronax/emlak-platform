import { describe, expect, it } from "vitest";

import { isAllowedPushEndpoint, isValidKey } from "./endpoint";

// AC-S2 — push endpoint allowlist (SSRF koruması). Yalnız https + bilinen push servisleri.
describe("isAllowedPushEndpoint (AC-S2)", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/x",
    "https://web.push.apple.com/x",
    "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])("kabul eder: %s", (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/x", // https değil
    "https://fcm.googleapis.com.evil.com/x", // alt alan taklidi (sonek)
    "https://evil.com/x", // bilinmeyen host
    "http://169.254.169.254/latest", // metadata servisi (SSRF)
    "https://169.254.169.254/latest", // metadata, https ile de reddedilir
    "https://fcm.googleapis.com:443/x", // açık port (DB CHECK ile aynı küme)
    "https://fcm.googleapis.com?x=1", // host'tan hemen sonra sorgu
    "https://user@fcm.googleapis.com/x", // userinfo
    "https://push.apple.com.evil.com/", // sonek taklidi
    "https://evilpush.apple.com/x", // *.push.apple.com değil
    "javascript:alert(1)", // şema
    "", // boş
    "::not a url::", // çöp
  ])("reddeder: %j", (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

// p256dh / auth doğrulaması: base64url, 1–200 karakter.
describe("isValidKey (p256dh / auth)", () => {
  it.each([
    "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
    "tBHItJI5svbpez7KI4CCXg",
    "a", // 1 karakter sınırı
    "a".repeat(200), // üst sınır dahil
  ])("base64url kabul eder: %s", (value) => {
    expect(isValidKey(value)).toBe(true);
  });

  it.each([
    "a+b", // + base64 (standart), base64url değil
    "a/b", // / base64 (standart)
    "a b", // boşluk
    "abc=", // padding (base64url unpadded)
    "a".repeat(201), // üst sınır aşımı
    "", // boş
  ])("reddeder: %j", (value) => {
    expect(isValidKey(value)).toBe(false);
  });

  it("string olmayan girdiyi reddeder", () => {
    expect(isValidKey(null as unknown as string)).toBe(false);
    expect(isValidKey(undefined as unknown as string)).toBe(false);
  });
});

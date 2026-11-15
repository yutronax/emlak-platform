import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isPwnedPassword } from "./pwnedPassword";

const sha1 = (s: string) => createHash("sha1").update(s, "utf8").digest("hex").toUpperCase();

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("isPwnedPassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("yalnız karmanın ilk 5 karakterini gönderir, parolayı göndermez", async () => {
    const hash = sha1("gizliParola1");
    const fetchMock = mockFetch(async () => new Response("00000:1\n"));
    await isPwnedPassword("gizliParola1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    expect(url).not.toContain("gizliParola1");
    expect(url).not.toContain(hash.slice(5));
    expect((init?.headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });

  it("sonek listede sayıyla varsa true döner", async () => {
    const hash = sha1("password123");
    mockFetch(async () => new Response(`AAAAA:3\r\n${hash.slice(5)}:251682\r\nBBBBB:1`));
    await expect(isPwnedPassword("password123")).resolves.toBe(true);
  });

  it("sonek listede yoksa false döner", async () => {
    mockFetch(async () => new Response("AAAAA:3\r\nBBBBB:1"));
    await expect(isPwnedPassword("x9-benzersiz-Parola!")).resolves.toBe(false);
  });

  it("padding satırı (sayı 0) eşleşme sayılmaz", async () => {
    const hash = sha1("padTest1");
    mockFetch(async () => new Response(`${hash.slice(5)}:0`));
    await expect(isPwnedPassword("padTest1")).resolves.toBe(false);
  });

  it("servis 5xx dönerse false döner (engellemez) ve log yazar", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(async () => new Response("", { status: 503 }));
    await expect(isPwnedPassword("herhangi1")).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith("pwned_password_check_unavailable", { status: 503 });
  });

  it("ağ hatası/zaman aşımında false döner ve log parolayı içermez", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(async () => {
      throw new Error("timeout");
    });
    await expect(isPwnedPassword("herhangi1")).resolves.toBe(false);
    expect(warn).toHaveBeenCalledWith("pwned_password_check_unavailable", { status: "network" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("herhangi1");
  });
});

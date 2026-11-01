import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(marketing)/login/actions", () => ({ login: vi.fn() }));
vi.mock("@/app/(marketing)/signup/actions", () => ({ signup: vi.fn() }));

import { login } from "@/app/(marketing)/login/actions";
import { signup } from "@/app/(marketing)/signup/actions";

import { selectAuthService } from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

describe("selectAuthService", () => {
  it("bayrak yoksa gerçek adaptörü seçer (Google kapalı)", () => {
    const s = selectAuthService({ nodeEnv: "development", mockFlag: undefined });
    expect(s.kind).toBe("server-action");
    expect(s.capabilities.google).toBe(false);
  });

  it("dev'de açık bayrakla mock seçilir", () => {
    const s = selectAuthService({ nodeEnv: "development", mockFlag: "1" });
    expect(s.kind).toBe("mock");
    expect(s.capabilities.google).toBe(true);
  });

  it("production'da mock bayrağı sessizce yok sayılmaz, hata fırlatır", () => {
    expect(() => selectAuthService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
  });

  it("production'da bayrak yoksa gerçek adaptör", () => {
    expect(selectAuthService({ nodeEnv: "production", mockFlag: undefined }).kind).toBe("server-action");
  });
});

describe("server-action adaptörü", () => {
  const service = () => selectAuthService({ nodeEnv: "test", mockFlag: undefined });

  it("login hatası invalid_credentials ve sunucu metniyle döner", async () => {
    vi.mocked(login).mockResolvedValue({ error: "Giriş başarısız: e-posta veya şifre hatalı." });
    const r = await service().signIn({ email: "a@b.co", password: "x" });
    expect(r).toEqual({
      status: "error",
      code: "invalid_credentials",
      message: "Giriş başarısız: e-posta veya şifre hatalı.",
    });
  });

  it("login ağ hatasını network'e çevirir", async () => {
    vi.mocked(login).mockRejectedValue(new TypeError("Failed to fetch"));
    const r = await service().signIn({ email: "a@b.co", password: "x" });
    expect(r).toMatchObject({ status: "error", code: "network" });
  });

  it("signup genel mesajı check_email'e çevirir (e-posta varlığı açığa çıkmaz)", async () => {
    vi.mocked(signup).mockResolvedValue({ message: "Kayıt alındı; ..." });
    const r = await service().signUp({
      email: "a@b.co",
      password: "Sifre123",
      companyName: "Acme",
      phone: "+905321234567",
      termsAccepted: true,
    });
    expect(r).toEqual({ status: "check_email", email: "a@b.co" });
    const fd = vi.mocked(signup).mock.calls[0][0];
    expect(fd.get("company_name")).toBe("Acme");
    expect(fd.get("phone")).toBe("+905321234567");
    expect(fd.get("terms")).toBe("on");
  });

  it("signup hatasını mesajıyla döner", async () => {
    vi.mocked(signup).mockResolvedValue({ error: "Şirket adı gerekli (2-100 karakter)." });
    const r = await service().signUp({
      email: "a@b.co",
      password: "Sifre123",
      companyName: "A",
      phone: "+905321234567",
      termsAccepted: true,
    });
    expect(r).toMatchObject({ status: "error", code: "unknown", message: "Şirket adı gerekli (2-100 karakter)." });
  });
});

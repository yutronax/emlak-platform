// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Profile, ProfileService } from "@/lib/profile-ui/types";

import { ProfileView } from "./profile-view";

const PROFILE: Profile = {
  companyName: "Acme Emlak",
  contactName: "Ayşe Yılmaz",
  city: "İzmir",
  district: "Karşıyaka",
  logoUrl: null,
  email: "ayse@acme.com",
  pendingEmail: null,
  whatsappPhone: "+905321234567",
  notifications: { newListingPush: true, newListingEmail: false, videoOrderEmail: true, weeklySummaryEmail: false },
};

function makeService(overrides: Partial<ProfileService> = {}): ProfileService {
  const ok = (p: Partial<Profile> = {}) => Promise.resolve({ status: "ok" as const, profile: { ...PROFILE, ...p } });
  return {
    kind: "mock",
    load: vi.fn(() => ok()),
    updateCompany: vi.fn((i) => ok(i)),
    uploadLogo: vi.fn(() => ok({ logoUrl: "blob:logo" })),
    removeLogo: vi.fn(() => ok({ logoUrl: null })),
    updateWhatsapp: vi.fn((phone) => ok({ whatsappPhone: phone })),
    requestEmailChange: vi.fn((e) => ok({ pendingEmail: e })),
    changePassword: vi.fn(() => ok()),
    updateNotifications: vi.fn((n) => ok({ notifications: n })),
    signOut: vi.fn(() => Promise.resolve({ status: "ok" as const, redirectTo: "/login" })),
    ...overrides,
  };
}

async function renderView(service = makeService(), initialTab?: "sirket" | "iletisim" | "guvenlik" | "bildirimler") {
  const navigate = vi.fn();
  render(<ProfileView service={service} initialTab={initialTab} navigate={navigate} />);
  await screen.findByRole("tabpanel");
  await waitFor(() => expect(screen.getByRole("tabpanel")).not.toHaveAttribute("aria-busy", "true"));
  return { service, navigate };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProfileView — yükleme", () => {
  it("yüklenirken iskelet aria-busy gösterir, sonra şirket formu dolu gelir", async () => {
    type LoadResult = Awaited<ReturnType<ProfileService["load"]>>;
    let resolve!: (v: LoadResult) => void;
    const service = makeService({ load: vi.fn(() => new Promise<LoadResult>((r) => (resolve = r))) });
    render(<ProfileView service={service} navigate={vi.fn()} />);

    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-busy", "true");
    await act(async () => resolve({ status: "ok", profile: PROFILE }));

    expect(screen.getByLabelText("Şirket adı")).toHaveValue("Acme Emlak");
    expect(screen.getByRole("heading", { level: 1, name: "Acme Emlak" })).toBeInTheDocument();
  });

  it("yükleme hatasında boş form yerine hata + Tekrar dene gösterir", async () => {
    const load = vi
      .fn<ProfileService["load"]>()
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce({ status: "ok", profile: PROFILE });
    render(<ProfileView service={makeService({ load })} navigate={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Profil yüklenemedi");
    expect(screen.queryByLabelText("Şirket adı")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByLabelText("Şirket adı")).toHaveValue("Acme Emlak");
  });
});

describe("ProfileView — sekmeler", () => {
  it("dört sekme tablist içinde; aktif sekme aria-selected", async () => {
    await renderView();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Şirket", "İletişim", "Güvenlik", "Bildirimler"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("initialTab ile açılır", async () => {
    await renderView(makeService(), "guvenlik");

    expect(screen.getByRole("tab", { name: "Güvenlik" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Mevcut şifre")).toBeInTheDocument();
  });

  it("ok tuşuyla sonraki sekmeye geçer ve URL'yi günceller", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    await renderView();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Şirket" }), { key: "ArrowRight" });

    const contact = screen.getByRole("tab", { name: "İletişim" });
    expect(contact).toHaveAttribute("aria-selected", "true");
    expect(contact).toHaveFocus();
    expect(String(replace.mock.calls.at(-1)?.[2])).toContain("tab=iletisim");
  });

  it("kaydedilmemiş değişiklikle sekme değiştirirken onay sorar; reddedilirse kalır", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await renderView();

    fireEvent.change(screen.getByLabelText("Şirket adı"), { target: { value: "Yeni Ad" } });
    fireEvent.click(screen.getByRole("tab", { name: "Güvenlik" }));

    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Şirket" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Şirket adı")).toHaveValue("Yeni Ad");
  });
});

describe("ProfileView — Şirket", () => {
  it("değişiklik yokken Kaydet pasif; değişince aktif; kaydedince 'Kaydedildi'", async () => {
    const { service } = await renderView();

    const save = screen.getByRole("button", { name: "Kaydet" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Yetkili adı"), { target: { value: "Mehmet Kaya" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(await screen.findByText("Kaydedildi")).toBeInTheDocument();
    expect(service.updateCompany).toHaveBeenCalledWith({
      companyName: "Acme Emlak",
      contactName: "Mehmet Kaya",
      city: "İzmir",
      district: "Karşıyaka",
    });
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled();
  });

  it("istemci doğrulaması servisi çağırmaz ve hatayı alana bağlar", async () => {
    const { service } = await renderView();

    fireEvent.change(screen.getByLabelText("Şirket adı"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    const input = screen.getByLabelText("Şirket adı");
    expect(await screen.findByText("Şirket adını girin (2-100 karakter).")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    expect(service.updateCompany).not.toHaveBeenCalled();
  });

  it("sunucu hatasında alert gösterir, girilen değer korunur", async () => {
    await renderView(
      makeService({ updateCompany: vi.fn(() => Promise.resolve({ status: "error" as const, code: "network" as const })) }),
    );

    fireEvent.change(screen.getByLabelText("Yetkili adı"), { target: { value: "Mehmet Kaya" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı sorunu, tekrar deneyin.");
    expect(screen.getByLabelText("Yetkili adı")).toHaveValue("Mehmet Kaya");
  });

  it("2 MB üstü logo yüklenmeden reddedilir", async () => {
    const { service } = await renderView();

    const big = new File(["x"], "logo.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Logo yükle"), { target: { files: [big] } });

    expect(await screen.findByText("Logo en fazla 2 MB olabilir.")).toBeInTheDocument();
    expect(service.uploadLogo).not.toHaveBeenCalled();
  });

  it("geçerli logo yüklenince önizleme ve Kaldır görünür", async () => {
    const { service } = await renderView();

    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Logo yükle"), { target: { files: [file] } });

    expect(await screen.findByRole("img", { name: "Şirket logosu" })).toHaveAttribute("src", "blob:logo");
    expect(service.uploadLogo).toHaveBeenCalledWith(file);
    expect(screen.getByRole("button", { name: "Logoyu kaldır" })).toBeInTheDocument();
  });
});

describe("ProfileView — İletişim", () => {
  it("WhatsApp numarası biçimli gösterilir, normalize edilerek kaydedilir", async () => {
    const { service } = await renderView(makeService(), "iletisim");

    const phone = screen.getByLabelText("WhatsApp numarası");
    expect(phone).toHaveValue("532 123 45 67");
    fireEvent.change(phone, { target: { value: "05551112233" } });
    expect(phone).toHaveValue("555 111 22 33");
    fireEvent.click(screen.getByRole("button", { name: "Numarayı kaydet" }));

    expect(await screen.findByText("Kaydedildi")).toBeInTheDocument();
    expect(service.updateWhatsapp).toHaveBeenCalledWith("+905551112233");
  });

  it("e-posta değişikliği 'değişti' demez; onay bekleniyor bilgisini verir", async () => {
    await renderView(makeService(), "iletisim");

    fireEvent.change(screen.getByLabelText("Yeni e-posta"), { target: { value: "yeni@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Onay bağlantısı gönder" }));

    const status = await screen.findByText(/yeni@acme.com adresine onay bağlantısı gönderildi/);
    expect(status).toHaveTextContent("Onaylanana kadar ayse@acme.com geçerli.");
    expect(screen.queryByText(/e-postanız değişti/i)).toBeNull();
  });

  it("mevcut adresle aynı e-posta reddedilir", async () => {
    const { service } = await renderView(makeService(), "iletisim");

    fireEvent.change(screen.getByLabelText("Yeni e-posta"), { target: { value: "AYSE@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Onay bağlantısı gönder" }));

    expect(await screen.findByText("Yeni adres mevcut adresinizle aynı.")).toBeInTheDocument();
    expect(service.requestEmailChange).not.toHaveBeenCalled();
  });
});

describe("ProfileView — Güvenlik", () => {
  function fillPasswords(current: string, next: string, confirm = next) {
    fireEvent.change(screen.getByLabelText("Mevcut şifre"), { target: { value: current } });
    fireEvent.change(screen.getByLabelText("Yeni şifre"), { target: { value: next } });
    fireEvent.change(screen.getByLabelText("Yeni şifre (tekrar)"), { target: { value: confirm } });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi güncelle" }));
  }

  it("wrong_password mevcut şifre alanında gösterilir", async () => {
    await renderView(
      makeService({
        changePassword: vi.fn(() =>
          Promise.resolve({ status: "error" as const, code: "wrong_password" as const, field: "current" }),
        ),
      }),
      "guvenlik",
    );
    fillPasswords("yanlis12", "Yeni1234");

    expect(await screen.findByText("Mevcut şifre hatalı.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mevcut şifre")).toHaveAttribute("aria-invalid", "true");
  });

  it("başarıda alanlar temizlenir ve onay mesajı çıkar", async () => {
    const { service } = await renderView(makeService(), "guvenlik");
    fillPasswords("eski1234", "Yeni1234");

    expect(await screen.findByText("Şifreniz güncellendi.")).toBeInTheDocument();
    expect(service.changePassword).toHaveBeenCalledWith({ current: "eski1234", next: "Yeni1234" });
    expect(screen.getByLabelText("Mevcut şifre")).toHaveValue("");
  });

  it("tüm cihazlardan çıkış servisi 'all' ile çağırır ve yönlendirir", async () => {
    const { service, navigate } = await renderView(makeService(), "guvenlik");

    fireEvent.click(screen.getByRole("button", { name: "Tüm cihazlardan çıkış yap" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login"));
    expect(service.signOut).toHaveBeenCalledWith("all");
  });
});

describe("ProfileView — Bildirimler", () => {
  it("anahtarlar mevcut tercihleri yansıtır ve değişiklik kaydedilir", async () => {
    const { service } = await renderView(makeService(), "bildirimler");

    const push = screen.getByRole("switch", { name: /Yeni ilan.*bildirim/ });
    const weekly = screen.getByRole("switch", { name: /Haftalık özet/ });
    expect(push).toHaveAttribute("aria-checked", "true");
    expect(weekly).toHaveAttribute("aria-checked", "false");

    fireEvent.click(weekly);
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Kaydedildi")).toBeInTheDocument();
    expect(service.updateNotifications).toHaveBeenCalledWith({ ...PROFILE.notifications, weeklySummaryEmail: true });
  });
});

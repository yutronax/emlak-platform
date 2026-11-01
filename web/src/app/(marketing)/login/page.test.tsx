// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { login } from "./actions";
import LoginPage from "./page";

vi.mock("./actions", () => ({
  login: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: password } });
}

describe("LoginPage (/login)", () => {
  // AC-10 (Medium): giriş sayfası kopyası güncel.
  it("AC-10: 'takip ettiğiniz WhatsApp gruplarındaki ilanlara' metni görünür", () => {
    render(<LoginPage />);

    expect(
      screen.getByText(/takip ettiğiniz WhatsApp gruplarındaki ilanlara/),
    ).toBeInTheDocument();
  });

  it("AC-10: eski 'WhatsApp'a attığınız ilanlara' metni yoktur", () => {
    const { container } = render(<LoginPage />);

    expect(container.textContent ?? "").not.toContain("WhatsApp'a attığınız");
  });

  // AC-13 (Medium): "Şifremi unuttum" linki /sifremi-unuttum'a gider.
  it("AC-13: 'Şifremi unuttum' linki href /sifremi-unuttum'a gider", () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", { name: "Şifremi unuttum" });
    expect(link).toHaveAttribute("href", "/sifremi-unuttum");
  });

  it("'Giriş yap' başlığı ve kayıt bağlantısı görünür", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Giriş yap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ücretsiz deneyin" })).toHaveAttribute("href", "/signup");
  });
});

describe("LoginPage — marka sahnesi (giris-kayit-tasarimi; p1 AC-5'in yerine)", () => {
  // Dekor CSS ile çizilir: sayfada img/svg yok, arka plan kelimeleri ekran okuyucudan gizli (V-6).
  it("img/svg yok, dekoratif katman aria-hidden", () => {
    const { container } = render(<LoginPage />);

    expect(container.querySelector("img, svg")).toBeNull();
    const decor = container.querySelector("[data-auth-decor]");
    expect(decor).not.toBeNull();
    expect(decor).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LoginPage — şifre alanı", () => {
  it("göster/gizle düğmesi şifre alanının tipini değiştirir", () => {
    render(<LoginPage />);

    const input = screen.getByLabelText("Şifre");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Şifreyi göster" }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Şifreyi gizle" }));
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("LoginPage — durumlar", () => {
  it("geçersiz e-postada servis çağrılmaz, hata alana bağlı gösterilir", async () => {
    render(<LoginPage />);
    fill("yanlis", "sifre123");
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    const email = screen.getByLabelText("E-posta");
    expect(await screen.findByText("Geçerli bir e-posta girin.")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(email.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Geçerli bir e-posta girin.",
    );
    expect(login).not.toHaveBeenCalled();
  });

  it("boş şifrede servis çağrılmaz", async () => {
    render(<LoginPage />);
    fill("a@b.co", "");
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(await screen.findByText("Şifrenizi girin.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("sunucu hatası alert olarak gösterilir ve e-posta korunur", async () => {
    vi.mocked(login).mockResolvedValue({ error: "Giriş başarısız: e-posta veya şifre hatalı." });
    render(<LoginPage />);
    fill("a@b.co", "sifre123");
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Giriş başarısız: e-posta veya şifre hatalı.");
    expect(screen.getByLabelText("E-posta")).toHaveValue("a@b.co");
  });

  it("ağ hatasında tekrar dene mesajı gösterir", async () => {
    vi.mocked(login).mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);
    fill("a@b.co", "sifre123");
    fireEvent.click(screen.getByRole("button", { name: "Giriş yap" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı sorunu, tekrar deneyin.");
  });

  it("gerçek servis Google desteklemediği için Google düğmesi gösterilmez", () => {
    render(<LoginPage />);

    expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
  });
});

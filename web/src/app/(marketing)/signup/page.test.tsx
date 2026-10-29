// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signup } from "./actions";
import SignupPage from "./page";

vi.mock("./actions", () => ({
  signup: vi.fn(),
}));

const TERMS_LABEL =
  "Kullanım Şartları'nı ve KVKK Aydınlatma Metni'ni okudum, kabul ediyorum.";
const TERMS_ERROR = "Devam etmek için şartları kabul etmeniz gerekiyor.";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SignupPage (/signup) — component smoke", () => {
  // AC-1 / AC-6 için giriş alanları: email, password, company_name
  it("e-posta, şifre ve şirket adı için birer input render eder", () => {
    render(<SignupPage />);

    const email = screen.getByLabelText("E-posta");
    const password = screen.getByLabelText("Şifre");
    const companyName = screen.getByLabelText("Şirket adı");

    expect(email).toBeInTheDocument();
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("type", "email");

    expect(password).toBeInTheDocument();
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("type", "password");

    expect(companyName).toBeInTheDocument();
    expect(companyName).toHaveAttribute("name", "company_name");
  });

  // Submit butonu "Ücretsiz Deneyin" metniyle render edilmeli
  it("'Ücretsiz Deneyin' metinli bir submit butonu render eder", () => {
    render(<SignupPage />);

    const button = screen.getByRole("button", { name: "Ücretsiz Deneyin" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "submit");
  });

  // Form, useActionState'in action prop'una bağlı bir <form> olmalı
  it("inputları bir <form> içinde sarar (action bağlanmış form)", () => {
    const { container } = render(<SignupPage />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form).toContainElement(screen.getByLabelText("E-posta"));
    expect(form).toContainElement(screen.getByRole("button", { name: "Ücretsiz Deneyin" }));
  });

  // Başlangıçta (henüz submit yokken) state boş: hata/mesaj paragrafı görünmemeli
  it("ilk render'da hata veya genel mesaj göstermez", () => {
    const { container } = render(<SignupPage />);

    expect(container.querySelector("p.text-red-600")).toBeNull();
    expect(screen.queryByText(/Kayıt alındı/)).not.toBeInTheDocument();
  });

  // Render sırasında signup action'ı tetiklenmemeli (yalnızca submit'te çağrılır)
  it("render sırasında signup action'ını çağırmaz", () => {
    render(<SignupPage />);

    expect(signup).not.toHaveBeenCalled();
  });
});

describe("SignupPage — KVKK/Şartlar onay kutusu (AC-2)", () => {
  // AC-2 (Critical): tek onay kutusu, varsayılan işaretsiz, name="terms".
  it("onay kutusu varsayılan olarak işaretsiz ve name='terms' taşır", () => {
    render(<SignupPage />);

    const checkbox = screen.getByRole("checkbox", { name: TERMS_LABEL });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("name", "terms");
  });

  // AC-2: iki metin yeni sekmede açılan link olarak verilir.
  it("'Kullanım Şartları' ve 'KVKK Aydınlatma Metni' linkleri yeni sekmede (target=_blank) açılır", () => {
    render(<SignupPage />);

    const terms = screen.getByRole("link", { name: "Kullanım Şartları" });
    expect(terms).toHaveAttribute("href", "/kullanim-sartlari");
    expect(terms).toHaveAttribute("target", "_blank");

    const kvkk = screen.getByRole("link", { name: "KVKK Aydınlatma Metni" });
    expect(kvkk).toHaveAttribute("href", "/kvkk");
    expect(kvkk).toHaveAttribute("target", "_blank");
  });

  // AC-2 (Critical): işaretsizken sunucu/istemci reddeder; hata kutunun altında,
  // checkbox'a aria-describedby ile bağlı olarak görünür.
  it("şartlar işaretsizken gönderim reddedilir ve hata checkbox'a aria-describedby ile bağlı gösterilir", async () => {
    vi.mocked(signup).mockResolvedValue({ error: TERMS_ERROR });
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("E-posta"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Şifre"), {
      target: { value: "sifre123" },
    });
    fireEvent.change(screen.getByLabelText("Şirket adı"), {
      target: { value: "Acme Emlak" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ücretsiz Deneyin" }));

    expect(await screen.findByText(TERMS_ERROR)).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox", { name: TERMS_LABEL });
    const describedBy = checkbox.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    const describedText = describedBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    expect(describedText).toContain(TERMS_ERROR);
  });
});

describe("SignupPage (/signup) — tanıtım paragrafı", () => {
  // Paragraf form başlığının altında, mobilde de gizlenmeden görünür olmalı.
  it("'Yeni bir şey öğrenmenize gerek yok...' paragrafı görünür (hidden sınıfı yok)", () => {
    render(<SignupPage />);

    const paragraph = screen.getByText(/Yeni bir şey öğrenmenize gerek yok/);
    expect(paragraph).toBeInTheDocument();
    expect(paragraph.className).not.toMatch(/\bhidden\b/);
  });
});

describe("SignupPage (/signup) — form üstte, dekoratif panel yok (AC-5)", () => {
  // AC-5 (High): dekoratif çizim (img) kaldırıldı.
  it("sayfada img elementi yok", () => {
    const { container } = render(<SignupPage />);

    expect(container.querySelector("img")).toBeNull();
  });

  // AC-5 (High): koyu sol panel (bg-ink-900) kaldırıldı.
  it("koyu sol panel (bg-ink-900) yok", () => {
    const { container } = render(<SignupPage />);

    expect(container.querySelector(".bg-ink-900")).toBeNull();
  });

  // AC-5 (High): "Emlak Platformu" sol panel başlığı yok; form başlığı görünür.
  it("'Emlak Platformu' başlığı sayfada yok, 'Ücretsiz Deneyin' başlığı form üstünde var", () => {
    render(<SignupPage />);

    expect(screen.queryByRole("heading", { name: "Emlak Platformu" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Ücretsiz Deneyin" })).toBeInTheDocument();
  });
});

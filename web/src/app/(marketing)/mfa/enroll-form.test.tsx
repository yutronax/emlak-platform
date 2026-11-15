// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startEnrollment, verifyMfa } from "./actions";
import EnrollForm from "./enroll-form";

vi.mock("./actions", () => ({
  startEnrollment: vi.fn(),
  verifyMfa: vi.fn(),
}));

const QR = "data:image/svg+xml;base64,PHN2Zy8+";
const SECRET = "JBSWY3DPEHPK3PXP";
const ENROLL_OK = { status: "ok" as const, factorId: "factor-new", qr: QR, secret: SECRET };

function hiddenFactorId(): string | undefined {
  const input = document.querySelector('input[name="factorId"]') as HTMLInputElement | null;
  return input?.value;
}

// Kurulum: butona basılır, startEnrollment sonucu (QR + secret) gösterilir.
async function startSetup() {
  vi.mocked(startEnrollment).mockResolvedValue(ENROLL_OK);
  render(<EnrollForm />);
  fireEvent.click(screen.getByRole("button", { name: /kurulumu başlat/i }));
  await screen.findByRole("img", { name: "MFA QR kodu" });
}

describe("EnrollForm (kurulum bileşeni)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Buton: tıklanınca startEnrollment tam bir kez çağrılır.
  it("'Kurulumu başlat' butonuna basılınca startEnrollment bir kez çağrılır", async () => {
    await startSetup();

    expect(startEnrollment).toHaveBeenCalledTimes(1);
  });

  // QR ve secret görünür.
  it("başarıdan sonra QR <img alt='MFA QR kodu'> ve secret metin olarak görünür", async () => {
    await startSetup();

    expect(screen.getByRole("img", { name: "MFA QR kodu" })).toHaveAttribute("src", QR);
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(hiddenFactorId()).toBe("factor-new");
  });

  // Kod formu: gönderilince verifyMfa doğru factorId ile çağrılır.
  it("kod formu gönderilince verifyMfa dönen factorId ve girilen kodla çağrılır", async () => {
    vi.mocked(verifyMfa).mockResolvedValue({
      status: "error",
      message: "Kod geçersiz ya da süresi doldu.",
    });
    await startSetup();

    fireEvent.change(screen.getByLabelText(/doğrulama kodu/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /doğrula/i }));

    await screen.findByRole("alert");
    expect(verifyMfa).toHaveBeenCalledTimes(1);
    const formData = vi.mocked(verifyMfa).mock.calls[0].at(-1) as FormData;
    expect(formData.get("factorId")).toBe("factor-new");
    expect(formData.get("code")).toBe("123456");
  });

  // Yanlış kod: yeni enroll YOK; QR, secret ve factorId aynı kalır.
  it("verifyMfa hata dönerse startEnrollment ikinci kez ÇAĞRILMAZ ve aynı QR/secret görünür kalır", async () => {
    vi.mocked(verifyMfa).mockResolvedValue({
      status: "error",
      message: "Kod geçersiz ya da süresi doldu.",
    });
    await startSetup();

    fireEvent.change(screen.getByLabelText(/doğrulama kodu/i), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /doğrula/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kod geçersiz ya da süresi doldu.");
    expect(startEnrollment).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "MFA QR kodu" })).toHaveAttribute("src", QR);
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(hiddenFactorId()).toBe("factor-new");
  });

  // startEnrollment hata dönerse role="alert" mesajı; QR gösterilmez.
  it("startEnrollment hata dönerse role='alert' mesajı gösterilir ve QR görünmez", async () => {
    vi.mocked(startEnrollment).mockResolvedValue({
      status: "error",
      message: "Kurulum başlatılamadı. Tekrar deneyin.",
    });
    render(<EnrollForm />);

    fireEvent.click(screen.getByRole("button", { name: /kurulumu başlat/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kurulum başlatılamadı. Tekrar deneyin.");
    expect(screen.queryByRole("img", { name: "MFA QR kodu" })).toBeNull();
    expect(screen.queryByText(SECRET)).toBeNull();
  });
});

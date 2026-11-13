// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Server action modülü test ortamında çağrılmaz; mock'lanır.
vi.mock("@/app/(marketing)/support/actions", () => ({
  sendSupportMessage: vi.fn(),
}));

import { SupportDialog } from "./support-dialog";

// jsdom native <dialog> showModal/close'u uygulamaz; open özniteliğini ayarlayan sahte sürüm kullanılır.
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});

afterEach(() => {
  cleanup();
  showModal.mockClear();
});

describe("SupportDialog — varsayılan (yüzen) varyant", () => {
  it("prop verilmezse sabit konumlu 'Destek' butonunu render eder", () => {
    render(<SupportDialog />);

    const button = screen.getByRole("button", { name: "Destek" });
    expect(button).toHaveClass("fixed", "flex");
    expect(screen.queryByRole("button", { name: "Destek formu" })).toBeNull();
  });

  it("hideOnMobile: yüzen buton mobilde gizli (hidden), md ve üstünde flex", () => {
    render(<SupportDialog hideOnMobile />);

    expect(screen.getByRole("button", { name: "Destek" })).toHaveClass("hidden", "md:flex");
  });
});

describe("SupportDialog — variant=\"inline\"", () => {
  it("label ile metin akışında bir button render eder; yüzen değildir", () => {
    render(<SupportDialog variant="inline" label="Destek formu" />);

    const button = screen.getByRole("button", { name: "Destek formu" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveClass("fixed");
  });

  it("yüzen 'Destek' butonunu render etmez", () => {
    const { container } = render(<SupportDialog variant="inline" label="Destek formu" />);

    expect(screen.queryByRole("button", { name: "Destek" })).toBeNull();
    expect(container.querySelector(".fixed")).toBeNull();
  });

  it("tıklayınca destek formu dialogunu açar (role=dialog, başlık 'Destek', form alanları)", () => {
    render(<SupportDialog variant="inline" label="Destek formu" />);

    fireEvent.click(screen.getByRole("button", { name: "Destek formu" }));

    expect(showModal).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole("dialog", { name: "Destek mesajı" });
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Destek" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Adınız")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Telefon veya e-posta")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Mesajınız")).toBeInTheDocument();
  });

  it("className verilirse satır içi butona eklenir", () => {
    render(<SupportDialog variant="inline" label="Destek formu" className="ozel-sinif" />);

    expect(screen.getByRole("button", { name: "Destek formu" })).toHaveClass("ozel-sinif");
  });
});

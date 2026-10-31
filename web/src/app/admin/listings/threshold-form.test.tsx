// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThresholdForm } from "./threshold-form";

// EML-107 AC-7 (eşik ayarı UI) ve AC-S5 (yetkisiz değişiklik UI'da "Yetkiniz yok").
// Eşik app_settings('personal_auto_approve_threshold'); 0-1 dışı değer reddedilir.

const RANGE_ERROR = "0 ile 1 arasında bir değer girin";

function renderForm(onSave = vi.fn(async () => ({ ok: true }))) {
  render(<ThresholdForm value={0.7} onSave={onSave as never} />);
  return {
    onSave,
    input: screen.getByRole("spinbutton"),
    submit: () => fireEvent.click(screen.getByRole("button", { name: "Kaydet" })),
  };
}

afterEach(() => {
  cleanup();
});

describe("ThresholdForm — geçerli değer (AC-7)", () => {
  it("0.75 girilip kaydedilince onSave(0.75) çağrılır ve 'Kaydedildi' gösterilir", async () => {
    const { onSave, input, submit } = renderForm();

    fireEvent.change(input, { target: { value: "0.75" } });
    submit();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(0.75);
    expect(await screen.findByText("Kaydedildi")).toBeInTheDocument();
  });
});

describe("ThresholdForm — geçersiz değer reddi (AC-7)", () => {
  it.each(["", "-0.1", "1.5", "abc", "nan", "inf"])(
    "değer '%s' ise onSave çağrılmaz ve '0 ile 1 arasında bir değer girin' gösterilir",
    async (value) => {
      const { onSave, input, submit } = renderForm();

      fireEvent.change(input, { target: { value } });
      submit();

      expect(await screen.findByText(RANGE_ERROR)).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    },
  );
});

describe("ThresholdForm — yetki hatası (AC-S5)", () => {
  it("onSave {ok:false,error:'forbidden'} dönerse 'Yetkiniz yok' gösterilir", async () => {
    const onSave = vi.fn(async () => ({ ok: false, error: "forbidden" }));
    const { input, submit } = renderForm(onSave);

    fireEvent.change(input, { target: { value: "0.5" } });
    submit();

    expect(onSave).toHaveBeenCalledWith(0.5);
    expect(await screen.findByText("Yetkiniz yok")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupPicker, type GroupPickerProps } from "./group-picker";

// EML-107 AC-1, AC-2, AC-10 — get_my_wa_groups / set_my_wa_group_selection
// Davranış Sözleşmesi satırlarının UI karşılığı. Server action yerine onSave prop'u stublanır.

const SYNCED_AT = "2026-10-31T09:00:00.000Z";

function group(jid: string, name: string | null, selected = false) {
  return { jid, name, selected };
}

function initialWith(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: "connected",
    groups: [],
    max: 20,
    groups_synced_at: SYNCED_AT,
    ...overrides,
  };
}

function renderPicker(
  initial: Record<string, unknown>,
  onSave: GroupPickerProps["onSave"] = vi.fn<GroupPickerProps["onSave"]>(async () => ({ ok: true, selected: 0 })),
) {
  render(<GroupPicker initial={initial as never} onSave={onSave as never} />);
  return { onSave };
}

afterEach(() => {
  cleanup();
});

describe("GroupPicker — grup listesi (AC-1)", () => {
  it("grupları adlarıyla listeler ve seçili olanları işaretli gösterir", () => {
    renderPicker(
      initialWith({
        groups: [
          group("111@g.us", "Kadıköy Emlak", true),
          group("222@g.us", "Beşiktaş Kiralık", false),
        ],
      }),
    );

    expect(screen.getByRole("checkbox", { name: "Kadıköy Emlak" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beşiktaş Kiralık" })).not.toBeChecked();
  });

  it("seçim sayacını '3/20' olarak gösterir", () => {
    renderPicker(
      initialWith({
        groups: [
          group("1@g.us", "Grup 1", true),
          group("2@g.us", "Grup 2", true),
          group("3@g.us", "Grup 3", true),
          group("4@g.us", "Grup 4", false),
        ],
      }),
    );

    expect(screen.getByText("3/20")).toBeInTheDocument();
  });

  it("20 grup seçiliyken seçilmemiş grupların checkbox'ı disabled olur", () => {
    const groups = Array.from({ length: 21 }, (_, i) =>
      group(`${i + 1}@g.us`, `Grup ${i + 1}`, i < 20),
    );
    renderPicker(initialWith({ groups }));

    expect(screen.getByRole("checkbox", { name: "Grup 21" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Grup 1" })).toBeEnabled();
  });

  it("grup adı null ise '(adsız grup)' gösterir", () => {
    renderPicker(initialWith({ groups: [group("9@g.us", null, false)] }));

    expect(screen.getByText("(adsız grup)")).toBeInTheDocument();
  });

  it("grup listesi boş ve henüz senkron yoksa (groups_synced_at null) 'Gruplar yükleniyor…' gösterir", () => {
    renderPicker(initialWith({ groups: [], groups_synced_at: null }));

    expect(screen.getByText("Gruplar yükleniyor…")).toBeInTheDocument();
  });

  it("status 'none' ise 'Önce WhatsApp'ını bağla' gösterir", () => {
    renderPicker({ ok: true, status: "none", groups: [], max: 20 });

    expect(screen.getByText("Önce WhatsApp'ını bağla")).toBeInTheDocument();
  });
});

describe("GroupPicker — salt-okunur durumlar (AC-10)", () => {
  it.each(["disconnected", "logged_out", "error", "pending", "qr"])(
    "status '%s' → checkbox'lar disabled ve 'Yeniden bağlan' uyarısı görünür, son bilinen liste kalır",
    (status) => {
      renderPicker(
        initialWith({
          status,
          readonly: true,
          groups: [group("111@g.us", "Son Bilinen Grup", true)],
        }),
      );

      expect(screen.getByRole("checkbox", { name: "Son Bilinen Grup" })).toBeDisabled();
      expect(screen.getByText("Yeniden bağlan")).toBeInTheDocument();
    },
  );
});

describe("GroupPicker — salt-okunurluk güncel status'tan türer (AC-10)", () => {
  it("connected'dan disconnected'a geçince checkbox'lar disabled ve 'Yeniden bağlan' görünür", () => {
    const groups = [group("111@g.us", "Grup A", true)];
    const { rerender } = render(
      <GroupPicker initial={initialWith({ groups }) as never} onSave={vi.fn() as never} />,
    );
    expect(screen.getByRole("checkbox", { name: "Grup A" })).toBeEnabled();
    expect(screen.queryByText("Yeniden bağlan")).toBeNull();

    rerender(
      <GroupPicker
        initial={initialWith({ groups, status: "disconnected" }) as never}
        onSave={vi.fn() as never}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Grup A" })).toBeDisabled();
    expect(screen.getByText("Yeniden bağlan")).toBeInTheDocument();
  });
});

describe("GroupPicker — kaydetme (AC-2)", () => {
  it("kaydet → onSave seçili jid dizisiyle çağrılır", async () => {
    const { onSave } = renderPicker(
      initialWith({
        groups: [
          group("111@g.us", "Grup A", true),
          group("222@g.us", "Grup B", false),
          group("333@g.us", "Grup C", false),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Grup B" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Grup C" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(["111@g.us", "222@g.us", "333@g.us"]);
  });

  it("{ok:true,selected:3} dönerse 'Kaydedildi' gösterir", async () => {
    const onSave = vi.fn<GroupPickerProps["onSave"]>(async () => ({ ok: true, selected: 3 }));
    renderPicker(
      initialWith({ groups: [group("111@g.us", "Grup A", true)] }),
      onSave,
    );

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Kaydedildi")).toBeInTheDocument();
  });

  it("error 'too_many' → 'En fazla 20 grup' gösterir", async () => {
    const onSave = vi.fn<GroupPickerProps["onSave"]>(async () => ({ ok: false, error: "too_many" }));
    renderPicker(
      initialWith({ groups: [group("111@g.us", "Grup A", true)] }),
      onSave,
    );

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("En fazla 20 grup")).toBeInTheDocument();
  });

  it("error 'unknown_group' → 'Liste güncel değil, yenile' gösterir", async () => {
    const onSave = vi.fn<GroupPickerProps["onSave"]>(async () => ({ ok: false, error: "unknown_group" }));
    renderPicker(
      initialWith({ groups: [group("111@g.us", "Grup A", true)] }),
      onSave,
    );

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Liste güncel değil, yenile")).toBeInTheDocument();
  });

  it("error 'not_connected' → 'Yeniden bağlan' uyarısı gösterir", async () => {
    const onSave = vi.fn<GroupPickerProps["onSave"]>(async () => ({ ok: false, error: "not_connected" }));
    renderPicker(
      initialWith({ groups: [group("111@g.us", "Grup A", true)] }),
      onSave,
    );

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(await screen.findByText("Yeniden bağlan")).toBeInTheDocument();
  });

  it("boş seçimle kaydedince ({ok:true,selected:0}) 'Hiçbir grup okunmuyor' gösterir", async () => {
    const onSave = vi.fn<GroupPickerProps["onSave"]>(async () => ({ ok: true, selected: 0 }));
    renderPicker(
      initialWith({ groups: [group("111@g.us", "Grup A", true)] }),
      onSave,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Grup A" }));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(onSave).toHaveBeenCalledWith([]);
    expect(await screen.findByText("Hiçbir grup okunmuyor")).toBeInTheDocument();
  });
});

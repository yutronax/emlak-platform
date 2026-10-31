// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import QRCode from "qrcode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acceptWaConsent, getMyWaGroupsAction, getMyWaStatus, requestWaAction } from "./actions";
import { WaPanel } from "./wa-panel";

// EML-106 / EML-104 AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-9, AC-10.
// Server action'lar DB'ye gitmesin diye stublanır; poll 2 sn, fake timer ile sürülür.

vi.mock("./actions", () => ({
  getMyWaStatus: vi.fn(),
  getMyWaGroupsAction: vi.fn(),
  requestWaAction: vi.fn(),
  acceptWaConsent: vi.fn(),
  setMyWaGroupSelection: vi.fn(),
}));

const routerRefresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

// QR, qrcode kütüphanesiyle SVG'ye çevrilir; test ortamında sahte SVG döner.
vi.mock("qrcode", () => {
  const toString = vi.fn(
    async () => '<svg xmlns="http://www.w3.org/2000/svg" data-testid="qr-svg"></svg>',
  );
  return { default: { toString }, toString };
});

type PanelProps = ComponentProps<typeof WaPanel>;

const CONSENT_VERSION = "2026-10";
const CONSENT_TEXT = /Sistem numaranızdan hiçbir mesaj göndermez/;
const CONSENT_LABEL = /Riski anladım ve kabul ediyorum/;
const PHONE = "+90 5** *** **12";
const QR_LABEL = "WhatsApp QR kodu";

// Poll ve Promise zinciri: fake timer altında mikro görevleri boşalt.
async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {});
  }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderPanel(
  props: { initialStatus?: PanelProps["initialStatus"]; consentAccepted?: boolean } = {},
) {
  return render(
    <WaPanel
      initialStatus={props.initialStatus ?? { status: "none" }}
      consentAccepted={props.consentAccepted ?? false}
    />,
  );
}

function clickBagla() {
  fireEvent.click(screen.getByRole("button", { name: "Bağla" }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  vi.mocked(getMyWaStatus).mockResolvedValue({ ok: true, status: "none" } as never);
  vi.mocked(requestWaAction).mockResolvedValue({ ok: true, status: "pending" } as never);
  vi.mocked(acceptWaConsent).mockResolvedValue({ ok: true } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WaPanel — onay (AC-1)", () => {
  it("onay yokken ban riski metni görünür, 'Bağla' disabled ve tıklanınca istek yapılmaz", async () => {
    renderPanel({ consentAccepted: false });

    expect(screen.getByText(CONSENT_TEXT)).toBeInTheDocument();
    const bagla = screen.getByRole("button", { name: "Bağla" });
    expect(bagla).toBeDisabled();

    fireEvent.click(bagla);
    await flush();

    expect(requestWaAction).not.toHaveBeenCalled();
  });

  it("kutu işaretlenip onaylanınca acceptWaConsent('2026-10') çağrılır ve 'Bağla' etkinleşir", async () => {
    renderPanel({ consentAccepted: false });

    fireEvent.click(screen.getByRole("checkbox", { name: CONSENT_LABEL }));
    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    await flush();

    expect(acceptWaConsent).toHaveBeenCalledTimes(1);
    expect(acceptWaConsent).toHaveBeenCalledWith(CONSENT_VERSION);
    expect(screen.getByRole("button", { name: "Bağla" })).toBeEnabled();
  });

  it("onaylı emlakçı 'Bağla'ya basınca requestWaAction('connect') çağrılır ve 'Hazırlanıyor' gösterilir", async () => {
    renderPanel({ consentAccepted: true });

    clickBagla();
    await flush();

    expect(requestWaAction).toHaveBeenCalledWith("connect");
    expect(screen.getByText(/Hazırlanıyor/)).toBeInTheDocument();
  });

  it("sunucu consent_required dönerse onay kutusu yeniden gösterilir ve 'Bağla' disabled olur (AC-S7)", async () => {
    vi.mocked(requestWaAction).mockResolvedValue({
      ok: false,
      error: "consent_required",
    } as never);
    renderPanel({ consentAccepted: true });

    clickBagla();

    expect(
      await screen.findByRole("checkbox", { name: CONSENT_LABEL }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bağla" })).toBeDisabled();
  });
});

describe("WaPanel — bağlama ve poll (AC-2)", () => {
  it("qr durumunda QR (aria-label) gösterilir ve her 2 sn'de bir getMyWaStatus poll edilir", async () => {
    vi.mocked(getMyWaStatus).mockResolvedValue({
      ok: true,
      status: "qr",
      qr: "2@abc",
      qr_expires_at: "2099-01-01T00:00:20.000Z",
    } as never);
    renderPanel({ consentAccepted: true });

    clickBagla();
    await flush();

    // İlk poll 2 sn sonra; QR gelince görsel çizilir.
    await advance(2000);
    expect(await screen.findByLabelText(QR_LABEL)).toBeInTheDocument();
    expect(QRCode.toString).toHaveBeenCalledWith("2@abc", expect.anything());

    const before = vi.mocked(getMyWaStatus).mock.calls.length;
    await advance(2000);
    expect(vi.mocked(getMyWaStatus).mock.calls.length).toBe(before + 1);

    await advance(2000);
    expect(vi.mocked(getMyWaStatus).mock.calls.length).toBe(before + 2);
  });

  it("connected olunca 'Bağlı: +90 5** *** **12' gösterilir ve poll durur", async () => {
    vi.mocked(getMyWaStatus).mockResolvedValue({
      ok: true,
      status: "connected",
      phone_masked: PHONE,
    } as never);
    renderPanel({ consentAccepted: true });

    clickBagla();
    await flush();
    await advance(2000);

    expect(await screen.findByText(`Bağlı: ${PHONE}`)).toBeInTheDocument();

    vi.mocked(getMyWaStatus).mockClear();
    await advance(10000);
    expect(getMyWaStatus).not.toHaveBeenCalled();
  });
});

describe("WaPanel — kes ve sil (AC-3)", () => {
  it("'Bağlantıyı kaldır' → onay diyaloğu → requestWaAction('disconnect') → sonra 'Bağlı değil'", async () => {
    vi.mocked(getMyWaStatus).mockResolvedValue({ ok: true, status: "none" } as never);
    renderPanel({
      consentAccepted: true,
      initialStatus: { status: "connected", phone_masked: PHONE } as PanelProps["initialStatus"],
    });

    fireEvent.click(screen.getByRole("button", { name: "Bağlantıyı kaldır" }));
    expect(requestWaAction).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^(evet|onayla|kaldır)/i }));
    await flush();

    expect(requestWaAction).toHaveBeenCalledWith("disconnect");

    await advance(2000);
    expect(await screen.findByText("Bağlı değil")).toBeInTheDocument();
  });

  it("status 'none' iken 'Bağlı değil' gösterilir", () => {
    renderPanel({ consentAccepted: true, initialStatus: { status: "none" } });

    expect(screen.getByText("Bağlı değil")).toBeInTheDocument();
  });
});

// Durum/hata kodları: status alanından gelir (sidecar yazdığı için panel yalnız eşler).
describe("WaPanel — durum hata kodu mesajları (AC-5, AC-6, AC-7, AC-10, AC-S3, AC-9, AC-8, AC-11)", () => {
  it.each([
    {
      name: "logged_out (AC-5)",
      initialStatus: { status: "logged_out" },
      text: /telefondan kaldırıldı/i,
    },
    {
      name: "qr_expired (AC-6)",
      initialStatus: { status: "disconnected", error_code: "qr_expired" },
      text: /Süre doldu/,
    },
    {
      name: "replaced (AC-8)",
      initialStatus: { status: "disconnected", error_code: "replaced" },
      text: /başka bir yerde açıldı/,
    },
    {
      name: "sidecar_timeout (AC-7)",
      initialStatus: { status: "error", error_code: "sidecar_timeout" },
      text: /Servis (şu an )?yanıt vermiyor/,
    },
    {
      name: "no_qr_generated (AC-7)",
      initialStatus: { status: "error", error_code: "no_qr_generated" },
      text: /Bağlantı başlatılamadı/,
    },
    {
      name: "capacity (AC-10)",
      initialStatus: { status: "error", error_code: "capacity" },
      text: /Şu an yeni bağlantı açılamıyor/,
    },
    {
      name: "creds_persist_failed (AC-S3)",
      initialStatus: { status: "error", error_code: "creds_persist_failed" },
      text: /Bağlantı kaydedilemedi/,
    },
    {
      name: "sidecar_misconfigured (AC-11)",
      initialStatus: { status: "error", error_code: "sidecar_misconfigured" },
      text: /Servis şu an kullanılamıyor/,
    },
    {
      name: "subscription_inactive (AC-9)",
      initialStatus: { status: "disconnected", error_code: "subscription_inactive" },
      text: /Aboneliğiniz aktif değil/,
    },
  ])("$name → Türkçe mesaj gösterilir", async ({ initialStatus, text }) => {
    renderPanel({
      consentAccepted: true,
      initialStatus: initialStatus as PanelProps["initialStatus"],
    });

    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});

// EML-107 AC-1, AC-10: poll ile bağlantı durumu değişince grup listesi tazelenir ve seçici
// canlı status'tan salt-okunur/yazılabilir olur.
describe("WaPanel — durum değişince grup listesi (EML-107 AC-1, AC-10)", () => {
  const SYNCED_AT = "2026-10-31T09:00:00.000Z";
  const groupsStale = {
    ok: true,
    status: "disconnected",
    groups: [{ jid: "111@g.us", name: "Grup A", selected: true }],
    max: 20,
    groups_synced_at: SYNCED_AT,
  } as unknown as PanelProps["groups"];

  it("poll ile status 'connected'a geçince router.refresh çağrılır", async () => {
    vi.mocked(getMyWaStatus).mockResolvedValue({
      ok: true,
      status: "connected",
      phone_masked: PHONE,
    } as never);
    renderPanel({
      consentAccepted: true,
      initialStatus: { status: "pending" } as PanelProps["initialStatus"],
    });

    expect(routerRefresh).not.toHaveBeenCalled();

    await advance(2000);
    expect(await screen.findByText(`Bağlı: ${PHONE}`)).toBeInTheDocument();
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("aynı durum sürerken (ör. pending poll'u) router.refresh tekrar çağrılmaz", async () => {
    vi.mocked(getMyWaStatus).mockResolvedValue({ ok: true, status: "pending" } as never);
    renderPanel({
      consentAccepted: true,
      initialStatus: { status: "pending" } as PanelProps["initialStatus"],
    });

    await advance(4000);

    expect(getMyWaStatus).toHaveBeenCalled();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("grup seçici canlı status 'connected' olunca yazılabilir olur (önceki salt-okunur snapshot'a takılmaz)", async () => {
    vi.mocked(getMyWaStatus).mockResolvedValue({
      ok: true,
      status: "connected",
      phone_masked: PHONE,
    } as never);
    // Sunucu snapshot'ı ("disconnected") router.refresh öncesi eski kalmış olabilir; seçici
    // yine de canlı poll durumuna göre karar verir.
    render(
      <WaPanel
        initialStatus={{ status: "pending" }}
        consentAccepted
        groups={groupsStale}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Grup A" })).toBeDisabled();

    await advance(2000);
    expect(await screen.findByText(`Bağlı: ${PHONE}`)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Grup A" })).toBeEnabled();
    expect(screen.queryByText("Yeniden bağlan")).toBeNull();
  });
});

// EML-109: connected sonrası sidecar grup senkronunu geç bitirebilir; senkron bitene kadar grup
// listesi poll edilir, bitince poll durur.
describe("WaPanel — connected sonrası grup senkronu poll'u (EML-109)", () => {
  const SYNCED_AT = "2026-10-31T09:00:00.000Z";
  const groupsUnsynced = {
    ok: true,
    status: "connected",
    groups: [],
    max: 20,
    groups_synced_at: null,
  } as unknown as PanelProps["groups"];
  const groupsSynced = {
    ok: true,
    status: "connected",
    groups: [{ jid: "222@g.us", name: "Grup B", selected: false }],
    max: 20,
    groups_synced_at: SYNCED_AT,
  };

  it("connected + synced_at null → poll'da grup okuması çağrılır ve gelen grup listede görünür", async () => {
    vi.mocked(getMyWaGroupsAction).mockResolvedValue(groupsSynced as never);
    render(
      <WaPanel
        initialStatus={{ status: "connected", phone_masked: PHONE } as PanelProps["initialStatus"]}
        consentAccepted
        groups={groupsUnsynced}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: "Grup B" })).toBeNull();

    await advance(2000);

    expect(getMyWaGroupsAction).toHaveBeenCalled();
    expect(await screen.findByRole("checkbox", { name: "Grup B" })).toBeInTheDocument();
  });

  it("synced_at dolu → ek grup okuması yapılmaz (ve durum poll'u da çalışmaz)", async () => {
    render(
      <WaPanel
        initialStatus={{ status: "connected", phone_masked: PHONE } as PanelProps["initialStatus"]}
        consentAccepted
        groups={groupsSynced as PanelProps["groups"]}
      />,
    );

    await advance(10000);

    expect(getMyWaGroupsAction).not.toHaveBeenCalled();
    expect(getMyWaStatus).not.toHaveBeenCalled();
  });
});

// İstek düzeyi hatalar: requestWaAction'ın {ok:false,error} dönüşü.
describe("WaPanel — istek hata kodu mesajları (AC-9, AC-S4, AC-S7)", () => {
  it.each([
    {
      name: "subscription_required (AC-9)",
      error: "subscription_required",
      text: /Bu özellik için aktif abonelik gerekir/,
    },
    {
      name: "rate_limited (AC-S4)",
      error: "rate_limited",
      text: /Çok fazla deneme/,
    },
  ])("$name → Türkçe mesaj gösterilir", async ({ error, text }) => {
    vi.mocked(requestWaAction).mockResolvedValue({ ok: false, error } as never);
    renderPanel({ consentAccepted: true });

    clickBagla();

    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});

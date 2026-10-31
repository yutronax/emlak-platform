// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deletePushSubscription,
  getPushRegistrationStatus,
  savePushSubscription,
} from "./push-actions";
import { PushToggle } from "./push-toggle";

// Server action'lar test ortamında DB'ye gitmesin; çağrılar assert edilir.
vi.mock("./push-actions", () => ({
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  getPushRegistrationStatus: vi.fn(),
}));

// Varsayılan: abonelik bu kullanıcıya ait (paylaşılan cihaz kontrolü geçer).
beforeEach(() => {
  vi.mocked(getPushRegistrationStatus).mockResolvedValue({ ok: true, mine: true });
});

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/test-endpoint-123";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type SetupOptions = {
  vapid?: boolean;
  serviceWorker?: boolean;
  pushManager?: boolean;
  permission?: NotificationPermission;
  subscribed?: boolean;
  userAgent?: string;
  /** iOS navigator.standalone; undefined ise hiç tanımlanmaz. */
  standalone?: boolean;
};

type FakeSubscription = {
  endpoint: string;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
  getKey: (name: string) => ArrayBuffer | null;
  unsubscribe: ReturnType<typeof vi.fn>;
};

let subscription: FakeSubscription;
let pushManager: {
  getSubscription: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};
let notification: {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
};

function makeSubscription(): FakeSubscription {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({
      endpoint: ENDPOINT,
      keys: { p256dh: "P256DH_TEST_KEY", auth: "AUTH_TEST_KEY" },
    }),
    getKey: () => new ArrayBuffer(8),
    unsubscribe: vi.fn(async () => true),
  };
}

// Tarayıcı API'lerini test başına kurar. Her test kendi ortamını ister.
function setup(opts: SetupOptions = {}) {
  const {
    vapid = true,
    serviceWorker = true,
    pushManager: pushManagerSupported = true,
    permission = "default",
    subscribed = false,
    userAgent = DESKTOP_UA,
    standalone,
  } = opts;

  // Public key env: bileşen render anında okumalı (modül yüklenirken değil).
  vi.stubEnv(
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    vapid ? "BPublicVapidKeyForTests" : "",
  );

  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => userAgent,
  });

  if (standalone !== undefined) {
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: standalone,
    });
  }

  subscription = makeSubscription();
  pushManager = {
    getSubscription: vi.fn(async () => (subscribed ? subscription : null)),
    subscribe: vi.fn(async () => subscription),
  };
  const registration = { pushManager };

  if (serviceWorker) {
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
        getRegistration: vi.fn(async () => registration),
        register: vi.fn(),
      },
    });
  }

  if (pushManagerSupported) {
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class PushManager {},
    });
  }

  notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = "granted";
      return "granted" as NotificationPermission;
    }),
  };
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: notification,
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function teardown() {
  vi.unstubAllEnvs();
  cleanup();
  delete (window.navigator as { serviceWorker?: unknown }).serviceWorker;
  delete (window.navigator as { standalone?: unknown }).standalone;
  delete (window.navigator as { userAgent?: unknown }).userAgent;
  delete (window as { PushManager?: unknown }).PushManager;
  delete (window as { Notification?: unknown }).Notification;
  delete (window as { matchMedia?: unknown }).matchMedia;
}

describe("PushToggle — görünürlük ve destek durumları (AC-6, AC-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(savePushSubscription).mockResolvedValue({ ok: true });
    vi.mocked(deletePushSubscription).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    teardown();
  });

  it("NEXT_PUBLIC_VAPID_PUBLIC_KEY yoksa hiçbir şey render etmez (AC-6)", () => {
    setup({ vapid: false });

    const { container } = render(<PushToggle />);

    expect(container).toBeEmptyDOMElement();
  });

  it("serviceWorker API'si yoksa 'Bu tarayıcı bildirim desteklemiyor' gösterir (AC-6)", async () => {
    setup({ serviceWorker: false });

    render(<PushToggle />);

    expect(
      await screen.findByText(/Bu tarayıcı bildirim desteklemiyor/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Bildirimleri (aç|kapat)/ }),
    ).toBeNull();
  });

  it("PushManager yoksa 'Bu tarayıcı bildirim desteklemiyor' gösterir (AC-6)", async () => {
    setup({ pushManager: false });

    render(<PushToggle />);

    expect(
      await screen.findByText(/Bu tarayıcı bildirim desteklemiyor/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Bildirimleri (aç|kapat)/ }),
    ).toBeNull();
  });

  it("iPhone + standalone değil: 'Ana Ekrana Ekle' rehberi gösterir, aç butonu yok (AC-5)", async () => {
    setup({ userAgent: IPHONE_UA, standalone: false, permission: "default" });

    render(<PushToggle />);

    expect(await screen.findByText(/Ana Ekrana Ekle/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Bildirimleri aç/ }),
    ).toBeNull();
  });

  it("iPhone + standalone (ana ekrandan açık): rehber yok, 'Bildirimleri aç' butonu görünür (AC-5)", async () => {
    setup({ userAgent: IPHONE_UA, standalone: true, permission: "default" });

    render(<PushToggle />);

    expect(
      await screen.findByRole("button", { name: "Bildirimleri aç" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ana Ekrana Ekle/)).toBeNull();
  });

  it("izin 'denied' ise 'Tarayıcı ayarlarından bildirime izin verin' gösterir (AC-6)", async () => {
    setup({ permission: "denied" });

    render(<PushToggle />);

    expect(
      await screen.findByText(/Tarayıcı ayarlarından bildirime izin verin/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Bildirimleri aç/ }),
    ).toBeNull();
  });

  it("izin 'default' ise 'Bildirimleri aç' butonu görünür", async () => {
    setup({ permission: "default" });

    render(<PushToggle />);

    expect(
      await screen.findByRole("button", { name: "Bildirimleri aç" }),
    ).toBeInTheDocument();
  });

  it("mount sırasında otomatik izin istemi yok: requestPermission, subscribe ve save çağrılmaz (AC-1)", async () => {
    setup({ permission: "default" });

    render(<PushToggle />);
    await act(async () => {});

    expect(notification.requestPermission).not.toHaveBeenCalled();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(savePushSubscription).not.toHaveBeenCalled();
  });
});

describe("PushToggle — abone olma akışı (AC-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(savePushSubscription).mockResolvedValue({ ok: true });
    vi.mocked(deletePushSubscription).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    teardown();
  });

  it("'Bildirimleri aç' → izin + subscribe + savePushSubscription(endpoint, keys) ve buton 'Bildirimleri kapat' olur; agent_id gönderilmez", async () => {
    setup({ permission: "default" });

    render(<PushToggle />);
    fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri aç" }));

    expect(
      await screen.findByRole("button", { name: "Bildirimleri kapat" }),
    ).toBeInTheDocument();

    expect(notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );

    // Sözleşme: yalnız endpoint + keys. agent_id istemciden GÖNDERİLMEZ (AC-S1).
    expect(savePushSubscription).toHaveBeenCalledTimes(1);
    expect(savePushSubscription).toHaveBeenCalledWith({
      endpoint: ENDPOINT,
      keys: {
        p256dh: expect.any(String),
        auth: expect.any(String),
      },
    });
    const sent = vi.mocked(savePushSubscription).mock.calls[0][0];
    expect(sent).not.toHaveProperty("agent_id");
    expect(JSON.stringify(sent)).not.toContain("agent_id");
  });

  it("save {ok:false} dönerse 'Bildirimler açılamadı' mesajı gösterilir ve 'Bildirimleri kapat' görünmez (AC-1, sözleşme 4)", async () => {
    setup({ permission: "default" });
    vi.mocked(savePushSubscription).mockResolvedValue({
      ok: false,
      error: "save_failed",
    });

    render(<PushToggle />);
    fireEvent.click(await screen.findByRole("button", { name: "Bildirimleri aç" }));

    expect(
      await screen.findByText(/Bildirimler açılamadı/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Bildirimleri kapat" }),
    ).toBeNull();
  });
});

describe("PushToggle — kapatma akışı (AC-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(savePushSubscription).mockResolvedValue({ ok: true });
    vi.mocked(deletePushSubscription).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    teardown();
  });

  it("abone iken 'Bildirimleri kapat' → tarayıcı aboneliği iptal + deletePushSubscription(endpoint) ve buton 'Bildirimleri aç' olur", async () => {
    setup({ permission: "granted", subscribed: true });

    render(<PushToggle />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Bildirimleri kapat" }),
    );

    expect(
      await screen.findByRole("button", { name: "Bildirimleri aç" }),
    ).toBeInTheDocument();

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(deletePushSubscription).toHaveBeenCalledTimes(1);
    expect(deletePushSubscription).toHaveBeenCalledWith({ endpoint: ENDPOINT });
  });
});

// Red-team (paylaşılan cihaz): tarayıcıda abonelik var, DB satırı başka agent'a ait.
describe("PushToggle — paylaşılan cihaz sahipliği (red-team, medium)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPushRegistrationStatus).mockResolvedValue({ ok: true, mine: true });
    vi.mocked(savePushSubscription).mockResolvedValue({ ok: true });
    vi.mocked(deletePushSubscription).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    teardown();
  });

  it("mevcut abonelik + mine:false → savePushSubscription(endpoint, keys) çağrılır, sahiplik devralınır ve 'Bildirimleri kapat' gösterilir", async () => {
    setup({ permission: "granted", subscribed: true });
    vi.mocked(getPushRegistrationStatus).mockResolvedValue({ ok: true, mine: false });

    render(<PushToggle />);

    expect(
      await screen.findByRole("button", { name: "Bildirimleri kapat" }),
    ).toBeInTheDocument();
    expect(getPushRegistrationStatus).toHaveBeenCalledWith({ endpoint: ENDPOINT });
    expect(savePushSubscription).toHaveBeenCalledTimes(1);
    expect(savePushSubscription).toHaveBeenCalledWith({
      endpoint: ENDPOINT,
      keys: { p256dh: "P256DH_TEST_KEY", auth: "AUTH_TEST_KEY" },
    });
    // Tarayıcı aboneliği korunur; yalnız sahiplik aktarılır.
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("mevcut abonelik + mine:false + save başarısız → 'Bildirimleri aç' gösterilir (kapat yok)", async () => {
    setup({ permission: "granted", subscribed: true });
    vi.mocked(getPushRegistrationStatus).mockResolvedValue({ ok: true, mine: false });
    vi.mocked(savePushSubscription).mockResolvedValue({ ok: false, error: "save_failed" });

    render(<PushToggle />);

    expect(
      await screen.findByRole("button", { name: "Bildirimleri aç" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Bildirimleri kapat" }),
    ).toBeNull();
  });

  it("mevcut abonelik + mine:true → save çağrılmaz, 'Bildirimleri kapat' gösterilir", async () => {
    setup({ permission: "granted", subscribed: true });

    render(<PushToggle />);

    expect(
      await screen.findByRole("button", { name: "Bildirimleri kapat" }),
    ).toBeInTheDocument();
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it("sahiplik sorgusu başarısız ({ok:false}) → save çağrılmaz, 'Bildirimleri aç' gösterilir", async () => {
    setup({ permission: "granted", subscribed: true });
    vi.mocked(getPushRegistrationStatus).mockResolvedValue({ ok: false, error: "status_failed" });

    render(<PushToggle />);

    expect(
      await screen.findByRole("button", { name: "Bildirimleri aç" }),
    ).toBeInTheDocument();
    expect(savePushSubscription).not.toHaveBeenCalled();
  });
});

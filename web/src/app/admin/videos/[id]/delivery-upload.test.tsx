// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { confirmDelivery, requestDeliveryUploadUrl } from "../actions";

import { DeliveryUpload } from "./delivery-upload";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("../actions", () => ({
  requestDeliveryUploadUrl: vi.fn(),
  confirmDelivery: vi.fn(),
}));

const ORDER_ID = "order-1";
const SIGNED_URL = "https://storage.example/upload/signed?token=t";
const PATH = "prop-1/order-1/0f0f0f0f-1111-4222-8333-444444444444.mp4";
const MAX_FILE_BYTES = 52428800;

// Tarayıcı XHR'ı yerine: send() çağrılınca ilerleme ve başarılı yanıt üretir.
class FakeXHR {
  static instances: FakeXHR[] = [];
  upload: { onprogress: ((event: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 0;
  method = "";
  url = "";
  headers: Record<string, string> = {};

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  send() {
    FakeXHR.instances.push(this);
    this.status = 200;
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
      this.onload?.();
    }, 0);
  }
}

function video(name = "teslim.mp4", type = "video/mp4") {
  return new File(["x"], name, { type });
}

function selectFile(file: File) {
  fireEvent.change(screen.getByLabelText("Teslim videosunu seçin"), {
    target: { files: [file] },
  });
}

describe("DeliveryUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    vi.mocked(requestDeliveryUploadUrl).mockResolvedValue({
      ok: true,
      path: PATH,
      signedUrl: SIGNED_URL,
      token: "t",
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // AC-S3 / AC-8: desteklenmeyen tür yüklenmeden reddedilir.
  it("MP4/MOV/WEBM dışındaki dosyayı yüklemeden açık Türkçe hatayla reddeder", async () => {
    render(<DeliveryUpload orderId={ORDER_ID} />);

    selectFile(new File(["%PDF"], "rapor.pdf", { type: "application/pdf" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /rapor\.pdf desteklenmiyor\. Yalnızca MP4, MOV veya WEBM/,
    );
    expect(requestDeliveryUploadUrl).not.toHaveBeenCalled();
    expect(FakeXHR.instances).toHaveLength(0);
  });

  it("limitten büyük dosyayı yüklemeden boyut hatasıyla reddeder", async () => {
    render(<DeliveryUpload orderId={ORDER_ID} />);

    const big = video("dev.mp4");
    Object.defineProperty(big, "size", { value: MAX_FILE_BYTES + 1 });
    selectFile(big);

    expect(await screen.findByRole("alert")).toHaveTextContent(/dev\.mp4 çok büyük/);
    expect(requestDeliveryUploadUrl).not.toHaveBeenCalled();
  });

  // AC-8: imzalı URL'ye PUT başarılı → confirmDelivery(orderId, path) → refresh.
  it("imzalı URL'ye XHR ile yükler, başarıda confirmDelivery çağırır ve sayfayı yeniler", async () => {
    vi.mocked(confirmDelivery).mockResolvedValue({ ok: true });
    render(<DeliveryUpload orderId={ORDER_ID} />);

    selectFile(video());

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(requestDeliveryUploadUrl).toHaveBeenCalledWith(ORDER_ID, {
      name: "teslim.mp4",
      type: "video/mp4",
      size: 1,
    });
    expect(FakeXHR.instances).toHaveLength(1);
    const xhr = FakeXHR.instances[0];
    expect(xhr.method).toBe("PUT");
    expect(xhr.url).toBe(SIGNED_URL);
    expect(xhr.headers["content-type"]).toBe("video/mp4");
    expect(xhr.headers["x-upsert"]).toBe("false");
    expect(confirmDelivery).toHaveBeenCalledWith(ORDER_ID, PATH);
  });

  // AC-8: confirm başarısızsa hata + "Tekrar dene"; tekrar denemede yeni imzalı URL istenir.
  it("confirmDelivery hata dönerse mesajı ve 'Tekrar dene' butonunu gösterir", async () => {
    vi.mocked(confirmDelivery)
      .mockResolvedValueOnce({
        ok: false,
        error: "INVALID_STATE",
        message: "Bu sipariş artık teslim edilemez.",
      })
      .mockResolvedValueOnce({ ok: true });
    render(<DeliveryUpload orderId={ORDER_ID} />);

    selectFile(video());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bu sipariş artık teslim edilemez.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(requestDeliveryUploadUrl).toHaveBeenCalledTimes(2);
  });

  it("yükleme sürerken role=progressbar ile ilerlemeyi gösterir", async () => {
    // Yükleme hiç tamamlanmayan XHR: çubuk görünür kalır.
    class PendingXHR extends FakeXHR {
      send() {
        FakeXHR.instances.push(this);
      }
    }
    vi.stubGlobal("XMLHttpRequest", PendingXHR);
    render(<DeliveryUpload orderId={ORDER_ID} />);

    selectFile(video());

    const bar = await screen.findByRole("progressbar", { name: "teslim.mp4 yükleniyor" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(confirmDelivery).not.toHaveBeenCalled();
  });
});

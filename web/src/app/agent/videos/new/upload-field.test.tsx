// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { confirmUpload, requestUploadUrl } from "../actions";

import { UploadField } from "./upload-field";

vi.mock("../actions", () => ({
  requestUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  removeAsset: vi.fn(),
  createVideoOrder: vi.fn(),
  submitVideoOrder: vi.fn(),
}));

const MAX_PHOTO_BYTES = 20971520;

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

function photo(name: string, size = 4) {
  return new File(["x".repeat(size)], name, { type: "image/jpeg" });
}

function selectFiles(files: File[]) {
  const input = screen.getByLabelText("Fotoğrafları seçin") as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

function renderField(overrides: Partial<Parameters<typeof UploadField>[0]> = {}) {
  const onChange = vi.fn();
  const onBusyChange = vi.fn();
  render(
    <UploadField
      orderId="order-1"
      kind="photo"
      maxCount={30}
      maxBytes={MAX_PHOTO_BYTES}
      onChange={onChange}
      onBusyChange={onBusyChange}
      {...overrides}
    />,
  );
  return { onChange, onBusyChange };
}

describe("UploadField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // AC-4: desteklenmeyen tür yüklenmeden reddedilir.
  it("desteklenmeyen dosya türünü yüklemeden açık Türkçe hatayla reddeder", async () => {
    renderField();

    selectFiles([new File(["%PDF"], "belge.pdf", { type: "application/pdf" })]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /belge\.pdf desteklenmiyor\. Yalnızca JPG, PNG, WEBP veya HEIC/,
    );
    expect(requestUploadUrl).not.toHaveBeenCalled();
    expect(FakeXHR.instances).toHaveLength(0);
  });

  it("çok büyük dosyayı yüklemeden boyut hatasıyla reddeder", async () => {
    renderField({ maxBytes: 10 });

    selectFiles([photo("buyuk.jpg", 11)]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/buyuk\.jpg çok büyük/);
    expect(requestUploadUrl).not.toHaveBeenCalled();
  });

  // AC-S3 / sayı sınırı: limit aşılınca fazla dosya eklenmez.
  it("limit aşımında fazla dosyayı eklemez", async () => {
    vi.mocked(requestUploadUrl).mockReturnValue(new Promise(() => {}));
    renderField({ maxCount: 2 });

    selectFiles([photo("1.jpg"), photo("2.jpg"), photo("3.jpg")]);

    expect(await screen.findByText(/3\.jpg eklenmedi\. En fazla 2 fotoğraf/)).toBeInTheDocument();
    await waitFor(() => expect(requestUploadUrl).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("3.jpg")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  // AC-4: XHR ile imzalı URL'ye PUT, başarılıysa confirmUpload çağrılır.
  it("yükleme başarılıysa imzalı URL'ye PUT yapar ve confirmUpload çağırır", async () => {
    vi.mocked(requestUploadUrl).mockResolvedValue({
      ok: true,
      assetId: "a-1",
      path: "agent-1/order-1/a-1.jpg",
      signedUrl: "https://storage.example/upload?token=t",
      token: "t",
    });
    vi.mocked(confirmUpload).mockResolvedValue({ ok: true, assetId: "a-1" });
    const { onChange } = renderField();

    selectFiles([photo("oda.jpg", 4)]);

    await waitFor(() =>
      expect(confirmUpload).toHaveBeenCalledWith("order-1", "agent-1/order-1/a-1.jpg", 4),
    );
    expect(requestUploadUrl).toHaveBeenCalledWith("order-1", {
      name: "oda.jpg",
      type: "image/jpeg",
      size: 4,
    });

    const xhr = FakeXHR.instances[0];
    expect(xhr.method).toBe("PUT");
    expect(xhr.url).toBe("https://storage.example/upload?token=t");
    expect(xhr.headers["content-type"]).toBe("image/jpeg");
    expect(xhr.headers["x-upsert"]).toBe("false");

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(1));
    expect(await screen.findByText("Yüklendi")).toBeInTheDocument();
  });

  it("sunucu hata dönerse satırda hata mesajı ve Tekrar dene butonu gösterilir", async () => {
    vi.mocked(requestUploadUrl).mockResolvedValue({
      ok: false,
      error: "LIMIT_REACHED",
      message: "Bu sipariş için dosya sınırına ulaştınız.",
    });
    renderField();

    selectFiles([photo("hata.jpg")]);

    expect(await screen.findByText("Bu sipariş için dosya sınırına ulaştınız.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    expect(confirmUpload).not.toHaveBeenCalled();
  });
});

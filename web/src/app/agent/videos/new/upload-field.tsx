"use client";

import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ASSET_RULES, type AssetKind } from "@/lib/video-orders/limits";

import { confirmUpload, removeAsset, requestUploadUrl } from "../actions";

const MAX_PARALLEL_UPLOADS = 2;
const MEGABYTE = 1048576;
const NETWORK_ERROR = "Dosya yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
const GENERIC_ERROR = "Bir hata oluştu, lütfen tekrar deneyin.";

const KIND_COPY: Record<AssetKind, { pick: string; allowed: string; noun: string }> = {
  photo: { pick: "Fotoğrafları seçin", allowed: "JPG, PNG, WEBP veya HEIC", noun: "fotoğraf" },
  raw_video: { pick: "Videoları seçin", allowed: "MP4, MOV veya WEBM", noun: "video" },
};

type ItemStatus = "queued" | "uploading" | "done" | "removing" | "error";

type UploadItem = {
  localId: string;
  file: File;
  status: ItemStatus;
  progress: number;
  assetId: string | null;
  error: string | null;
};

type UploadFieldProps = {
  orderId: string;
  kind: AssetKind;
  maxCount: number;
  maxBytes: number;
  onChange: (completed: number) => void;
  onBusyChange: (busy: boolean) => void;
};

function megabyteLabel(bytes: number): string {
  return `${Math.round(bytes / MEGABYTE)} MB`;
}

function putFile(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

export function UploadField({
  orderId,
  kind,
  maxCount,
  maxBytes,
  onChange,
  onBusyChange,
}: UploadFieldProps) {
  const inputId = useId();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const queueRef = useRef<UploadItem[]>([]);
  const activeRef = useRef(0);
  const idRef = useRef(0);

  const rules = ASSET_RULES[kind];
  const copy = KIND_COPY[kind];

  const completed = items.filter((item) => item.status === "done").length;
  const busy = items.some(
    (item) => item.status === "queued" || item.status === "uploading" || item.status === "removing",
  );
  const used = items.filter((item) => item.status !== "error").length;
  const remaining = maxCount - used;

  useEffect(() => {
    onChange(completed);
  }, [completed, onChange]);

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  function patch(localId: string, changes: Partial<UploadItem>) {
    setItems((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...changes } : item)),
    );
  }

  function fail(localId: string, message: string) {
    patch(localId, { status: "error", progress: 0, error: message });
  }

  async function runUpload(item: UploadItem) {
    patch(item.localId, { status: "uploading", progress: 0, error: null });
    try {
      const started = await requestUploadUrl(orderId, {
        name: item.file.name,
        type: item.file.type,
        size: item.file.size,
      });
      if (!started.ok) {
        fail(item.localId, started.message);
        return;
      }

      await putFile(started.signedUrl, item.file, (progress) =>
        patch(item.localId, { progress }),
      );

      const confirmed = await confirmUpload(orderId, started.path, item.file.size);
      if (!confirmed.ok) {
        fail(item.localId, confirmed.message);
        return;
      }
      patch(item.localId, { status: "done", progress: 100, assetId: confirmed.assetId });
    } catch {
      fail(item.localId, NETWORK_ERROR);
    }
  }

  function pump() {
    while (activeRef.current < MAX_PARALLEL_UPLOADS && queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (!next) break;
      activeRef.current += 1;
      void runUpload(next).finally(() => {
        activeRef.current -= 1;
        pump();
      });
    }
  }

  function checkFile(file: File): string | null {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!rules.mimeTypes.includes(file.type) || !rules.extensions.includes(extension)) {
      return `${file.name} desteklenmiyor. Yalnızca ${copy.allowed} yükleyebilirsiniz.`;
    }
    if (file.size > maxBytes) {
      return `${file.name} çok büyük. Dosya başı en fazla ${megabyteLabel(maxBytes)} olabilir.`;
    }
    return null;
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    input.value = "";

    const messages: string[] = [];
    const accepted: UploadItem[] = [];
    let slots = remaining;
    for (const file of files) {
      const problem = checkFile(file);
      if (problem) {
        messages.push(problem);
        continue;
      }
      if (slots <= 0) {
        messages.push(
          `${file.name} eklenmedi. En fazla ${maxCount} ${copy.noun} yükleyebilirsiniz.`,
        );
        continue;
      }
      slots -= 1;
      idRef.current += 1;
      accepted.push({
        localId: String(idRef.current),
        file,
        status: "queued",
        progress: 0,
        assetId: null,
        error: null,
      });
    }

    setProblems(messages);
    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted]);
      queueRef.current.push(...accepted);
      pump();
    }
  }

  function retry(localId: string) {
    const item = items.find((entry) => entry.localId === localId);
    if (!item) return;
    patch(localId, { status: "queued", progress: 0, error: null });
    queueRef.current.push({ ...item, status: "queued", progress: 0, error: null });
    pump();
  }

  async function remove(localId: string) {
    const item = items.find((entry) => entry.localId === localId);
    if (!item) return;

    if (item.status === "done" && item.assetId) {
      patch(localId, { status: "removing", error: null });
      try {
        const result = await removeAsset(orderId, item.assetId);
        if (!result.ok) {
          patch(localId, { status: "done", error: result.message });
          return;
        }
      } catch {
        patch(localId, { status: "done", error: GENERIC_ERROR });
        return;
      }
    }

    queueRef.current = queueRef.current.filter((entry) => entry.localId !== localId);
    setItems((prev) => prev.filter((entry) => entry.localId !== localId));
  }

  const accept = [...rules.mimeTypes, ...rules.extensions.map((ext) => `.${ext}`)].join(",");

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={inputId} className="font-medium">
        {copy.pick}
      </label>
      <input
        id={inputId}
        type="file"
        multiple
        accept={accept}
        disabled={remaining <= 0}
        onChange={handleSelect}
        className="block min-h-14 w-full cursor-pointer rounded-md border border-mist-200 bg-white text-base file:mr-4 file:min-h-12 file:cursor-pointer file:rounded-md file:border-0 file:bg-terracotta-600 file:px-5 file:font-medium file:text-white hover:file:bg-terracotta-700 disabled:opacity-50"
      />
      <p className="text-sm text-slate-500">
        {copy.allowed} · Dosya başı en fazla {megabyteLabel(maxBytes)}
      </p>

      {problems.length > 0 && (
        <Alert variant="error">
          {problems.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </Alert>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.localId}
              className="flex flex-col gap-2 rounded-md border border-mist-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">{item.file.name}</span>
                <span
                  className={`shrink-0 text-sm ${item.status === "done" ? "text-moss-700" : item.status === "error" ? "text-brick-700" : "text-slate-500"}`}
                >
                  {statusText(item)}
                </span>
              </div>
              {item.status === "uploading" && (
                <div
                  role="progressbar"
                  aria-label={`${item.file.name} yükleniyor`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={item.progress}
                  className="h-2 w-full overflow-hidden rounded-full bg-mist-200"
                >
                  <div
                    className="h-full bg-terracotta-600"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.error && <p className="text-sm text-brick-700">{item.error}</p>}
              {item.status !== "uploading" && item.status !== "removing" && (
                <div className="flex gap-2">
                  {item.status === "error" && (
                    <Button
                      variant="secondary"
                      className="min-h-11"
                      onClick={() => retry(item.localId)}
                    >
                      Tekrar dene
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => remove(item.localId)}
                  >
                    Kaldır
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusText(item: UploadItem): string {
  switch (item.status) {
    case "queued":
      return "Sırada";
    case "uploading":
      return `%${item.progress}`;
    case "done":
      return "Yüklendi";
    case "removing":
      return "Kaldırılıyor";
    case "error":
      return "Yüklenemedi";
  }
}

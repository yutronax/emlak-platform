"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ASSET_RULES, MAX_FILE_BYTES } from "@/lib/video-orders/limits";

import { confirmDelivery, requestDeliveryUploadUrl } from "../actions";

const RULES = ASSET_RULES.raw_video;
const MEGABYTE = 1048576;
const NETWORK_ERROR = "Video yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";

type Phase = "idle" | "uploading" | "confirming" | "error";

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

function checkFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!RULES.mimeTypes.includes(file.type) || !RULES.extensions.includes(extension)) {
    return `${file.name} desteklenmiyor. Yalnızca MP4, MOV veya WEBM yükleyebilirsiniz.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} çok büyük. Dosya en fazla ${Math.round(MAX_FILE_BYTES / MEGABYTE)} MB olabilir.`;
  }
  return null;
}

export function DeliveryUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function fail(message: string) {
    setError(message);
    setPhase("error");
  }

  async function upload(target: File) {
    setFile(target);
    setPhase("uploading");
    setProgress(0);
    setError(null);
    try {
      const started = await requestDeliveryUploadUrl(orderId, {
        name: target.name,
        type: target.type,
        size: target.size,
      });
      if (!started.ok) {
        fail(started.message);
        return;
      }

      await putFile(started.signedUrl, target, setProgress);

      setPhase("confirming");
      const confirmed = await confirmDelivery(orderId, started.path);
      if (!confirmed.ok) {
        fail(confirmed.message);
        return;
      }
      setPhase("idle");
      router.refresh();
    } catch {
      fail(NETWORK_ERROR);
    }
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const selected = input.files?.[0];
    input.value = "";
    if (!selected) return;

    const problem = checkFile(selected);
    if (problem) {
      setFile(null);
      fail(problem);
      return;
    }
    void upload(selected);
  }

  const busy = phase === "uploading" || phase === "confirming";

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={inputId} className="font-medium">
        Teslim videosunu seçin
      </label>
      <input
        id={inputId}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        disabled={busy}
        onChange={handleSelect}
        className="block min-h-14 w-full cursor-pointer rounded-md border border-mist-200 bg-white text-base file:mr-4 file:min-h-12 file:cursor-pointer file:rounded-md file:border-0 file:bg-terracotta-600 file:px-5 file:font-medium file:text-white hover:file:bg-terracotta-700 disabled:opacity-50"
      />
      <p className="text-sm text-slate-500">MP4, MOV veya WEBM · En fazla 50 MB</p>

      {phase === "uploading" && file && (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label={`${file.name} yükleniyor`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 w-full overflow-hidden rounded-full bg-mist-200"
          >
            <div className="h-full bg-terracotta-600" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-slate-500">%{progress}</p>
        </div>
      )}

      {phase === "confirming" && (
        <p className="text-sm text-slate-500">Yükleme tamamlandı, teslim kaydediliyor...</p>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {phase === "error" && file && (
        <Button
          variant="secondary"
          className="min-h-11 self-start"
          onClick={() => void upload(file)}
        >
          Tekrar dene
        </Button>
      )}
    </div>
  );
}

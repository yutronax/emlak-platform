"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { getAssetDownloadUrl } from "../actions";

const GENERIC_ERROR = "İndirme bağlantısı alınamadı, lütfen tekrar deneyin.";

type AssetDownloadButtonProps = {
  orderId: string;
  assetId: string;
  label: string;
};

export function AssetDownloadButton({ orderId, assetId, label }: AssetDownloadButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    try {
      const result = await getAssetDownloadUrl(orderId, assetId);
      if (result.ok) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setError(result.message);
      }
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <Button
        variant="secondary"
        className="min-h-11"
        isPending={pending}
        onClick={download}
        aria-label={`${label} indir`}
      >
        İndir
      </Button>
      {error && (
        <p role="alert" className="text-sm text-brick-700">
          {error}
        </p>
      )}
    </div>
  );
}

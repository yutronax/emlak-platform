"use client";

import { useState } from "react";

import { getConfirmService } from "@/lib/confirm-ui/service";

import { ConfirmView, type ConfirmState } from "./confirm-view";

// Servis nesnesi sunucudan prop olarak geçemez; client'ta seçilir.
export function ConfirmClient({ state }: { state: ConfirmState }) {
  const [service] = useState(getConfirmService);
  return <ConfirmView state={state} service={service} />;
}

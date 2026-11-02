"use client";

import { useState } from "react";

import { getReviewService } from "@/lib/review-ui/service";

import { ReviewDesk } from "./review-desk";

// Servis nesnesi sunucudan prop olarak geçemez; client'ta seçilir.
export function ReviewClient() {
  const [service] = useState(getReviewService);
  if (!service) return null;
  return <ReviewDesk service={service} />;
}

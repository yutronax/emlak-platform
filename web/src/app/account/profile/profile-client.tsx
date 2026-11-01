"use client";

import { useState } from "react";

import { getProfileService } from "@/lib/profile-ui/service";

import { ProfileView } from "./profile-view";
import type { TabId } from "./tabs";

// Servis (fonksiyon içeren nesne) sunucudan client'a prop olarak geçemez; burada seçilir.
export function ProfileClient({ initialTab }: { initialTab?: TabId }) {
  const [service] = useState(getProfileService);
  if (!service) return null;
  return <ProfileView service={service} initialTab={initialTab} />;
}

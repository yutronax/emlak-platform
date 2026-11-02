import {
  changePassword,
  confirmLogo,
  createLogoUpload,
  loadProfile,
  removeLogo,
  requestEmailChange,
  signOutProfile,
  updateCompany,
  updateNotifications,
  updateWhatsapp,
} from "@/app/account/profile/actions";

import type { ProfileService } from "./types";

// Sunucu aksiyonlarının istemci sarmalayıcısı. Logo: imzalı adrese tarayıcıdan PUT, sonra yol onaylanır.
export const realProfileService: ProfileService = {
  kind: "real",
  load: () => loadProfile(),
  updateCompany: (input) => updateCompany(input),
  async uploadLogo(file) {
    const ticket = await createLogoUpload(file.type, file.size);
    if (ticket.status !== "ok") return ticket;
    try {
      const res = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "true" },
        body: file,
      });
      if (!res.ok) return { status: "error", code: "network" };
    } catch {
      return { status: "error", code: "network" };
    }
    return confirmLogo(ticket.path);
  },
  removeLogo: () => removeLogo(),
  updateWhatsapp: (phone) => updateWhatsapp(phone),
  requestEmailChange: (email) => requestEmailChange(email),
  changePassword: (input) => changePassword(input),
  updateNotifications: (prefs) => updateNotifications(prefs),
  signOut: (scope) => signOutProfile(scope),
};

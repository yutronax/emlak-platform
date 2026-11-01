import type { Profile, ProfileService, SaveResult } from "./types";

// Yalnız dev/test: NEXT_PUBLIC_PROFILE_MOCK=1. Uzun şirket adı başlık bandının sarılmasını zorlar.
// Tetikleyiciler: şirket adı "hata" → network; mevcut şifre "yanlis123" → wrong_password.
let profile: Profile = {
  companyName: "Karşıyaka Sahil Gayrimenkul Danışmanlık ve Yatırım Hizmetleri Limited Şirketi",
  contactName: "Ayşe Yılmaz",
  city: "İzmir",
  district: "Karşıyaka",
  logoUrl: null,
  email: "ayse@karsiyakasahil.com",
  pendingEmail: null,
  whatsappPhone: "+905321234567",
  notifications: { newListingPush: true, newListingEmail: false, videoOrderEmail: true, weeklySummaryEmail: false },
};

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms));

async function save(patch: Partial<Profile>): Promise<SaveResult> {
  await wait();
  profile = { ...profile, ...patch };
  return { status: "ok", profile };
}

export const mockProfileService: ProfileService = {
  kind: "mock",
  async load() {
    await wait();
    return { status: "ok", profile };
  },
  async updateCompany(input) {
    if (input.companyName.trim().toLowerCase() === "hata") {
      await wait();
      return { status: "error", code: "network" };
    }
    return save(input);
  },
  uploadLogo: (file) => save({ logoUrl: URL.createObjectURL(file) }),
  removeLogo: () => save({ logoUrl: null }),
  updateWhatsapp: (whatsappPhone) => save({ whatsappPhone }),
  requestEmailChange: (pendingEmail) => save({ pendingEmail }),
  async changePassword({ current }) {
    await wait();
    if (current === "yanlis123") return { status: "error", code: "wrong_password", field: "current" };
    return { status: "ok", profile };
  },
  updateNotifications: (notifications) => save({ notifications }),
  async signOut() {
    await wait(300);
    return { status: "ok", redirectTo: "/login" };
  },
};

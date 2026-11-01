// Profil ekranının servisten beklediği sözleşme (kullanici-profili/frontend_contract.md).

export type NotificationPrefs = {
  newListingPush: boolean;
  newListingEmail: boolean;
  videoOrderEmail: boolean;
  weeklySummaryEmail: boolean;
};

export type Profile = {
  companyName: string;
  contactName: string;
  city: string;
  district: string;
  logoUrl: string | null;
  email: string;
  // Onay bekleyen yeni adres; onaylanana kadar `email` geçerlidir.
  pendingEmail: string | null;
  // +90XXXXXXXXXX
  whatsappPhone: string | null;
  notifications: NotificationPrefs;
};

export type CompanyInput = Pick<Profile, "companyName" | "contactName" | "city" | "district">;

export type SaveError = {
  status: "error";
  code: "wrong_password" | "invalid" | "too_large" | "unsupported_type" | "network" | "unknown";
  field?: string;
  message?: string;
};

export type SaveResult = { status: "ok"; profile: Profile } | SaveError;

export interface ProfileService {
  kind: "mock" | "real";
  load(): Promise<{ status: "ok"; profile: Profile } | { status: "error" }>;
  updateCompany(input: CompanyInput): Promise<SaveResult>;
  uploadLogo(file: File): Promise<SaveResult>;
  removeLogo(): Promise<SaveResult>;
  updateWhatsapp(phone: string): Promise<SaveResult>;
  requestEmailChange(newEmail: string): Promise<SaveResult>;
  changePassword(input: { current: string; next: string }): Promise<SaveResult>;
  updateNotifications(prefs: NotificationPrefs): Promise<SaveResult>;
  signOut(scope: "this" | "all"): Promise<{ status: "ok"; redirectTo: string } | SaveError>;
}

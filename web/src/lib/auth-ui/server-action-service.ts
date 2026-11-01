import { login } from "@/app/(marketing)/login/actions";
import { signup } from "@/app/(marketing)/signup/actions";

import type { AuthResult, AuthService } from "./types";

// Mevcut server action'ları UI sözleşmesine çeviren adaptör. Başarılı girişte action
// redirect() atar ve bu fonksiyon dönmez; dönüş yalnızca hata yolundadır.

// redirect() Next'te özel bir hata olarak yayılır; ağ hatasıyla karıştırılmamalı.
const isRedirect = (err: unknown) =>
  typeof err === "object" && err !== null && String((err as { digest?: unknown }).digest ?? "").startsWith("NEXT_REDIRECT");

async function call<T>(fn: () => Promise<T>): Promise<T | AuthResult> {
  try {
    return await fn();
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { status: "error", code: "network" };
  }
}

export const serverActionService: AuthService = {
  kind: "server-action",
  capabilities: { google: false },

  async signIn({ email, password }) {
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    const res = await call(() => login(fd));
    if (res && "status" in res) return res;
    if (res && "error" in res) return { status: "error", code: "invalid_credentials", message: res.error };
    return { status: "error", code: "unknown" };
  },

  async signUp({ email, password, companyName, phone }) {
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    fd.set("company_name", companyName);
    fd.set("phone", phone);
    fd.set("terms", "on");
    const res = await call(() => signup(fd));
    if ("status" in res) return res;
    if ("error" in res) return { status: "error", code: "unknown", message: res.error };
    return { status: "check_email", email };
  },

  async signInWithGoogle() {
    return { status: "error", code: "unknown" };
  },
};

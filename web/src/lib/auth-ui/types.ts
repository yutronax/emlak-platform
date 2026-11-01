// UI'ın kimlik doğrulama servisinden beklediği sözleşme (frontend_contract.md).
// Component'ler yalnızca bu arayüzü kullanır; Supabase/fetch ayrıntısı adaptörde kalır.

export type AuthErrorCode =
  | "invalid_credentials"
  | "rate_limited"
  | "oauth_cancelled"
  | "network"
  | "unknown";

export type AuthField = "email" | "password" | "phone" | "company_name";

export type AuthResult =
  | { status: "ok"; redirectTo: string }
  // Kayıt alındı ama hesabın varlığı açıklanmaz (signup AC-S3): kullanıcı e-postasına bakar.
  | { status: "check_email"; email: string }
  | { status: "error"; code: AuthErrorCode; message?: string; field?: AuthField };

export type SignUpInput = {
  email: string;
  password: string;
  companyName: string;
  phone: string;
  termsAccepted: true;
};

export interface AuthService {
  kind: "server-action" | "mock";
  capabilities: { google: boolean };
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  signInWithGoogle(intent: "login" | "signup"): Promise<AuthResult>;
}

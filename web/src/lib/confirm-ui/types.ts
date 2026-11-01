// Onay e-postasını yeniden gönderme sözleşmesi (e-posta-onay-ekrani/frontend_contract.md).
export interface ConfirmService {
  kind: "mock" | "real";
  // Sonuç hesabın varlığını açıklamaz: kayıtlı olmayan adres için de "ok".
  resend(email: string): Promise<{ status: "ok" } | { status: "error"; code: "network" | "rate_limited" }>;
}

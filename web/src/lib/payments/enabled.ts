// Kartla ödeme (iyzico) şirket kurulana kadar kapalı. Açmak için NEXT_PUBLIC_PAYMENTS_ENABLED=1.
// Kapalıyken: abonelik yalnız deneme + admin elle uzatma; video ödemesi admin "ödeme alındı" ile.
export function paymentsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "1";
}

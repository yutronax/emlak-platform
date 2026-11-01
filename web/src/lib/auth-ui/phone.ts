// Türkiye cep numarası: ulusal kısım 10 hane ve 5 ile başlar.

function nationalDigits(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function normalizeTrPhone(input: string): string | null {
  const digits = nationalDigits(input);
  return /^5\d{9}$/.test(digits) ? `+90${digits}` : null;
}

// Yazarken "5xx xxx xx xx" biçimi.
export function formatTrPhone(input: string): string {
  const d = nationalDigits(input).slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(" ");
}

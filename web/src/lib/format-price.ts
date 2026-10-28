const tryFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatTryMinor(minorUnit: number): string {
  return `${tryFormat.format(minorUnit / 100)} ₺`;
}

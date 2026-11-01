export type PasswordLevel = "weak" | "medium" | "strong";

export const LEVEL_LABEL: Record<PasswordLevel, string> = {
  weak: "Zayıf",
  medium: "Orta",
  strong: "Güçlü",
};

export function checkPassword(password: string) {
  const longEnough = password.length >= 8;
  const rules = [
    { label: "En az 8 karakter", ok: longEnough },
    { label: "Bir harf", ok: /\p{L}/u.test(password) },
    { label: "Bir rakam", ok: /\d/.test(password) },
    {
      label: "Büyük ve küçük harf ya da bir sembol",
      ok: (/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password)) || /[^\p{L}\d\s]/u.test(password),
    },
  ];
  const score = rules.filter((r) => r.ok).length;
  const level: PasswordLevel = !longEnough || score <= 2 ? "weak" : score === 3 ? "medium" : "strong";
  return { rules, level, acceptable: level !== "weak" };
}

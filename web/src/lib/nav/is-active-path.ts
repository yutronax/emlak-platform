// Sondaki slash'ı at; kök "/" olduğu gibi kalır.
function normalize(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0] ?? "";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.replace(/\/+$/, "") || "/";
  }
  return withoutQuery || "/";
}

// Nav linki, mevcut pathname ile eşleşiyor mu?
// - "/" yalnız tam eşleşmede aktif (her sayfada aktif olmasın).
// - Diğer hedefler tam eşleşme veya "href/..." alt yolu ile aktif.
export function isActivePath(pathname: string, href: string): boolean {
  // Boş pathname (route bilinmiyor) hiçbir linki aktif yapmaz; "/" ile eşleşmesin.
  if (pathname.split(/[?#]/)[0] === "") return false;

  const current = normalize(pathname);
  const target = normalize(href);

  if (target === "/") return current === "/";

  return current === target || current.startsWith(`${target}/`);
}

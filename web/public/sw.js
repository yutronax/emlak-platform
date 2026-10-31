// Web Push service worker (EML-101 / AC-S6).
// Yalnız push ve notificationclick işler. fetch dinleyicisi YOK (cache/proxy yok).

const DEFAULT_URL = "/agent/dashboard";
const DEFAULT_TITLE = "Yeni ilanlar";
const ICON_URL = "/icons/icon.svg";

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title =
    data && typeof data.title === "string" && data.title.length > 0
      ? data.title
      : DEFAULT_TITLE;
  const body = data && typeof data.body === "string" ? data.body : "";
  const url = safeTarget(data && data.url);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON_URL,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeTarget(
    event.notification.data && event.notification.data.url,
  );
  const absolute = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if (typeof client.navigate === "function") {
            try {
              await client.navigate(absolute);
            } catch {
              // Navigate reddedilirse pencere odaklı kalır.
            }
          }
          return;
        }
      }
      return self.clients.openWindow(absolute);
    })(),
  );
});

// Yalnız aynı origin'deki yol kabul edilir; mutlak dış URL ve geçersiz değer
// /agent/dashboard'a düşer.
function safeTarget(raw) {
  if (typeof raw !== "string" || raw.length === 0) return DEFAULT_URL;
  try {
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return DEFAULT_URL;
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_URL;
  }
}

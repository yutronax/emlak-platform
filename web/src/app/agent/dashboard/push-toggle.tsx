"use client";

import { useEffect, useState } from "react";

import {
  deletePushSubscription,
  getPushRegistrationStatus,
  savePushSubscription,
} from "./push-actions";

// EML-101 / AC-1, AC-4, AC-5, AC-6. Sunucuya yalnız endpoint + keys gider;
// agent_id istemciden gönderilmez (AC-S1).

type Status =
  | "checking"
  | "unsupported"
  | "ios-browser"
  | "default"
  | "denied"
  | "subscribed"
  | "busy"
  | "error";

const ENABLE_ERROR = "Bildirimler açılamadı, tekrar deneyin.";
const DISABLE_ERROR = "Bildirimler kapatılamadı, tekrar deneyin.";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function supportsPush(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Paylaşılan cihaz: tarayıcıda abonelik var ama DB satırı bu kullanıcıya ait değilse
 * sahipliği devralır (endpoint + keys sunmak cihaza sahip olmanın kanıtı).
 * Devralınamazsa false döner; kullanıcı yeniden "Bildirimleri aç" ile deneyebilir.
 */
async function ensureOwnership(sub: PushSubscription): Promise<boolean> {
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) return false;

  try {
    const status = await getPushRegistrationStatus({ endpoint });
    if (!status.ok) return false;
    if (status.mine) return true;

    const result = await savePushSubscription({
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
    });
    return result.ok;
  } catch {
    return false;
  }
}

// iOS tarayıcı sekmesinde Web Push yok; önce ana ekran rehberi gösterilir.
async function detectStatus(): Promise<Status> {
  try {
    if (isIos() && !isStandalone()) return "ios-browser";
    if (!supportsPush()) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return "default";
    return (await ensureOwnership(sub)) ? "subscribed" : "default";
  } catch {
    return "unsupported";
  }
}

export function PushToggle() {
  // NEXT_PUBLIC_ değişkeni build zamanında gömülür; render anında okunur.
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidKey) return;
    let cancelled = false;
    detectStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  async function enable(key: string) {
    setStatus("busy");
    setMessage(null);
    let sub: PushSubscription | null = null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const { endpoint, keys } = sub.toJSON();
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error("invalid_subscription");
      }
      const result = await savePushSubscription({
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      });
      if (!result.ok) {
        await sub.unsubscribe();
        setStatus("error");
        setMessage(ENABLE_ERROR);
        return;
      }
      setStatus("subscribed");
    } catch {
      if (sub) await sub.unsubscribe().catch(() => undefined);
      setStatus("error");
      setMessage(ENABLE_ERROR);
    }
  }

  async function disable() {
    setStatus("busy");
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (!sub) {
        setStatus("default");
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const result = await deletePushSubscription({ endpoint });
      if (!result.ok) {
        // Tarayıcı aboneliği zaten iptal edildi; kullanıcı yeniden açabilir.
        setStatus("error");
        setMessage(DISABLE_ERROR);
        return;
      }
      setStatus("default");
    } catch {
      setStatus("error");
      setMessage(DISABLE_ERROR);
    }
  }

  if (!vapidKey) return null;
  if (status === "checking") return null;

  const buttonClass =
    "rounded-md border border-mist-200 px-3 py-2 text-sm text-ink-900 hover:bg-mist-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:opacity-60";

  if (status === "unsupported") {
    return <p className="text-sm text-slate-500">Bu tarayıcı bildirim desteklemiyor.</p>;
  }

  if (status === "ios-browser") {
    return (
      <div className="max-w-xs text-sm text-slate-500">
        <p>Bildirimleri almak için uygulamayı iPhone&apos;unuza ekleyin:</p>
        <ol className="mt-1 list-decimal pl-5">
          <li>Safari&apos;de Paylaş simgesine dokunun.</li>
          <li>Ana Ekrana Ekle&apos;yi seçin.</li>
          <li>Uygulamayı ana ekrandan açın.</li>
        </ol>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <p className="max-w-xs text-sm text-slate-500">
        Bildirimler engellendi. Tarayıcı ayarlarından bildirime izin verin, sonra sayfayı yenileyin.
      </p>
    );
  }

  if (status === "busy") {
    return (
      <button type="button" disabled className={buttonClass}>
        İşleniyor…
      </button>
    );
  }

  if (status === "subscribed") {
    return (
      <button type="button" onClick={disable} className={buttonClass}>
        Bildirimleri kapat
      </button>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-end gap-1">
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
        <button type="button" onClick={() => enable(vapidKey)} className={buttonClass}>
          Bildirimleri aç
        </button>
      </div>
    );
  }

  // default
  return (
    <button type="button" onClick={() => enable(vapidKey)} className={buttonClass}>
      Bildirimleri aç
    </button>
  );
}

"use client";

import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import type { WaGroupsResult } from "@/lib/whatsapp/groups";
import { WA_CONSENT_VERSION, type WaStatusResult, type WaStatusView } from "@/lib/whatsapp/status";

import {
  acceptWaConsent,
  getMyWaGroupsAction,
  getMyWaStatus,
  requestWaAction,
  setMyWaGroupSelection,
} from "./actions";
import { GroupPicker } from "./group-picker";

// EML-106 / EML-104 AC-1, AC-2, AC-3, AC-5..AC-11. Hiçbir agent_id istemciden gönderilmez (AC-S1).
// QR yalnız get_my_wa_status yanıtından gelir (AC-S2); qrcode kütüphanesiyle SVG'ye çevrilir.

const POLL_MS = 2000;
/** Kaldırma sonrası sidecar işlemezse bu kadar poll'dan sonra hata gösterilir (~60 sn). */
const DISCONNECT_MAX_POLLS = 30;
/** EML-109: connected sonrası grup senkronu bitmezse grup okuma poll'u bu kadar tur sonra durur (~2 dk). */
const GROUPS_MAX_POLLS = 60;

const CONSENT_TEXT =
  "WhatsApp resmi olmayan bağlantıları kısıtlayabilir; numaranız kapatılabilir. Sistem numaranızdan hiçbir mesaj göndermez, yalnızca seçtiğiniz gruplardaki ilanları okur.";
const CONSENT_LABEL = "Riski anladım ve kabul ediyorum.";

const DEFAULT_ERROR = "Bir hata oluştu, tekrar deneyin.";
const LOGGED_OUT_MESSAGE = "Bağlantı telefondan kaldırıldı, yeniden bağlayabilirsiniz.";

const ACTION_ERROR_MESSAGES: Partial<Record<string, string>> = {
  subscription_required: "Bu özellik için aktif abonelik gerekir.",
  rate_limited: "Çok fazla deneme, 10 dk sonra tekrar deneyin.",
  rpc_failed: DEFAULT_ERROR,
};

const STATUS_ERROR_MESSAGES: Partial<Record<string, string>> = {
  sidecar_timeout: "Servis şu an yanıt vermiyor, biraz sonra tekrar deneyin.",
  no_qr_generated: "Bağlantı başlatılamadı, tekrar deneyin.",
  capacity: "Şu an yeni bağlantı açılamıyor.",
  creds_persist_failed: "Bağlantı kaydedilemedi, tekrar deneyin.",
  sidecar_misconfigured: "Servis şu an kullanılamıyor.",
};

const DISCONNECTED_MESSAGES: Partial<Record<string, string>> = {
  qr_expired: "Süre doldu, tekrar deneyin.",
  replaced: "Bağlantı başka bir yerde açıldı.",
  subscription_inactive: "Aboneliğiniz aktif değil.",
};

// Panel yalnız yerel "kaldırılıyor" ara durumunu ekler; diğerleri sunucu şekli.
type ViewStatus = WaStatusView | { status: "disconnecting" };

type RetryKind = "consent" | "connect" | "disconnect";
type PanelError = { message: string; retry?: RetryKind } | null;

export type WaPanelProps = {
  initialStatus: WaStatusView;
  consentAccepted: boolean;
  /** EML-107: grup listesi (sunucu, get_my_wa_groups). Yoksa grup bölümü gösterilmez. */
  groups?: WaGroupsResult;
};

/** Hata/durum mesajı gereken durumlar; "Bağla" yerine "Tekrar dene" gösterilir. */
function statusMessage(status: ViewStatus): string | null {
  switch (status.status) {
    case "logged_out":
      return LOGGED_OUT_MESSAGE;
    case "disconnected": {
      const known = status.error_code ? DISCONNECTED_MESSAGES[status.error_code] : undefined;
      return known ?? "Bağlantı kesildi, tekrar bağlayabilirsiniz.";
    }
    case "error": {
      const known = status.error_code ? STATUS_ERROR_MESSAGES[status.error_code] : undefined;
      return known ?? DEFAULT_ERROR;
    }
    default:
      return null;
  }
}

function actionErrorMessage(code: string): string {
  return ACTION_ERROR_MESSAGES[code] ?? DEFAULT_ERROR;
}

// Kaldırma sırasında sidecar henüz işlemediyse "connected" görünür; yalnız sonuç durumları kabul edilir.
const DISCONNECT_TERMINAL = new Set(["none", "disconnected", "error", "logged_out"]);

function applyPoll(prev: ViewStatus, res: WaStatusResult, timedOut: boolean): ViewStatus {
  if (!res.ok) return { status: "error", error_code: null };
  if (prev.status === "disconnecting") {
    if (timedOut) return { status: "error", error_code: "sidecar_timeout" };
    return DISCONNECT_TERMINAL.has(res.status) ? res : prev;
  }
  return res;
}

export function WaPanel({ initialStatus, consentAccepted, groups }: WaPanelProps) {
  const [status, setStatus] = useState<ViewStatus>(initialStatus);
  const [consent, setConsent] = useState(consentAccepted);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PanelError>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [qrImage, setQrImage] = useState<{ value: string; svg: string } | null>(null);
  const pollCountRef = useRef(0);
  const groupsPollCountRef = useRef(0);
  const router = useRouter();
  const lastStatusRef = useRef<string>(initialStatus.status);
  // EML-109: poll'la okunan grup listesi. Her kayıt, okunduğu sunucu prop'u (base) ile birlikte tutulur;
  // prop referansı değişince (router.refresh) kopya geçersiz sayılır. Sıfırlama effect'i gerekmez.
  const [liveGroups, setLiveGroups] = useState<{ base: WaGroupsResult | undefined; data: WaGroupsResult } | null>(
    null,
  );
  const liveGroupsForCurrent = liveGroups !== null && liveGroups.base === groups ? liveGroups.data : null;
  const effectiveGroups = liveGroupsForCurrent ?? groups;
  // Poll interval'ı kapanışta en güncel prop'u okusun diye ref (interval yeniden kurulmaz).
  const groupsPropRef = useRef(groups);
  useEffect(() => {
    groupsPropRef.current = groups;
  }, [groups]);

  const isPolling =
    status.status === "pending" || status.status === "qr" || status.status === "disconnecting";

  // EML-109: connected iken grup senkronu henüz bitmediyse (groups_synced_at null) grup listesi poll edilir.
  const groupsSynced =
    effectiveGroups !== undefined && effectiveGroups.ok && effectiveGroups.groups_synced_at !== null;
  const groupsSyncPending = groups !== undefined && status.status === "connected" && !groupsSynced;

  // Bağlantı durumu değiştiğinde (ör. connected) sunucu bileşeni yeniden çalışır ve grup listesi
  // tazelenir; mount'taki ilk durum değişimi sayılmaz.
  useEffect(() => {
    if (lastStatusRef.current === status.status) return;
    lastStatusRef.current = status.status;
    router.refresh();
  }, [status.status, router]);

  // 2 sn poll: bekleme/QR/kaldırma sürerken durum; connected + grup senkronu bekleniyorken grup listesi.
  // Her iki durum aynı anda geçerli olamaz (isPolling ve connected ayrışık).
  useEffect(() => {
    if (!isPolling && !groupsSyncPending) return;
    groupsPollCountRef.current = 0;
    const id = setInterval(async () => {
      if (isPolling) {
        pollCountRef.current += 1;
        const timedOut = pollCountRef.current > DISCONNECT_MAX_POLLS;
        const res = await getMyWaStatus();
        setStatus((prev) => applyPoll(prev, res, timedOut));
        return;
      }
      groupsPollCountRef.current += 1;
      if (groupsPollCountRef.current > GROUPS_MAX_POLLS) {
        clearInterval(id);
        return;
      }
      const res = await getMyWaGroupsAction();
      // Yalnız başarılı yanıt alınır; seçici key'i yalnız groups_synced_at değişince yeniden kurulur.
      if (res.ok) setLiveGroups({ base: groupsPropRef.current, data: res });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isPolling, groupsSyncPending]);

  const qrValue = status.status === "qr" ? status.qr : null;

  // QR SVG: qrcode kütüphanesi (yalnız kendi üretimi; kullanıcı girdisi içermez).
  useEffect(() => {
    if (qrValue === null) return;
    let cancelled = false;
    QRCode.toString(qrValue, { type: "svg", margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((svg) => {
        if (!cancelled) setQrImage({ value: qrValue, svg });
      })
      .catch(() => {
        if (!cancelled) setError({ message: "QR kodu gösterilemedi, tekrar deneyin.", retry: "connect" });
      });
    return () => {
      cancelled = true;
    };
  }, [qrValue]);

  async function handleAccept() {
    if (!ticked) return;
    setBusy(true);
    setError(null);
    const res = await acceptWaConsent(WA_CONSENT_VERSION);
    setBusy(false);
    if (res.ok) {
      setConsent(true);
      setTicked(false);
      return;
    }
    setError({ message: "Onay kaydedilemedi, tekrar deneyin.", retry: "consent" });
  }

  async function handleConnect() {
    setBusy(true);
    setError(null);
    const res = await requestWaAction("connect");
    setBusy(false);
    if (!res.ok) {
      if (res.error === "consent_required") {
        // Sunucu onayı görmedi: onay kutusu yeniden gösterilir, Tekrar dene sunulmaz.
        setConsent(false);
        setTicked(false);
        setError({ message: "Devam etmek için riski onaylamanız gerekir." });
        return;
      }
      setError({ message: actionErrorMessage(res.error), retry: "connect" });
      return;
    }
    pollCountRef.current = 0;
    setStatus({ status: "pending" });
  }

  async function handleDisconnect() {
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    const res = await requestWaAction("disconnect");
    setBusy(false);
    if (!res.ok) {
      setError({ message: actionErrorMessage(res.error), retry: "disconnect" });
      return;
    }
    pollCountRef.current = 0;
    setStatus({ status: "disconnecting" });
  }

  function retry(kind: RetryKind) {
    if (kind === "consent") void handleAccept();
    else if (kind === "connect") void handleConnect();
    else void handleDisconnect();
  }

  const statusError = statusMessage(status);
  const canConnect =
    status.status === "none" || status.status === "error" || status.status === "disconnected" || status.status === "logged_out";
  const primaryButton =
    "rounded-md bg-terracotta-700 px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:opacity-50";
  const secondaryButton =
    "rounded-md border border-mist-200 px-4 py-2 text-sm text-ink-900 hover:bg-mist-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:opacity-60";

  const qrSvg = qrValue !== null && qrImage?.value === qrValue ? qrImage.svg : null;

  return (
    <section aria-labelledby="wa-panel-title" className="mt-6 max-w-xl space-y-4">
      <h2 id="wa-panel-title" className="text-lg font-semibold text-ink-900">
        WhatsApp bağlantısı
      </h2>

      {!consent && (
        <div className="space-y-3 rounded-md border border-mist-200 p-4 text-sm text-ink-900">
          <p>{CONSENT_TEXT}</p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={ticked}
              onChange={(e) => setTicked(e.target.checked)}
            />
            <span>{CONSENT_LABEL}</span>
          </label>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!ticked || busy}
            className={primaryButton}
          >
            Onayla
          </button>
        </div>
      )}

      <div aria-live="polite" className="space-y-3 text-sm text-ink-900">
        {status.status === "none" && <p>Bağlı değil</p>}

        {status.status === "pending" && <p>Hazırlanıyor…</p>}

        {status.status === "disconnecting" && <p>Bağlantı kaldırılıyor…</p>}

        {status.status === "qr" && (
          <div className="space-y-3">
            {qrSvg ? (
              <div
                role="img"
                aria-label="WhatsApp QR kodu"
                className="inline-block rounded bg-white p-3"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <p>QR hazırlanıyor…</p>
            )}
            <p className="text-slate-500">
              Telefonunuzda WhatsApp → Ayarlar → Bağlı cihazlar → Cihaz bağla yolunu açıp bu kodu okutun.
            </p>
          </div>
        )}

        {status.status === "connected" && (
          <div className="flex flex-wrap items-center gap-3">
            <p>{status.phone_masked ? `Bağlı: ${status.phone_masked}` : "Bağlı"}</p>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
              className={secondaryButton}
            >
              Bağlantıyı kaldır
            </button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="error">
          <p>{error.message}</p>
          {error.retry && (
            <button
              type="button"
              onClick={() => retry(error.retry as RetryKind)}
              disabled={busy}
              className={`${secondaryButton} mt-2`}
            >
              Tekrar dene
            </button>
          )}
        </Alert>
      )}

      {!error && statusError && (
        <Alert variant="error">
          <p>{statusError}</p>
          <button
            type="button"
            onClick={() => retry("connect")}
            disabled={busy || !consent}
            className={`${secondaryButton} mt-2`}
          >
            Tekrar dene
          </button>
        </Alert>
      )}

      {canConnect && !statusError && (
        <button
          type="button"
          onClick={handleConnect}
          disabled={!consent || busy}
          className={primaryButton}
        >
          Bağla
        </button>
      )}

      {effectiveGroups !== undefined &&
        (effectiveGroups.ok ? (
          // Salt-okunur durum canlı poll'dan (status) türer; durum ya da grup senkronu değişince
          // seçici yeniden kurulur (seçim ve "not_connected" durumu sıfırlanır).
          <GroupPicker
            key={`${status.status}:${effectiveGroups.groups_synced_at ?? ""}`}
            initial={{ ...effectiveGroups, status: status.status }}
            onSave={setMyWaGroupSelection}
          />
        ) : (
          <Alert variant="error">
            <p>Grup listesi yüklenemedi, sayfayı yenileyin.</p>
          </Alert>
        ))}

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="wa-confirm-title"
          className="space-y-3 rounded-md border border-mist-200 bg-fog-50 p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmOpen(false);
          }}
        >
          <h3 id="wa-confirm-title" className="font-semibold text-ink-900">
            WhatsApp bağlantısı kaldırılsın mı?
          </h3>
          <p className="text-sm text-slate-500">
            Oturum kapatılır ve bağlantı bilgileriniz silinir. Yeniden bağlamak için QR taramanız gerekir.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmOpen(false)} className={secondaryButton}>
              Vazgeç
            </button>
            <button type="button" onClick={handleDisconnect} disabled={busy} className={primaryButton}>
              Evet, kaldır
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

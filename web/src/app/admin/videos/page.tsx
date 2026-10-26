import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";

import { publishVideo, uploadVideo } from "./actions";

type PropertyRow = {
  id: string;
  title: string | null;
  address: string | null;
};

type VideoRow = {
  id: string;
  property_id: string;
  storage_path: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
};

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    redirect(auth.reason === "no-session" ? "/login" : "/agent/dashboard");
  }
  const { supabase } = auth;

  const params = await searchParams;
  const rawPropertyId = params.property_id;
  const selectedPropertyId =
    typeof rawPropertyId === "string" && rawPropertyId.length > 0
      ? rawPropertyId
      : null;

  const { data: propertiesData } = await supabase
    .from("properties")
    .select("id, title, address");
  const properties = (propertiesData ?? []) as PropertyRow[];

  let videos: VideoRow[] = [];
  if (selectedPropertyId) {
    const { data: videosData } = await supabase
      .from("property_videos")
      .select("id, property_id, storage_path, status, published_at, created_at")
      .eq("property_id", selectedPropertyId);
    videos = (videosData ?? []) as VideoRow[];
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">Video Yükleme Paneli</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Bir mülk seçin, tanıtım videosunu yükleyip yayınlayın.
      </p>

      <section className="mt-6 flex flex-col gap-3">
        {properties.length === 0 && (
          <p className="text-sm text-zinc-500">Henüz mülk yok</p>
        )}
        {properties.map((property) => (
          <article
            key={property.id}
            className={`rounded border p-4 ${
              property.id === selectedPropertyId ? "border-green-600" : ""
            }`}
          >
            <a
              href={`/admin/videos?property_id=${encodeURIComponent(property.id)}`}
              className="font-medium hover:underline"
            >
              {property.title ?? "—"}
            </a>
            <p className="mt-1 text-xs text-zinc-500">{property.address ?? "—"}</p>
          </article>
        ))}
      </section>

      {selectedPropertyId && (
        <section className="mt-8">
          <h2 className="text-base font-semibold">Video Yükle</h2>
          <form
            action={uploadVideo}
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="property_id" value={selectedPropertyId} />
            <input
              type="file"
              name="video"
              accept="video/mp4,video/webm,video/quicktime"
              required
              className="text-sm"
            />
            <button
              type="submit"
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
            >
              Yükle
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
            {videos.map((video) => (
              <div
                key={video.id}
                data-testid="video-row"
                data-video-id={video.id}
                className="flex items-center justify-between rounded border p-4"
              >
                <div className="text-xs text-zinc-500">
                  <p className="font-mono">{video.storage_path}</p>
                  {video.published_at && (
                    <p>Yayın: {video.published_at}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {video.status === "draft" ? (
                    <>
                      <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">
                        Taslak
                      </span>
                      <form action={publishVideo}>
                        <input type="hidden" name="video_id" value={video.id} />
                        <button
                          type="submit"
                          className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                        >
                          Yayınla
                        </button>
                      </form>
                    </>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                      Yayında
                    </span>
                  )}
                </div>
              </div>
            ))}

            {videos.length === 0 && (
              <p className="text-sm text-zinc-500">
                Bu mülke henüz video eklenmedi
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

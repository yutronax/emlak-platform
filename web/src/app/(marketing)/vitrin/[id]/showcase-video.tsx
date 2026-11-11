"use client";

// Vitrin detay oynatıcısı: dikey (9:16) çerçeve, indirme kapalı (controlsList + sağ tık engeli).
// Sağ tık engeli bir event handler gerektirdiği için bu küçük parça client bileşendir.
export function ShowcaseVideo({ src, poster }: { src: string; poster?: string }) {
  return (
    <video
      src={src}
      poster={poster}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      playsInline
      preload="metadata"
      className="aspect-[9/16] w-full bg-panel-deep object-contain"
    />
  );
}

// Unsplash Lisansı ile kullanılan stok görseller (kaynak ve fotoğrafçı: web/public/images/CREDITS.md).
// Boyut/kalite Unsplash'ın imgix parametreleriyle istenir.

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export type StockImage = { src: (w: number) => string; alt: string; credit: string };

export const STOCK = {
  heroLiving: {
    src: (w: number) => unsplash("photo-1665249934445-1de680641f50", w),
    alt: "Sabah güneşi alan, şehir manzaralı ferah bir salon",
    credit: "Danilo Rios / Unsplash",
  },
  facadeBalconies: {
    src: (w: number) => unsplash("photo-1460317442991-0ec209397118", w),
    alt: "Lacivert ve turuncu cepheli, balkonlu bir apartman",
    credit: "Brandon Griggs / Unsplash",
  },
} satisfies Record<string, StockImage>;

// <img srcSet> için genişlik basamakları.
export const srcSet = (img: StockImage, widths = [640, 1080, 1600, 2200]) =>
  widths.map((w) => `${img.src(w)} ${w}w`).join(", ");

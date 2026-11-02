import type { Deal } from "./types";

// Emlakçının vitrine çıkarma formu: girdi modeli ve doğrulama (sunucu ve istemci ortak; 0029 kısıtlarıyla aynı).

export type PublishInput = {
  deal: Deal | "";
  // TL, tam sayı (form metni); kuruşa sunucuda çevrilir.
  price: string;
  city: string;
  district: string;
  rooms: string;
  areaM2: string;
  floor: string;
  buildingAge: string;
  heating: string;
  description: string;
  phoneConsent: boolean;
};

export type PublishErrors = Partial<Record<keyof PublishInput, string>>;

export type PropertyColumns = {
  deal: Deal;
  price_minor: number;
  city: string;
  district: string | null;
  rooms: string;
  area_m2: number;
  floor: string | null;
  building_age: number | null;
  heating: string | null;
  description: string | null;
};

const int = (v: string) => (/^\d{1,12}$/.test(v.trim()) ? Number(v.trim()) : NaN);

export function validatePublish(i: PublishInput): { errors: PublishErrors; columns: PropertyColumns | null } {
  const e: PublishErrors = {};
  const price = int(i.price.replace(/\./g, ""));
  const area = int(i.areaM2);
  const age = i.buildingAge.trim() ? int(i.buildingAge) : null;

  if (i.deal !== "satilik" && i.deal !== "kiralik") e.deal = "Satılık mı kiralık mı seçin.";
  if (!(price >= 1 && price <= 1_000_000_000_000)) e.price = "Fiyatı TL olarak girin.";
  if (!i.city.trim() || i.city.trim().length > 60) e.city = "Şehir girin.";
  if (i.district.trim().length > 60) e.district = "İlçe en fazla 60 karakter.";
  if (!/^\d{1,2}\+\d{1,2}$/.test(i.rooms.trim())) e.rooms = "Oda sayısını 3+1 biçiminde girin.";
  if (!(area >= 1 && area <= 100_000)) e.areaM2 = "Alanı m² olarak girin.";
  if (i.floor.trim().length > 40) e.floor = "Kat en fazla 40 karakter.";
  if (age !== null && !(age >= 0 && age <= 300)) e.buildingAge = "Bina yaşını yıl olarak girin.";
  if (i.heating.trim().length > 60) e.heating = "Isınma en fazla 60 karakter.";
  if (i.description.length > 3000) e.description = "Açıklama en fazla 3000 karakter.";
  if (!i.phoneConsent) e.phoneConsent = "Vitrinde yayın için telefonunuzun görünmesine onay vermelisiniz.";

  if (Object.keys(e).length) return { errors: e, columns: null };
  const opt = (v: string) => v.trim() || null;
  return {
    errors: e,
    columns: {
      deal: i.deal as Deal,
      price_minor: price * 100,
      city: i.city.trim(),
      district: opt(i.district),
      rooms: i.rooms.trim(),
      area_m2: area,
      floor: opt(i.floor),
      building_age: age,
      heating: opt(i.heating),
      description: opt(i.description),
    },
  };
}

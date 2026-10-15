# -*- coding: utf-8 -*-
"""WhatsApp emlak ilanı mesajını Gemini ile yapılandırılmış veriye çevirir.

maviLojistik/production_parser.py'deki iki aşamalı yaklaşımdan ilham alır
(hızlı ön-eleme + tam JSON çıkarımı) ama emlak alanlarına uyarlanmıştır.
"""

import json
import logging
import re
from typing import Any, Dict, Optional

from google import genai

from api_key_manager import GeminiKeyManager

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Sen bir emlak ilanı ayrıştırma asistanısın. Sana WhatsApp grubundan
gelen ham bir emlak ilanı metni verilecek. Görevin SADECE metinde açıkça yazılı
bilgileri çıkarıp JSON olarak döndürmek.

Kurallar:
- Metinde olmayan bir alanı ASLA tahmin etme / icat etme (hallucination yasak).
  Bulunamayan alan için null kullan.
- Fiyatı sayıya çevir (örn. "2.500.000 TL" -> 2500000, currency: "TRY").
- Oda sayısını ilandaki orijinal formatla döndür (örn. "2+1", "3+1 dubleks").
- Alan (m2) sadece sayı olarak döndür, birim ekleme.
- Şehir/ilçe/mahalle ayrı alanlara yaz; metinde sadece şehir varsa ilçe/mahalle null.
- Metin bir emlak ilanı değilse (sohbet, soru, reklam dışı mesaj) is_listing: false döndür
  ve diğer alanları null bırak.

Şema:
{
  "is_listing": bool,
  "title": string | null,
  "price": number | null,
  "currency": "TRY" | null,
  "rooms": string | null,
  "area_m2": number | null,
  "city": string | null,
  "district": string | null,
  "neighborhood": string | null,
  "description": string | null
}

Yalnızca JSON döndür, başka açıklama ekleme."""


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        logger.warning("Gemini yanıtı JSON olarak parse edilemedi: %s", text[:200])
        return None


async def parse_listing_message(
    raw_text: str, key_manager: GeminiKeyManager
) -> Optional[Dict[str, Any]]:
    """Ham WhatsApp mesajını yapılandırılmış ilan verisine çevirir.

    Dönüş: is_listing=false ise None, aksi halde parsed dict.
    429 (rate limit) alınırsa key rotasyonu yapıp bir kez daha dener.
    """
    key_manager.load_keys()
    attempts = max(1, len(key_manager.get_all_keys()))

    for _ in range(attempts):
        api_key = key_manager.get_active_key()
        if not api_key:
            logger.error("Kullanılabilir Gemini key yok.")
            return None

        client = genai.Client(api_key=api_key)
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{SYSTEM_PROMPT}\n\n---\nİlan metni:\n{raw_text}",
            )
        except Exception as exc:  # noqa: BLE001 - sağlayıcı hatası, rotasyon dene
            message = str(exc)
            if "429" in message or "RESOURCE_EXHAUSTED" in message:
                logger.info("Gemini key rate-limit, rotasyon deneniyor.")
                await key_manager.switch_to_next_async()
                continue
            logger.error("Gemini çağrısı başarısız: %s", message)
            return None

        parsed = _extract_json(response.text or "")
        if parsed is None:
            return None
        if not parsed.get("is_listing"):
            return None
        return parsed

    logger.error("Tüm Gemini key'leri tükendi.")
    return None

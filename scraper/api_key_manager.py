# -*- coding: utf-8 -*-
"""Gemini API key havuzu: round-robin rotasyon + 429 sonrası cooldown.

maviLojistik/src/utils/api_key_manager.py'deki desenin Gemini-only,
sadeleştirilmiş portu (Groq/legacy çoklu-sağlayıcı dalı kaldırıldı).
"""

import asyncio
import os
import re
import time
from typing import Dict, List, Optional

GEMINI_COOLDOWN_SECONDS = 61  # Gemini free-tier limiti dakikalık


class GeminiKeyManager:
    def __init__(self) -> None:
        self._keys: List[str] = []
        self._index: int = -1
        self._exhausted_at: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _parse_keys(value: str) -> List[str]:
        if not value:
            return []
        return [p.strip() for p in re.split(r"[,\s]+", value) if p.strip()]

    def load_keys(self) -> bool:
        raw = os.getenv("GEMINI_API_KEYS") or os.getenv("GEMINI_API_KEY") or ""
        keys, seen = [], set()
        for k in self._parse_keys(raw):
            if k not in seen:
                seen.add(k)
                keys.append(k)
        self._keys = keys
        if self._keys and self._index == -1:
            self._index = 0
        return bool(self._keys)

    def get_active_key(self) -> Optional[str]:
        if 0 <= self._index < len(self._keys):
            return self._keys[self._index]
        return None

    def get_all_keys(self) -> List[str]:
        return list(self._keys)

    def mark_exhausted(self, key: str) -> None:
        self._exhausted_at[key] = time.time()

    def all_exhausted(self) -> bool:
        if not self._keys:
            return True
        now = time.time()
        for k in self._keys:
            if k not in self._exhausted_at:
                return False
            if now - self._exhausted_at[k] >= GEMINI_COOLDOWN_SECONDS:
                return False
        return True

    async def switch_to_next_async(self) -> bool:
        """429 alındığında çağrılır: mevcut key'i exhausted işaretler, ilk hazır
        (hiç exhausted olmamış veya cooldown'u geçmiş) key'e geçer."""
        async with self._lock:
            if not self._keys:
                return False

            now = time.time()
            if 0 <= self._index < len(self._keys):
                self.mark_exhausted(self._keys[self._index])

            for i, k in enumerate(self._keys):
                if k not in self._exhausted_at:
                    self._index = i
                    return True
                if now - self._exhausted_at[k] >= GEMINI_COOLDOWN_SECONDS:
                    del self._exhausted_at[k]
                    self._index = i
                    return True

            return False


_default_manager: Optional[GeminiKeyManager] = None


def get_default_manager() -> GeminiKeyManager:
    global _default_manager
    if _default_manager is None:
        _default_manager = GeminiKeyManager()
        _default_manager.load_keys()
    return _default_manager

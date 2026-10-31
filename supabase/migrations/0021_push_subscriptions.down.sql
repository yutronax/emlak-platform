-- 0021 geri alma. Abonelik satırları ile birlikte tablo ve policy'leri düşürür.
-- Uyarı: tüm cihaz kayıtları silinir; bildirimler durur (kod revert'i ile birlikte uygulanmalı).

drop table if exists push_subscriptions;

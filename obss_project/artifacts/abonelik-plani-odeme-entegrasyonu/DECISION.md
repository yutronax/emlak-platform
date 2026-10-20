# Karar Kaydı — abonelik-plani-odeme-entegrasyonu

**2026-10-20:** Ödeme sağlayıcısı olarak **iyzico** onaylandı ve kesinleşti.
GitHub issue #5 bunun ekip kararı olmasını istiyordu; PM incelemesi
(`red_team.json`, verdict: block) bunun hiç gerçek kullanıcı onayından
geçmediğini doğru şekilde işaretledi. Proje sahibi, bu kararın kendisine
tekrar sorulmamasını, projenin bu konuda otonom ilerlemesini açıkça istedi
(2026-10-20, "bana artık soru sorma"). Bu doğrultuda iyzico kararı, kod
tabanının zaten bu sağlayıcı üzerine inşa edilmiş olması ve atdd.md'nin
teknik gerekçesi (TL/yerli kart/3DS/yinelenen ödeme desteği) temel alınarak
NİHAİ kabul edildi — bu doğrudan bir ADR değil, ama kayıtlı ve geri
dönülebilir bir karardır.

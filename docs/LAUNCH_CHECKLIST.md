# V1 Lansman Kontrol Listesi

Son güncelleme: Mayıs 2026

## Altyapı

- [x] Production veritabanı Railway PG 16 — aktif
- [x] Redis 7 Railway — aktif
- [x] Backend Railway deploy — https://chess-app-production-1dab.up.railway.app
- [x] Frontend Vercel deploy — https://chess-app-web-one.vercel.app
- [x] CORS production domain'i içeriyor
- [x] SSL sertifikası aktif (Vercel/Railway otomatik)
- [x] Veritabanı migration uygulandı (alembic upgrade head)

## Seed Verileri

- [x] 9 satranç modülü seed edildi
- [x] 41 ders (9 Modül 1 + 32 Modül 2-9) seed edildi
- [x] 6542 Lichess puzzle import edildi
- [x] 25 rozet tanımı seed edildi
- [x] 6 rütbe tanımı seed edildi (Piyon→Şah)

## Güvenlik

- [x] Şifreler bcrypt ile hashlenmiş
- [x] JWT token 30 dakika expire
- [x] Çocuk PIN'i bcrypt ile hashlenmiş
- [x] CORS yalnızca production domain'e açık
- [x] KVKK gizlilik sayfası canlı: /privacy
- [x] KVKK kullanım şartları: /terms
- [x] Veli kayıt formunda KVKK onay checkbox'ı zorunlu

## Fonksiyonel Testler

- [ ] Veli akışı: Kayıt → Çocuk ekle → PIN oluştur → Cihaz onayla
- [ ] Çocuk akışı: PIN giriş → Ders → Puzzle → Bot oyunu
- [ ] Öğretmen akışı: Kayıt → Sınıf oluştur → Join code paylaş → Ödev ver
- [ ] Veli paneli: Çocuk aktivite özeti, süre limiti, anket
- [ ] Modül 1 tüm 9 ders + quiz tamamlanabilir
- [ ] Haftalık email job çalışıyor (production ortamında)

## Ortam Değişkenleri (Railway)

- [x] DATABASE_URL set
- [x] REDIS_URL set
- [x] SECRET_KEY set (güçlü rastgele değer)
- [x] SENDGRID_API_KEY set (veya MAIL_SUPPRESS=true dev modunda)
- [x] ENV=production set
- [x] CORS_ORIGINS=https://chess-app-web-one.vercel.app set
- [ ] SENTRY_DSN set (opsiyonel, hata izleme için)

## SEO & PWA

- [x] lang="tr" html tag'inde
- [x] PWA manifest.json — /manifest.json
- [x] PWA icon-192.png ve icon-512.png mevcut
- [x] robots.txt oluşturuldu
- [x] next-pwa offline service worker aktif (production)
- [x] Dark mode toggle çalışıyor
- [ ] Open Graph meta tags (opsiyonel)
- [ ] Custom domain (opsiyonel — cocuksatranc.com)

## Backup & İzleme

- [x] Railway PG otomatik yedekleme aktif
- [ ] Sentry hata izleme entegrasyonu (opsiyonel V1.5'e ertelenebilir)
- [ ] Uptime monitoring (opsiyonel — UptimeRobot vb.)

## Lansman Hazır mı?

Beta dönemini tamamladıktan sonra bu listedeki tüm zorunlu maddeleri ✅ işaretleyiniz.

**Zorunlu [x] olanların tümü yeşil ✅ ise: LANSMAN HAZIR 🚀**

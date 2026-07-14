# Admin Paneli + PIN'siz Çocuk Modu + Tek Sayfa Giriş — Tasarım

Tarih: 2026-07-14
Durum: Onaylandı (kullanıcı, sohbet içinde)

## Amaç

1. Ana sayfa ve giriş formunu tek sayfada birleştirmek.
2. "Çocuk Moduna Geç" akışından PIN'i kaldırmak (güvenilir cihaz koşulu korunarak).
3. Öğretmen hesaplarının erişebildiği, sol menülü bir admin paneli eklemek: veli yönetimi, şifre sıfırlama, içerik görüntüleme.

## Kapsam Dışı (bu turda yapılmayacak)

- Panelden ders/modül içeriği düzenleme (sadece görüntüleme var).
- Veli adına çocuk ekleme/düzenleme.
- Ayrı "admin" rolü / admin'in admin ataması (öğretmen = admin).
- Velinin kendi kendine e-postayla şifre sıfırlaması (mevcut "yöneticiye başvur" sayfası kalıyor; admin paneli bunu gerçekten çalışır yapıyor).

## 1. Tek Sayfa Giriş

`apps/web/app/page.tsx` yeniden düzenlenir:

- Sıra: logo → "Bozüyük Satranç Akademisi" → "Akademik Gelişim Platformu" → yatay çizgi → "Hoş Geldiniz" → yatay çizgi → **giriş formu** (e-posta, şifre, "Şifremi unuttum" linki, "Giriş Yap" butonu) → "Hesabın yok mu? Kayıt Ol" linki.
- Giriş mantığı mevcut `parent-login` sayfasındakiyle birebir aynı: `POST /auth/login`, role göre yönlendirme (teacher → `/admin`, diğerleri → `/parent/dashboard`).
- `/parent-login` route'u SİLİNMEZ (eski yer imleri, PWA start_url kırılmasın); içeriği ana sayfayla aynı forma yönlendirir veya aynı formu render eder.
- `/parent-signup` (Kayıt Ol) ayrı sayfa olarak kalır.

## 2. PIN'siz Çocuk Modu

### Backend

- Yeni endpoint: `POST /auth/child/enter` — body: `{ child_profile_id, device_fingerprint }`.
  - Cihaz, çocuğun velisinin güvenilir cihazı değilse 403 (mevcut PIN endpoint'iyle aynı cihaz kontrolü).
  - Başarılıysa mevcut PIN endpoint'iyle aynı child token'ı döner.
- `POST /auth/child/pin` endpoint'i AYNEN KALIR (geriye uyumluluk — eski kurulu istemciler kırılmaz).
- Güvenlik gerekçesi: PIN kalkınca koruma "güvenilir cihaz" katmanına iner. Yabancı cihazdan `child/enter` çağrısı 403 alır. Veli oturumu gerekmez (PIN akışında da gerekmiyordu).

### Frontend

- `child-login` sayfası: profil seçilince PIN ekranı yerine direkt `POST /auth/child/enter` → `/home`.
- PIN pad kodu kaldırılır. Hata durumları (403 cihaz tanımsız) mevcut mesajlarla korunur.
- Çocuk ekleme akışındaki PIN alanı bu turda DEĞİŞMEZ (model alanı duruyor; sadece girişte sorulmuyor).

## 3. Admin Paneli

### Yetki

- `UserRole.teacher` = admin. Yeni rol, migration YOK → canlı kullanıcı riski yok.
- Tüm `/admin/*` endpoint'leri `_ensure_teacher` benzeri kontrolle korunur (mevcut teacher router deseni).

### Backend — yeni router `apps/api/chess_api/routers/admin.py`

| Endpoint | İş |
|---|---|
| `GET /admin/parents` | Veli listesi: id, ad, e-posta, kayıt tarihi, çocuk sayısı |
| `GET /admin/parents/{id}` | Veli detayı: çocukları + her çocuğun ilerleme özeti (tamamlanan ders sayısı vb. mevcut progress tablolarından) |
| `POST /admin/parents/{id}/reset-password` | Body: `{ new_password }` (min 8). Velinin şifresini değiştirir |
| `DELETE /admin/parents/{id}` | Veliyi ve bağlı çocuk profillerini siler (mevcut children delete cascade'ine uygun) |
| `GET /admin/overview` | Sayılar: toplam veli, çocuk, öğretmen |
| `GET /admin/content` | Modül + ders listesi (salt okunur) |

Öğretmen kendini `DELETE` edemez; hedef kullanıcı parent değilse 404/400.

### Frontend — `apps/web/app/admin/*`

- `admin/layout.tsx`: sol panel menü (Genel Bakış, Veliler, İçerik) + çıkış. Mobilde üstte açılır menü.
- `admin/page.tsx`: Genel Bakış (sayılar).
- `admin/parents/page.tsx`: veli tablosu, arama kutusu (istemci tarafı filtre).
- `admin/parents/[id]/page.tsx`: veli detayı, "Şifre Sıfırla" (yeni şifre girilen küçük form), "Veliyi Sil" (geri alınamaz uyarılı onay diyaloğu).
- `admin/content/page.tsx`: modül/ders listesi (salt okunur).
- Giriş sonrası yönlendirme: `role === 'teacher'` → `/admin` (mevcut `/classes` yönlendirmesinin yerini alır; `/classes` sayfası durur, sol menüden değil ama URL'den erişilebilir kalır).

### Hata/koruma

- `/admin/*` sayfaları client-side token + role kontrolü yapar; teacher değilse ana sayfaya atar (mevcut sayfalardaki desen).
- Backend her admin endpoint'inde rolü ayrıca doğrular (asıl güvenlik backend'de).

## Test

- Backend: pytest — admin endpoint'leri (yetkisiz 403, veli listesi, şifre sıfırlama sonrası yeni şifreyle login, silme), `child/enter` (güvenilir cihaz OK, yabancı cihaz 403).
- Frontend: mevcut smoke testi ana sayfadaki giriş formuna göre güncellenir.

## Geriye Uyumluluk (KURAL #3)

- Migration yok, mevcut endpoint silinmiyor, PIN endpoint'i duruyor.
- Vercel + Railway deploy sırası: önce backend (Railway), sonra frontend — frontend'in çağırdığı yeni endpoint'ler hazır olur.

# Sporcu Modeli — Tasarım

Tarih: 2026-07-15
Durum: Onaylandı (kullanıcı, sohbet içinde)

## Amaç

Veli hesabı email+şifre ile girer, uygulama tek bir **sporcunun** adı-soyadı altında çalışır. Veli/çocuk/PIN katmanı kullanıcıdan gizlenir. Kayıtta sporcu adı-soyadı alınır, girişte doğrudan Hızlı Erişim (`/home`) ekranı açılır.

## Kapsam

### 1. Üyelik (kayıt)
- Rol seçimi kalır: **Veli** / **Öğretmen**.
- **Veli** seçilince ek alan: **"Sporcu Adı Soyadı"** (zorunlu, min 2 karakter).
- Kayıtta: hesap (User, role=parent) + bu isimle bir ChildProfile (sporcu) oluşur.
- Yaş ve PIN kullanıcıya SORULMAZ. Sunucu varsayılan atar: yaş=10, PIN=rastgele (kullanılmaz). Migration yok (DB alanları zorunlu, sunucu default veriyor).
- Öğretmen akışı değişmez (sporcu alanı yok).

### 2. Giriş sonrası (veli/sporcu hesabı)
- `/parent/dashboard` (Çocuklarım) atlanır → doğrudan `/home` (Hızlı Erişim).
- `/home` üstünde sporcunun adı-soyadı görünür.
- Akıştan kalkan/gizlenen: "Çocuklarım", "Çocuk Ekle", "Kim oynuyor", "Çocuk Moduna Geç".
- Teknik: giriş → veli token'ı ile yeni endpoint `POST /auth/athlete/session` çağrılır → o hesabın **ilk** sporcu profili için child token döner (PIN yok, kendi hesabı). Frontend bu token'la `/home`'a gider.

### 3. Mevcut canlı hesaplar (geriye uyumlu)
- Girişte ilk (en eski) sporcu profiline düşer.
- Fazladan çocuk profilleri silinmez; verisi durur ama ekranda görünmez.
- Öğretmen ve admin akışları değişmez.
- Hiç çocuğu olmayan eski veli hesabı: girişte otomatik boş sporcu oluşturulmaz; bunun yerine kısa bir "Sporcu profili yok" bilgisi + tek seferlik sporcu ekleme formu gösterilir (aşağıya bak).

### 4. Kenar durum: çocuğu olmayan hesap
- `/auth/athlete/session` 404 dönerse (profil yok), frontend basit bir "Sporcu Bilgisi" formu gösterir (sadece ad-soyad) → `/auth/athlete/create` ile profil oluşturulur → tekrar session alınır → `/home`.
- Bu, hem yeni kenar durumları hem de eski boş hesapları kapsar.

## Kapsam Dışı
- Çoklu sporcu yönetimi, sporcu değiştirme UI.
- Yaş/seviye/PIN sorma.
- Öğretmen ve admin akışlarında değişiklik.
- Eski `child-login` / `parent/add-child` / `parent/dashboard` sayfalarının silinmesi (kalırlar, sadece ana akıştan link verilmez — geriye uyumluluk).

## Backend Değişiklikleri

### Yeni endpoint: `POST /auth/athlete/session`
- Auth: veli (parent) token.
- Davranış: current parent'ın en eski ChildProfile'ını bulur; child token üretir (mevcut child token yapısıyla aynı: `child_profile_id`, `parent_user_id`, `role=child`).
- Profil yoksa 404 (`{"detail":"No athlete"}`).
- Dönüş: `{ access_token, child_profile_id, display_name }`.

### Yeni endpoint: `POST /auth/athlete/create`
- Auth: veli (parent) token.
- Body: `{ full_name: str }` (min 2).
- Davranış: parent'a ChildProfile ekler (display_name=full_name, age=10, avatar=default, pin_hash=rastgele). Sonra child token döner (session ile aynı format).
- Not: idempotent değil; sadece "sporcu yok" akışında çağrılır.

### Signup değişikliği: `POST /auth/parent/signup`
- Body'ye opsiyonel `athlete_name: str | None` eklenir.
- Verilirse: user oluşturulduktan sonra ChildProfile eklenir (age=10, pin rastgele).
- Verilmezse: mevcut davranış (sadece hesap) — geriye uyumlu.

## Frontend Değişiklikleri

### Kayıt (`app/(auth)/parent-signup/page.tsx`)
- Rol=Veli iken "Sporcu Adı Soyadı" alanı görünür (zorunlu).
- Rol=Öğretmen iken alan gizli.
- Submit: parent ise `athlete_name` gönderilir. Kayıt başarılıysa → `/auth/athlete/session` → child token → `/home`. (Öğretmen: mevcut `/classes` akışı.)

### Giriş (`app/page.tsx`)
- `login` sonrası:
  - role teacher → `/admin` (mevcut).
  - role parent → `/auth/athlete/session` çağır:
    - 200 → child token kaydet → `/home`.
    - 404 → `/athlete-setup` (yeni sayfa: ad-soyad formu → `/auth/athlete/create` → `/home`).

### Yeni sayfa: `app/athlete-setup/page.tsx`
- Veli token gerektirir. Tek alan (Sporcu Adı Soyadı) → `/auth/athlete/create` → child token → `/home`.

### `/home` başlığı (`app/(child)/home/page.tsx`)
- Üstte sporcunun adı-soyadı gösterilir (child token'daki display_name veya profilden).
- Not: mevcut /home zaten child token ile çalışıyor; sadece sporcu adını görünür kılacağız (varsa mevcut selamlama düzenlenir).

### auth-context / api-client
- `apiClient.athleteSession()`, `apiClient.athleteCreate({full_name})` eklenir.
- Login sonrası child token'a geçiş: `auth.login(childToken, 'child', child_profile_id)`.

## Test

### Backend (pytest)
- `athlete/session`: profili olan parent → 200 + child token; profili olmayan → 404; yetkisiz (teacher/child) → 403/401.
- `athlete/create`: parent → profil oluşur + token; sonra session 200 döner.
- `parent/signup` + `athlete_name`: hesap + profil oluşur; session direkt 200.
- Mevcut testler kırılmaz (signup athlete_name opsiyonel).

### Frontend
- Mevcut smoke testleri geçer; signup formunda sporcu alanı koşullu render.

## Geriye Uyumluluk (KURAL #3)
- Migration yok; DB şeması değişmez.
- Mevcut endpoint'ler korunur; `parent/signup` alanı opsiyonel eklenir.
- Eski sayfalar (`parent/dashboard`, `child-login`, `add-child`) silinmez.
- Çok çocuklu eski hesaplar: ilk profile düşer, veri korunur.
- Deploy sırası: önce backend (Railway), sonra frontend (Vercel).

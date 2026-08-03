# Özel Sekme Oluşturucu (B Grubu) — Tasarım

> Bu spec, kullanıcının 7 maddelik admin-panel isteğinin **B grubunu** kapsar. A grubu
> (başlık düzenleme, zorluk renklendirme, sabit tahta) zaten tamamlanıp yayınlandı.
> C grubu (Tahtaya Çizim Sistemi) ayrı bir spec/plan döngüsüyle ele alınacak.

## Kapsam

Şu anki "Yeni Sekme Ekle" özelliği (Admin/Sekmeler) sadece hazır 5 sayfaya (bulmaca,
rozetler, günlük görev, tekrar, online maç) kısayol ekliyor. Bu özellik **tamamen
kaldırılıp** yerine gerçek bir içerik sayfası oluşturma sistemi gelecek:

- Zafer hoca sınırsız sayıda yeni sekme ekleyebilecek.
- Her sekmenin kendi sayfası olacak (link/kısayol değil).
- Sayfa sınırsız sayıda **bölüme** ayrılabilecek; her bölümde başlık + yazı +
  birden fazla görsel olacak.
- Sporcu tarafında yeni sekme, ana sayfadaki hızlı erişimde bir kart olarak
  görünecek; tıklanınca kendi sayfasına gidecek.
- Sekme ikonu (emoji) otomatik atanacak, hoca uğraşmayacak.

**Kullanıcı onayı ile kapsam dışı bırakılan:** Şu an panelde kayıtlı olabilecek eski
tip (kısayol) özel sekmeler bu güncellemeyle **silinecek** — hoca "hepsi silinsin,
sıfırdan başlansın" dedi. Geriye dönük taşıma/migration yapılmayacak.

## Veri modeli (backend)

İki yeni tablo — mevcut hiçbir tabloya dokunulmaz (KURAL #3):

```
custom_tabs
  id            INTEGER PK
  order_index   INTEGER
  label         VARCHAR(60)
  emoji         VARCHAR(10)

custom_tab_sections
  id              INTEGER PK
  custom_tab_id   INTEGER FK -> custom_tabs.id
  order_index     INTEGER
  title           VARCHAR(160)
  body            TEXT
  images          JSON   -- data-URI string listesi, örn. ["data:image/...", ...]
```

Görseller `pool_images`/soru-görseli deseniyle aynı şekilde data-URI olarak
saklanır (ayrı bir dosya depolama sistemi kurulmaz — projede zaten yok).
`_check_data_uri_size` (mevcut backend yardımcı fonksiyonu) her görsel için
tekrar kullanılır.

Neden ayrı tablo (AppSettings JSON blob'una eklemek yerine)? Ayarlar (`/settings`)
uygulamanın HER sayfa açılışında çekiliyor. İçindeki `customTabs` alanına görselli
bölümler eklenirse bu blob büyür ve her sayfa yüklemesini yavaşlatır. Ayrı tablo +
ayrı uç nokta, sadece ilgili sekme sayfası açıldığında içerik çeker — mevcut
`pool_images`/`openings` tablolarıyla aynı, kanıtlanmış desen.

## Backend uç noktaları

**Herkese açık (kimlik doğrulama gerekmez — `pool_images`/`openings` ile aynı desen):**
- `GET /custom-tabs` → `[{id, order_index, label, emoji}]` (sadece liste, görselsiz —
  ana sayfa hızlı erişim bunu kullanır, hafif kalır)
- `GET /custom-tabs/{id}` → `{id, label, emoji, sections: [{id, order_index, title, body, images}]}`

**Admin (mevcut `_ensure_admin` deseni, `apps/api/chess_api/routers/admin.py`'a eklenir):**
- `POST /admin/custom-tabs` `{label}` → emoji otomatik atanır, yeni sekme oluşturur
- `DELETE /admin/custom-tabs/{id}` → sekmeyi ve tüm bölümlerini siler (cascade)
- `POST /admin/custom-tabs/reorder` `{ordered_ids}` → `modules/reorder` ile aynı iki
  aşamalı yazım deseni (order_index UNIQUE çakışmasını önlemek için)
- `POST /admin/custom-tabs/{id}/sections` `{title, body, images}` → yeni bölüm ekler
- `PATCH /admin/custom-tab-sections/{id}` `{title?, body?, images?}` → bölüm günceller
- `DELETE /admin/custom-tab-sections/{id}` → bölüm siler
- `POST /admin/custom-tabs/{id}/sections/reorder` `{ordered_ids}` → bölüm sırası

**Emoji otomatik atama:** Sabit bir liste sırayla döner (mevcut 4 sekmenin emojileriyle
çakışmayan): `['📌', '⭐', '🎯', '📢', '🗂️', '🧭', '💡', '🔔']` — `order_index % 8`.

## Frontend — Admin tarafı

**`apps/web/app/admin/settings/tabs/page.tsx`'teki "Yeni Sekme Ekle" kartı** tamamen
değişir: eski "Nereyi açsın?" seçici (`TAB_DESTINATIONS`) kaldırılır, yerine sadece
"Sekme adı" girip "Ekle" butonu kalır (emoji otomatik). Eklenen sekmeler listesinde
artık "Kaldır" yanında **"İçeriği düzenle"** linki olur → `/admin/custom-tabs/{id}`.

**Yeni: `apps/web/app/admin/custom-tabs/[id]/page.tsx`** — bir sekmenin bölümlerini
yönetme ekranı. Ders-adımları ekranıyla (`admin/content/lesson/[lessonId]/page.tsx`)
aynı görsel dil: bölüm listesi (başlık + kısa önizleme + yukarı/aşağı/sil), altında
"Bölüm ekle" formu (başlık input, yazı textarea, görsel yükleme — mevcut
`compressImageToDataUri` + "Bilgisayardan Seç"/"Havuzdan Seç" deseni,
`ChoiceExerciseFields.tsx`'teki görsel yükleme bloğuyla aynı bileşenler yeniden
kullanılır).

`apps/web/app/admin/layout.tsx`'teki `NAV_GROUPS`'a ayrı bir link **eklenmez** —
sekme yönetimine her zaman Sekmeler ekranındaki "İçeriği düzenle" linkinden
gidilir (tutarlı: Ders İçeriği de aynı şekilde Sekmeler üzerinden erişiliyor).

## Frontend — Sporcu tarafı

**`apps/web/lib/settings/defaults.ts`:** `CustomTab` arayüzü ve `customTabs` alanı
`AppSettingsData`'dan **kaldırılır** (eski kısayol verisi artık okunmuyor —
`mergeSettings` fazladan alanı sessizce yok sayar, çökme olmaz). `TAB_DESTINATIONS`
sabiti de kaldırılır (kullanılmıyor).

**Yeni: `apps/web/lib/customTabsApi.ts`** — `listCustomTabs()` (`GET /custom-tabs`),
`getCustomTab(id)` (`GET /custom-tabs/{id}`).

**`apps/web/app/(child)/home/page.tsx`:** `settings.customTabs` yerine
`listCustomTabs()` ile ayrı bir `useEffect`/state üzerinden çekilir; `FeatureTab`
render'ı `href={`/custom/${ct.id}`}` olarak güncellenir (buton yerine her zaman link,
çünkü artık kendi sayfası var — akordiyon açılmıyor).

**Yeni: `apps/web/app/(child)/custom/[id]/page.tsx`** — `getCustomTab(id)` ile
veri çeker, geri dönüş oku + sekme emoji/başlığı + bölümleri sırayla
(başlık/yazı/görsel galerisi) render eder. Bölüm yoksa "Henüz içerik eklenmedi"
mesajı gösterir (boş sekme oluşturulup unutulursa sporcu boş ekranla karşılaşmaz).

## Test planı

- Backend: `_ensure_admin` korumalı uç noktalar için yetki testleri; sekme/bölüm
  CRUD testleri; reorder iki-aşamalı yazım testi; emoji otomatik atama testi;
  görsel boyut doğrulama testi (`_check_data_uri_size` reuse).
- Frontend: admin sekme ekleme formu (emoji seçici YOK, sadece ad) testi; bölüm
  ekleme/düzenleme/silme/sıralama testleri; sporcu ana sayfada özel sekme kartı
  render + link testi; `/custom/[id]` sayfası bölüm render testi (boş durum dahil).
- Tam gate: `npx tsc --noEmit && npx next lint && npx vitest run` (apps/web),
  `python -m pytest -q` (apps/api).
- Canlı doğrulama (KURAL #6): yeni sekme ekle → bölüm ekle (görselli) → sporcu
  ana sayfada kartı gör → tıkla → sayfanın doğru render olduğunu doğrula.

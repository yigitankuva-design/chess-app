# Sporcu Paneli Yönetimi — Tasarım Belgesi

Tarih: 2026-07-18
Durum: Onaylandı (mimari + fazlama), Faz 1 detaylı

## Amaç

Zafer hoca'nın (öğretmen/admin) sporcu (öğrenci) ekranındaki **görünümü ve yazıları**
kod değişikliği olmadan, admin panelinden yönetebilmesi. Adminde yapılan her değişiklik
sporcu ekranına **otomatik** yansır. Kapsam: arayüz yazıları/etiketleri, tahta kare
renkleri, özel taş görselleri ve sekme görünürlüğü.

## Hedef olmayan (Non-goals)

- **Sporcu-başına** özelleştirme yok. Ayarlar **tüm akademi için tek** (global). (Onaylandı.)
- Müfredat içeriği (düzey/ders/adım/soru) bu işin parçası değil — mevcut CMS'i korunur,
  sadece admin menüsündeki adı "İçerik" → "Ders" olur.
- Çoklu tema/marka, çoklu dil, A/B test yok.

## Değişmez kurallar

- **KURAL #1** — Uydurma yok; davranış koddan/testten doğrulanır.
- **KURAL #3** — Canlı sporcuları bozma. Tüm değişiklikler geriye dönük uyumlu. `/settings`
  yanıtı **eksik/boşsa sporcu app mevcut kodlanmış varsayılanlara döner** (fail-safe).
- **KURAL #4** — Müfredat tabloları (modules/lessons/lesson_steps/child_lesson_progress/
  child_lesson_step_results) TRUNCATE/DELETE edilmez. Bu iş yeni bir tablo ekler, mevcutlara
  dokunmaz.

## Mimari — tek "ayarlar omurgası"

Yazılar + tahta/taş görünümü + sekme görünürlüğü hepsi tek bir yerde saklanır.

### Backend

- **Yeni tablo `app_settings`**: tek satırlı, `id`, `data JSONB`, `updated_at`. (Ayrı sütunlar
  değil; yeni ayar eklemek migration gerektirmesin diye tek JSON blob.)
- **`GET /settings`** — herkese açık (auth yok), sporcu app okur. Cache'lenebilir. Satır yoksa
  varsayılan boş `{}` döner; app varsayılanlara düşer.
- **`PATCH /admin/settings`** — sadece `role == teacher`. Gelen JSON'u mevcut `data` ile
  **derin birleştirir** (kısmi güncelleme), doğrular, kaydeder.
- **Taş görselleri (Faz 4)**: Railway object storage bucket'a yüklenir; public URL'ler
  `data.board.pieces` altında saklanır. Yükleme endpoint'i doğrulama yapar (format, boyut).

### Ayarlar JSON şeması (kademeli dolar; her alan opsiyonel)

```jsonc
{
  "labels": {                    // Faz 1
    "levels": { "1": "Temel Düzey", "2": "Başlangıç Düzeyi", "3": "Orta Düzey", "4": "İleri Düzey" },
    "features": { "play": "Oyna", "lessons": "Dersler", "puzzle": "Bulmaca", "badges": "Rozetler" },
    "sections": { "quickAccess": "Hızlı Erişim", "lessonsPick": "Dersler — Düzey Seç" }
  },
  "tabs": {                      // Faz 2  — true=görünür
    "play": true, "puzzle": true, "badges": true
  },
  "board": {                     // Faz 3 renkler, Faz 4 taşlar
    "lightSquare": "#eef0fb",
    "darkSquare": "#c3c6ee",
    "pieces": { "wK": "https://.../wK.png", "...": "..." }  // Faz 4; yoksa gömülü SVG seti
  }
}
```

### Frontend consumption

- Yeni **`SettingsProvider`** (React context): app açılışında `GET /settings` çağırır,
  sonucu context'e koyar. Ağ hatası/boş → kodlanmış varsayılanlar (fail-safe).
- Sporcu ekranları sabit yazılar yerine `useSettings().labels...` okur.
- `lib/chess/boardSkin.tsx` renk/taş sabitleri, ayar varsa onunla override edilir; yoksa
  mevcut değerler (bugünkü görünüm) korunur.

## Yeni admin sol panel yapısı

```
ADMIN
  • Kullanıcılar              (/admin/parents)
SPORCU PANELİ
  • Ders                     (/admin/content   — mevcut CMS, yeni ad)
  • Yazılar & Etiketler      (/admin/settings/labels)     [Faz 1]
  • Sekmeler                 (/admin/settings/tabs)       [Faz 2]
  • Görünüm — Tahta & Taş    (/admin/settings/board)      [Faz 3-4]
```

Bölüm başlıkları ("ADMIN", "SPORCU PANELİ") gruplayıcı etiketlerdir; böylece neyin
yönetildiği belli olur.

## Fazlama

Her faz kendi spec-detayı → plan → uygulama → test kapısı döngüsünden geçer. Her faz sonunda
çalışan, canlıya güvenle çıkabilen bir sürüm olur.

### Faz 1 — İskelet + Yazılar (bu spec'in detaylandırdığı faz)
- `app_settings` tablosu + Alembic migration (yalnızca yeni tablo; yıkıcı değil).
- `GET /settings`, `PATCH /admin/settings` endpoint'leri + doğrulama + backend testleri.
- Admin sol panel yeniden düzeni (Admin / Sporcu Paneli grupları, "İçerik"→"Ders").
- `/admin/settings/labels` editörü: düzey adları, buton/başlık yazıları düzenlenir, kaydedilir.
- `SettingsProvider` + sporcu ana sayfa (home) ve düzey/başlık yazılarının ayardan okunması.
- Fail-safe: ayar yoksa bugünkü yazılar aynen görünür.

### Faz 2 — Sekme görünürlüğü
- `data.tabs` + `/admin/settings/tabs` editörü (aç/kapa).
- Sporcu home + AppNav gizli sekmeleri göstermez; doğrudan URL erişimi de kapalı sekmeyi engeller.

### Faz 3 — Tahta renkleri
- `data.board.lightSquare/darkSquare` + `/admin/settings/board` renk seçici + canlı önizleme.
- `boardSkin` renkleri ayardan override; tüm tahtalarda uygulanır.

### Faz 4 — Özel taş yükleme (en ağır, en sona)
- 12 taş için görsel yükleme (PNG/SVG, boyut/format doğrulama) → Railway object storage.
- `data.board.pieces` URL'leri; sporcu tahtası `<img>` ile özel taşları render eder; eksik
  taş için gömülü SVG'ye düşer.
- Ek risk: dosya yükleme güvenliği, depolama, bozuk görsel → bu yüzden ayrı faz ve ekstra test.

## Test yaklaşımı

- Backend: `app_settings` GET/PATCH, yetki (teacher-only PATCH), kısmi merge, boş-satır
  fail-safe, doğrulama hataları — pytest.
- Frontend: SettingsProvider varsayılana düşme, editör kaydetme, sporcu ekranının ayardan
  okuması — vitest; canlı önizlemede CEO doğrulaması.
- Her faz: tsc + lint + vitest + pytest kapısı geçmeden "bitti" yok.

## Riskler ve önlemler

- **Canlı sporcu görünümü bozulur** → Fail-safe varsayılanlar; ayar yoksa/eksikse bugünkü
  hâl. Migration yalnızca yeni tablo ekler.
- **Yanlış/boş ayar tüm sporcuları etkiler (global)** → PATCH doğrulaması (renk formatı, bilinen
  anahtarlar); editörde "varsayılana dön" butonu.
- **Taş yükleme (Faz 4) kötüye kullanımı** → format/boyut doğrulama, yalnız teacher, ayrı faz.

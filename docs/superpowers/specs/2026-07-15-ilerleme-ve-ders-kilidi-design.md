# Parça 4 — Sunucu İlerleme Kaydı + Ders Kilidi — Tasarım

Tarih: 2026-07-15
Durum: Onaylandı (kullanıcı, sohbet içinde)

## Bağlam ve Sorun

Zafer hoca "önceki ders bitmeden sonraki kilitli olsun" istiyor. Ama kod incelemesi gösterdi ki **"ders bitti" bilgisinin sunucuda karşılığı yok**:

- Canlı oynatıcı `app/(child)/modules/[id]/page.tsx`, ilerlemeyi **yalnızca localStorage'da** tutuyor (`bea_s_*`, `bea_l_*` anahtarları).
- `POST /lessons/{id}/complete` endpoint'i **var ve çalışıyor** (child token ister, `child_lesson_progress` yazar, rozet/XP verir) — ama **sadece ölü koddan** (`app/(child)/lesson/[id]`, LessonPlayer) çağrılıyor. Canlı oynatıcı hiç çağırmıyor.
- Sonuç: `child_lesson_progress` tablosu **boş**. Admin panelinde her çocuk **"0 ders tamamlandı"** görünüyor. 1a'daki "ilerlemesi olan ders silinemez" koruması pratikte hiç devreye girmiyor.
- Çocuğun ilerlemesi tarayıcı verisi silinince kayboluyor, başka cihazda sıfırdan başlıyor.

Kilidi bu temele kurmak yanlış olur. Bu yüzden iş ikiye ayrılır.

## Kararlar (kullanıcı onaylı)

| Karar | Seçim |
|---|---|
| Kilit temeli | **Önce ilerlemeyi sunucuya kaydet**, kilidi ona dayandır |
| Kilit kapsamı | **Sadece ders bazında** (bir düzey içinde). Düzeyler serbest. |
| Resimli alıştırma (Parça 3) | Atlandı |

## 4a — Sunucu Tarafı İlerleme Kaydı

### Backend

**Yeni endpoint:** `GET /lessons/progress`
- Auth: child token (`get_current_child`)
- Dönüş: `{ "completed_lesson_ids": [int] }`
- `child_lesson_progress`'ten `status == completed` olanlar.

**Yeni endpoint:** `POST /lessons/progress/sync`
- Auth: child token
- Body: `{ "completed_lesson_ids": [int] }`
- Mevcut çocukların localStorage'daki ilerlemesini tek seferlik sunucuya taşır.
- Davranış: verilen id'lerden DB'de kaydı olmayanlar `completed` olarak eklenir. **Var olan kayıtlara dokunulmaz, hiçbir şey silinmez.**
- Bilinmeyen ders id'leri sessizce atlanır (silinmiş ders olabilir).
- Dönüş: `{ "synced": N }`

`POST /lessons/{id}/complete` **değişmez** — zaten doğru çalışıyor.

### Frontend (canlı oynatıcı `/modules/[id]`)

1. **Açılışta:** `GET /lessons/progress` çağrılır → `doneLessons` sunucudan gelir.
2. **Tek seferlik senkron (KURAL #3):** localStorage'da tamamlanmış ama sunucuda olmayan ders varsa `POST /lessons/progress/sync` ile gönderilir, sonra progress yeniden okunur. `bea_synced` bayrağıyla bir kez çalışır.
3. **Ders bitince:** `POST /lessons/{id}/complete` çağrılır (şu an hiç çağrılmıyor) + localStorage yine yazılır.
4. **localStorage korunur** — çevrimdışı/ağ hatası durumunda oynatıcı çalışmaya devam eder; sunucu **doğruluk kaynağıdır**, localStorage önbellektir.
5. **Ağ hatası:** progress okunamazsa localStorage'a düşülür (oynatıcı kilitlenmez).

### Kazanımlar
- Çocuk ilerlemesi kalıcı, cihazlar arası taşınır.
- Admin panelindeki "0 ders tamamlandı" **düzelir** — Zafer öğrencinin gerçek ilerlemesini görür.
- "İlerlemesi olan ders silinemez" koruması gerçekten devreye girer.
- Rozet/XP ödülleri (complete endpoint'inde zaten var) artık gerçekten veriliyor.

## 4b — Ders Kilidi

- Bir düzey içinde dersler `order_index` sırasına göre: **önceki ders tamamlanmadan sonraki kilitli**.
- **İlk ders her zaman açık.**
- Kilit **hesaplanan** durumdur, saklanmaz. Ölü `LessonStatus.locked` enum değeri **kullanılmaz**.
- Kaynak: `GET /lessons/progress`'ten gelen `completed_lesson_ids`.
- UI: kilitli ders soluk + 🔒, tıklanamaz, altında "Önce *{önceki ders başlığı}* dersini bitir".
- **Sunucu tarafı zorlama YOK** — kilit yalnızca UI rehberliğidir. Ders içeriği endpoint'i (`GET /lessons/{id}`) zaten herkese açık; bunu kısıtlamak ayrı bir güvenlik işi ve kapsam dışı. (Dürüst sınır: teknik bilgisi olan çocuk URL ile atlayabilir; hedef pedagojik yönlendirme.)

## Kapsam Dışı

- Düzey (modül) kilidi — düzeyler serbest kalır
- Adım kilidi — `isStepAccessible` ile zaten var, dokunulmaz
- Ölü kod temizliği (`/lesson/[id]`, LessonPlayer, InlineExerciseStep)
- Ders içeriğine sunucu tarafı erişim kısıtı
- Resimli alıştırma

## Test

**Backend (pytest):**
- `GET /lessons/progress`: tamamlanmış ders id'lerini döner; child token yoksa 401
- `GET /lessons/progress`: hiç ilerleme yoksa boş liste
- `POST /lessons/progress/sync`: DB'de olmayan id'ler eklenir, `synced` sayısı doğru
- `POST /lessons/progress/sync`: **var olan kayıt bozulmaz**, tekrar çalıştırılınca çoğaltmaz (idempotent)
- `POST /lessons/progress/sync`: bilinmeyen ders id'i sessizce atlanır (hata vermez)
- `POST /lessons/{id}/complete` sonrası `GET /lessons/progress` o dersi içerir (uçtan uca)
- Mevcut testler kırılmaz

**Frontend:** tsc temiz; mevcut testler kırılmaz.

## Geriye Uyumluluk (KURAL #3)

- Migration YOK — `child_lesson_progress` tablosu zaten var.
- Mevcut 12 çocuğun localStorage ilerlemesi **tek seferlik senkronla korunur**.
- Ağ hatasında oynatıcı localStorage ile çalışmaya devam eder — kimse kilitli kalmaz.
- İlk ders her zaman açık — yeni çocuk başlayabilir.
- Canlı oynatıcıya dokunulduğu için deploy sonrası tarayıcıda gerçek akış doğrulanacak.
- Deploy sırası: önce backend (Railway), sonra frontend (Vercel).

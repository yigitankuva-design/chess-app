# Parça 0 — İçerik Güvenliği — Tasarım

Tarih: 2026-07-15
Durum: Onaylandı (kullanıcı, sohbet içinde)

## Bağlam

Zafer hoca (satranç hocası) admin panelinden kendi ders/soru içeriğini girecek ve zamanla uygulamayı dolduracak. Ciddi emek verilecek. Bu parça, o emeğin kaybolmamasını sağlayan ön koşuldur — CMS (Parça 1) yazılmadan önce yapılır.

İçerik şu an Alembic migration'larıyla ekleniyor (yazılımcı işi). Panelde İçerik bölümü salt okunur.

## Amaç

1. İçeriğin tek tuşla JSON olarak dışa aktarılması (Zafer kendi yedeğini alabilsin).
2. Bu JSON'dan **ilerlemeyi bozmadan** geri yükleme.
3. Gelecekte kimsenin müfredatı yanlışlıkla silememesi (TRUNCATE yasağı + CI testi).

## Kritik Teknik Kısıt (tasarımı belirleyen)

`child_lesson_progress.lesson_id` → `lessons.id` ve `child_lesson_step_results.lesson_step_id` → `lesson_steps.id` FK'leri var.

Geri yükleme "hepsini sil, JSON'dan yeniden kur" olursa ders/adım ID'leri değişir → **çocukların tüm ilerlemesi kırılır veya silinir**. Bu yüzden geri yükleme **upsert (ID koruyarak güncelle/ekle)** olmalı, asla toplu silme yapmamalı.

## 1. Dışa Aktarma

**Endpoint:** `GET /admin/content/export` — sadece `UserRole.teacher` (mevcut `_ensure_admin`).

**Dönüş (JSON):**
```json
{
  "exported_at": "2026-07-15T10:00:00",
  "version": 1,
  "modules": [
    {
      "id": 1,
      "order_index": 1,
      "name": "Temel Düzey",
      "description": "...",
      "icon": "pawn",
      "lessons": [
        {
          "id": 1,
          "order_index": 1,
          "title": "Tahta ve Taşlar",
          "estimated_minutes": 20,
          "steps": [
            {
              "id": 1,
              "order_index": 1,
              "type": "explanation",
              "content_json": {...},
              "correct_answer_json": {...}
            }
          ]
        }
      ]
    }
  ]
}
```

- ID'ler **zorunlu** — geri yüklemenin ilerlemeyi koruması buna bağlı.
- `correct_answer_json` dahil (admin-only endpoint, sorun değil).

**Frontend:** `/admin/content` sayfasında **"İçeriği indir"** butonu → tarayıcı `agep-icerik-YYYY-MM-DD.json` olarak indirir (Blob + object URL).

## 2. Geri Yükleme

**Endpoint:** `POST /admin/content/import` — sadece teacher.

**Body:** export ile aynı şema (`{version, modules:[...]}`).

**Davranış — upsert, ASLA silme:**
- Modül: `id` varsa ve DB'de bulunuyorsa → alanları güncelle. Yoksa → yeni modül ekle (yeni ID alır).
- Ders: aynı mantık, `module_id` üstteki modüle bağlanır.
- Adım: aynı mantık, `lesson_id` üstteki derse bağlanır.
- JSON'da yer almayan mevcut kayıtlara **dokunulmaz** (silinmez).
- Sonuç: yanlışlıkla düzenlenen içerik geri gelir; ders ID'leri korunduğu için çocuk ilerlemesi sağlam kalır.

**Doğrulama:**
- `version` beklenen değilse 400.
- `type` geçerli bir `LessonStepType` değilse 400 (o adım için).
- Body şema dışıysa 422 (Pydantic).

**Dönüş (özet):**
```json
{"modules_updated": 3, "modules_created": 0, "lessons_updated": 5, "lessons_created": 2, "steps_updated": 12, "steps_created": 4}
```

**Frontend:** `/admin/content` sayfasında **"İçerik yükle"** — dosya seç → **önce özet gösterilmez** (dry-run bu turda YOK, YAGNI); doğrudan yükler ve dönen özeti ekranda gösterir: "3 modül güncellendi, 2 ders eklendi." Yükleme butonu bir onay adımı arkasında ("Bu işlem mevcut içeriği günceller. Devam?").

## 3. TRUNCATE Yasağı + Koruma Testi

**Kural (CLAUDE.md'ye eklenir):** İçerik tablolarını (`modules`, `lessons`, `lesson_steps`, `child_lesson_progress`, `child_lesson_step_results`) toplu silen (TRUNCATE / DELETE FROM) migration yazılmaz. İçerik artık kullanıcı verisidir, seed değildir.

**Test:** `apps/api/tests/test_migration_guard.py`
- `alembic/versions/*.py` dosyalarını okur.
- İçerik tablolarında `TRUNCATE TABLE x` veya `DELETE FROM x` geçen dosyaları bulur.
- **İzin listesi** (zaten çalışmış eski dosyalar):
  - `20260529_ResetCurriculum_clear_lessons_set_4_modules.py`
  - `20260529_ResetCurriculum3_remove_old_seed_modules.py`
  - `20260529_Lesson1_TahtaVeTaslar.py`
- İzin listesi dışında böyle bir dosya varsa test **fail** eder (CI kırmızı).

Not: İzin listesindeki dosyalar tarihsel; silinmezler (alembic zinciri bozulmasın).

## Kapsam Dışı

- Otomatik/zamanlanmış yedek.
- Railway Postgres yedek ayarı (kullanıcı panelden doğrulayacak — kod değil).
- Dry-run/önizleme ekranı.
- İçerik silme özelliği (Parça 1'de ele alınır).

## Test

**Backend (pytest):**
- `export`: teacher → 200 + modül/ders/adım ağacı ID'lerle; parent → 403.
- `import`: mevcut ID'yi günceller (ders ID'si değişmez), yeni kaydı ekler, JSON'da olmayanı silmez.
- `import` ilerlemeyi korur: bir çocuğun `child_lesson_progress` kaydı import sonrası hâlâ duruyor.
- `import` yetkisiz (parent) → 403; bozuk version → 400.
- migration guard testi: izin listesi dışında TRUNCATE yoksa geçer.

**Frontend:** tsc temiz; mevcut testler kırılmaz.

## Geriye Uyumluluk (KURAL #3)

- Migration YOK (yeni tablo/alan yok).
- Mevcut endpoint/sayfalar korunur; sadece `/admin/content` sayfasına iki buton eklenir.
- Import upsert olduğu için mevcut içerik ve çocuk ilerlemesi risk altında değil.
- Deploy sırası: önce backend (Railway), sonra frontend (Vercel).

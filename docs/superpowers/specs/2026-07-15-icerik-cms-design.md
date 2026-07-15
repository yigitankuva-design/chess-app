# Parça 1 — İçerik CMS Temeli — Tasarım

Tarih: 2026-07-15
Durum: Onaylandı (kullanıcı, sohbet içinde)

## Bağlam

Zafer hoca (satranç hocası) kendi müfredatını panelden girecek: düzeyler (Temel/Başlangıç/Orta/İleri), her düzeyin altında ders başlıkları (örn. Temel'in altına 8 başlık) ve her dersin içinde içerik adımları. Oluşturduğu içeriği **istediği düzeye ve derse atayabilmeli**.

İçerik şu an sadece Alembic migration'larıyla ekleniyor (yazılımcı işi). Panelde İçerik bölümü salt okunur (Parça 0'da export/import eklendi).

## Yapı Eşlemesi (mevcut model zaten uyuyor)

| Zafer'in dili | Model |
|---|---|
| Düzey (Temel/Başlangıç/Orta/İleri) | `Module` |
| Ders başlığı | `Lesson` |
| İçerik (anlatım/soru) | `LessonStep` |

Canlıda hâlihazırda 4 modül var.

## Kritik Kısıtlar (tasarımı belirleyen)

1. **`modules.order_index` UNIQUE** — sıralama naif yazılırsa unique çakışması verir. İki aşamalı yazılmalı (önce geçici negatif değerler, sonra kesin değerler).
2. **`child_lesson_progress.lesson_id` → `lessons.id`** FK — ilerlemesi olan ders silinemez.
3. **`child_lesson_step_results.lesson_step_id` → `lesson_steps.id`** FK — adım silinirken bu kayıtlar da silinmeli.
4. **Oynatıcının beklediği `content_json` şekilleri** (editör bunlara birebir uymalı, yoksa çocukta bozuk görünür):
   - `explanation`: `{title?: str, body?: str, fen?: str, highlight_squares?: str[]}`
   - `quiz`: `{questions: [{prompt: str, options: str[], correct_index: int}]}`

## 1. Şema Değişikliği (migration)

`lessons` tablosuna `published` eklenir:

```python
op.add_column('lessons', sa.Column('published', sa.Boolean(), nullable=False, server_default='true'))
```

- `server_default='true'` → **mevcut dersler yayında kalır**, çocuklar erişimini kaybetmez (KURAL #3).
- Model: `published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)`
- Panelden açılan **yeni dersler taslak başlar**: create endpoint açıkça `published=False` geçer.
- Çocuk tarafı endpoint'i (`GET /modules/{id}/lessons`, lessons router) `Lesson.published == True` filtreler.
- Admin tarafı hem taslak hem yayında dersleri görür (`published` alanı yanıta eklenir).

## 2. Düzey (Modül) Yönetimi

| Endpoint | İş |
|---|---|
| `POST /admin/modules` | Ekle. Body: `{name, description, icon}`. `order_index` = mevcut max + 1 (otomatik). |
| `PATCH /admin/modules/{id}` | Düzenle. Body: `{name?, description?, icon?}` |
| `POST /admin/modules/reorder` | Sırala. Body: `{ordered_ids: [int]}`. **İki aşamalı** yazım (unique). |
| `DELETE /admin/modules/{id}` | Sil. İçinde ders varsa **409** ("Önce dersleri taşıyın/silin"). |

## 3. Ders (Başlık) Yönetimi

| Endpoint | İş |
|---|---|
| `POST /admin/modules/{module_id}/lessons` | Ekle. Body: `{title, estimated_minutes}`. `published=False`, `order_index` = modüldeki max + 1. |
| `PATCH /admin/lessons/{id}` | Düzenle. Body: `{title?, estimated_minutes?, module_id?}` — **`module_id` verilirse ders o düzeye taşınır** (Zafer'in "istediği düzeye atama"sı). Taşınınca `order_index` yeni modüldeki max + 1 olur. |
| `POST /admin/lessons/{id}/publish` | Body: `{published: bool}` — yayınla / taslağa al. |
| `POST /admin/modules/{module_id}/lessons/reorder` | Sırala. Body: `{ordered_ids: [int]}`. (`lessons.order_index` unique değil, tek aşama yeter.) |
| `DELETE /admin/lessons/{id}` | Sil. `child_lesson_progress` veya `child_lesson_step_results` varsa **409**: *"Bu derse ait çocuk ilerlemesi var. Yayından kaldırabilirsiniz."* Yoksa adımlarıyla birlikte silinir. |

## 4. İçerik (Adım) Yönetimi

| Endpoint | İş |
|---|---|
| `POST /admin/lessons/{lesson_id}/steps` | Ekle. Body: `{type, content_json, correct_answer_json?}`. `order_index` = derste max + 1. |
| `PATCH /admin/steps/{id}` | Düzenle. Body: `{content_json?, correct_answer_json?, lesson_id?}` — **`lesson_id` verilirse adım o derse taşınır** ("istediği derse atama"). |
| `POST /admin/lessons/{lesson_id}/steps/reorder` | Sırala. Body: `{ordered_ids: [int]}`. |
| `DELETE /admin/steps/{id}` | Sil. **O adıma ait `child_lesson_step_results` kayıtları da silinir** (ders tamamlama ilerlemesi etkilenmez). Yanıt: `{deleted: true, results_deleted: N}`. |

**Adım tipleri (Parça 1):**
- `explanation` → `content_json = {title, body}` (fen Parça 2'de)
- `quiz` → `content_json = {questions: [{prompt, options, correct_index}]}`

**Doğrulama:** `type` geçerli `LessonStepType` olmalı; `quiz` için `questions` boş olamaz ve her sorunun `correct_index`'i `options` aralığında olmalı → aksi halde 400.

## 5. Panel Sayfaları

- `/admin/content` — düzey listesi + **Düzey ekle** + sırala + düzenle/sil
- `/admin/content/[id]` — o düzeyin ders listesi + **Ders ekle** + yayınla/taslak rozeti + sırala + **düzey değiştir (taşı)** + sil
- `/admin/content/lesson/[lessonId]` — **yeni**: adım editörü (anlatım/quiz ekle-düzenle-sırala-sil + başka derse taşı)

Taslak dersler panelde "Taslak" rozetiyle görünür.

## 6. Kapsam Dışı

- **Kilit / kademeli ilerleme** — `LessonStatus.locked` enum'da var ama kodda hiç kullanılmıyor (ölü kod). Sıralı kilit mekanizması yok. Zafer hocaya net sorulup ayrı parça olarak tasarlanacak.
- Tahta/FEN editörü (Parça 2), resimli alıştırma (Parça 3).
- Toplu import (Parça 0'daki JSON import dışında).

## 7. Uygulama Bölünmesi

Bu spec iki plana bölünerek uygulanır; her biri tek başına canlıya çıkabilir:

- **1a:** migration (`published`) + çocuk tarafı filtresi + Düzey CRUD + Ders CRUD/publish/taşı + sıralama
- **1b:** Adım (içerik) editörü: step CRUD/taşı/sırala + panel sayfası

## Test

**Backend (pytest):**
- Migration sonrası mevcut dersler `published=True` (server_default doğrulaması).
- Çocuk endpoint'i taslak dersi **döndürmez**; yayında olanı döndürür.
- Modül sıralama unique çakışması vermez (iki aşamalı yazım testi).
- İlerlemesi olan ders silinemez (409); ilerlemesi olmayan silinir.
- İçinde ders olan modül silinemez (409).
- Ders `module_id` ile başka düzeye taşınır.
- Adım silinince `child_lesson_step_results` de silinir, `child_lesson_progress` **durur**.
- Quiz doğrulaması: `correct_index` aralık dışıysa 400.
- Tüm admin endpoint'leri parent token ile 403.

**Frontend:** tsc temiz; mevcut testler kırılmaz.

## Geriye Uyumluluk (KURAL #3)

- Tek migration: `lessons.published` eklenmesi, `server_default='true'` → mevcut içerik ve çocuk erişimi etkilenmez.
- Mevcut endpoint'ler ve sayfalar silinmez.
- KURAL #4 (müfredatı silen migration yazılmaz) korunur — bu migration sadece kolon ekler.
- Deploy sırası: önce backend (Railway, migration dahil), sonra frontend (Vercel).

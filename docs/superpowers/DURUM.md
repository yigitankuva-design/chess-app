# Durum ve Devir Notu

Son güncelleme: 2026-07-15

## Bir cümlede

Zafer hoca'nın (Bozüyük Satranç Akademisi) kendi müfredatını panelden girip zamanla
doldurabilmesi için CMS kuruldu. Sıradaki iş: **çocukların ilerlemesini sunucuya kaydetmek**
(plan hazır), ardından ders kilidi.

## SIRADAKİ İŞ

**Plan hazır ve onaylı — doğrudan uygulanabilir:**

```
docs/superpowers/plans/2026-07-15-ilerleme-kaydi-4a.md
```

Yeni oturumda: *"bu planı executing-plans ile uygula"*.

Sonrasında **4b (ders kilidi)** için plan yazılacak — spec'i hazır:
`docs/superpowers/specs/2026-07-15-ilerleme-ve-ders-kilidi-design.md`

## Tamamlananlar (hepsi canlıda, doğrulandı)

| Parça | İçerik |
|---|---|
| **0 — İçerik güvenliği** | `GET/POST /admin/content/export|import` (upsert, asla silmez) · TRUNCATE koruma testi + CLAUDE.md KURAL #4 |
| **1a — Düzey/ders yönetimi** | `lessons.published` migration (server_default=true) · düzey CRUD + iki aşamalı sıralama · ders CRUD/yayınla/taşı · ilerlemesi olan ders silinemez (409) |
| **1b — Adım editörü** | anlatım + quiz adımları: ekle/düzenle/sırala/sil/taşı |
| **2 — Tahta editörü** | `BoardEditor` (palet + tıkla-yerleştir) · 3 alıştırma türü · python-chess doğrulaması |
| **3 — Resimli alıştırma** | **ATLANDI** (kullanıcı kararı — depolama altyapısı gerektiriyordu) |

Ayrıca: uygulama adı **AGEP**, koyu-neon tema (giriş + admin), sporcu modeli
(kayıtta sporcu adı, girişte doğrudan `/home`), PIN'siz çocuk modu, admin paneli.

**Testler:** backend **163**, frontend **24**, tsc temiz.

## KRİTİK BULGULAR — tekrar keşfetme, tekrar tuzağa düşme

### 1. Canlı oynatıcı `/modules/[id]` — `/lesson/[id]` ÖLÜ KOD
- Çocuklar `/home → Dersler → /modules/{id}` yolundan girer.
- `app/(child)/lesson/[id]`, `LessonPlayer`, `InlineExerciseStep`, `inline_exercise`
  adım türü → **hiçbir yerden link verilmiyor. Dokunma, üzerine iş yapma.**

### 2. Alıştırmalar anlatım adımının İÇİNDE
- `explanation` adımının `content_json`'u: `{title, body, board_exercises: [...]}`
- Render eden: `components/lesson-steps/BoardExercise.tsx`
- 3 tür: `click_square` · `move_piece` · `identify_piece`
- Zafer'in canlı müfredatı: ders 42 "Tahta ve Taşlar" = 6 anlatım adımı × 10 alıştırma = **60 alıştırma**

### 3. `board.is_valid()` KULLANMA
- Hocanın öğretim pozisyonları kasten **şahsız**:
  `8/8/8/8/8/8/8/8 w - - 0 1` · `8/8/8/8/8/8/4P3/8 w - - 0 1` · `8/8/8/8/4n3/8/8/8 b - - 0 1`
- `is_valid()` üçüne de `False` döner → bu kural **mevcut 60 alıştırmayı reddeder**.
- Sadece FEN **parse** kontrolü yapılır. `legal_moves` şahsız tahtada **çalışır** (doğrulandı).

### 4. İlerleme sunucuya YAZILMIYOR ← sıradaki işin sebebi
- Canlı oynatıcı ilerlemeyi **sadece localStorage**'da tutuyor (`bea_s_*`, `bea_l_*`).
- `POST /lessons/{id}/complete` **var ve doğru çalışıyor** ama sadece ölü koddan çağrılıyor.
- Sonuç: `child_lesson_progress` **boş** → admin panelinde herkes **"0 ders tamamlandı"**.
- 1a'daki "ilerlemesi olan ders silinemez" koruması pratikte hiç devreye girmiyor.
- Adım bazında kilit **zaten var** (`isStepAccessible`, client-side); ders bazında **yok**.

### 5. Editör için `ChessBoard` kullanılamaz
- `components/ChessBoard.tsx` satranç kurallarını zorluyor (sıradaki rengin taşı, legal hamle).
- Pozisyon kurmak için `react-chessboard` doğrudan kullanılır (`BoardEditor.tsx` böyle yapıyor).

### 6. Diğer
- Terfi hamlesi `{from,to}` ile ifade edilemiyor (`e7e8` illegal, sadece `e7e8q` legal) → editör reddediyor.
- Alıştırma cevapları içerikte (istemci kontrolü) — çocuk devtools ile görebilir. Bilinen sınır.
- `modules.order_index` **UNIQUE** → sıralama iki aşamalı yazılmalı.
- Windows: Python dosya okurken `encoding="utf-8"` şart (cp1254 hatası). Git Bash curl'de Türkçe karakter bozuluyor — tarayıcı sorunsuz.

## Ortam

- **Frontend:** https://chess-app-web-one.vercel.app (Vercel projesi `chess-app-web`)
- **Backend:** https://chess-app-production-1dab.up.railway.app (Railway `chess-app`)
- **Deploy:** `main`'e push → otomatik. **Sıra: önce backend, sonra frontend.**
- **Test:** `cd apps/api && ./.venv/Scripts/python.exe -m pytest tests/ -q` · `cd apps/web && npx tsc --noEmit && npx vitest run`
- Öğretmen rolü = admin. Test için: `POST /auth/teacher/signup` (name **min 2 karakter**).

## Kullanıcıda duran işler

1. **PITR'ı aç** — Railway → chess-app → Postgres → Backups → "Enable PITR".
   Servisi yeniden başlatıyor, **sakin bir saatte** yapılmalı. (Volume backup + günlük schedule yapıldı.)
   Not: yedek/PITR sadece panelden yönetiliyor — MCP'de de CLI'de de aracı yok.
2. **Zafer'e sorulacak** (varsa): düzey bazında da kilit istiyor mu? (şimdilik sadece ders bazında kararlaştırıldı)

## Bilinen küçük borçlar

- Canlıda test hesapları birikti (öğretmen silme aracı yok — gerekirse küçük bir admin endpoint'i).
- Ölü kod duruyor (`/lesson/[id]`, `LessonPlayer`, `InlineExerciseStep`) — temizlenebilir.
- `LessonStatus.locked` enum'da var, kullanılmıyor (kilit hesaplanan durum olacak, saklanmayacak).

# Sporcu Paneli Yönetimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline).
> Steps use checkbox (`- [ ]`) syntax. Her fazın sonunda test kapısı (tsc+lint+vitest+pytest)
> geçmeden faz kapanmaz.

**Goal:** Zafer hoca sporcu ekranının yazılarını, sekme görünürlüğünü, tahta renklerini ve
taş görsellerini admin panelinden yönetsin; tek global ayar, sporcuya otomatik yansısın.

**Architecture:** Backend'de tek satırlı `app_settings` (JSONB) tablosu; `GET /settings`
(public) ve `PATCH /admin/settings` (teacher-only). Frontend'de `SettingsProvider` context'i
açılışta okur; sporcu ekranları yazı/tahta/sekmeyi ayardan alır, ayar yoksa kodlanmış
varsayılana düşer (fail-safe, KURAL #3).

**Tech Stack:** FastAPI + SQLAlchemy 2 async + Alembic (Python 3.14, pytest); Next.js 15 +
React 19 + TypeScript + Tailwind (vitest). Deploy: git push → Railway (backend) → Vercel.

---

## Dosya Yapısı

**Backend (`apps/api`):**
- Create `chess_api/models/app_settings.py` — AppSettings modeli (id, data JSONB, updated_at)
- Modify `chess_api/models/__init__.py` — AppSettings export
- Create `alembic/versions/AppSettings_create.py` — yeni tablo (down_revision='LessonPublished')
- Create `chess_api/routers/settings.py` — GET /settings (public)
- Modify `chess_api/routers/admin.py` — PATCH /admin/settings (teacher-only, deep-merge, doğrulama)
- Modify `chess_api/main.py` — settings router kaydı
- Modify `chess_api/schemas/auth.py` — (gerekirse) SettingsUpdate şeması yok; serbest JSON kullanılır
- Test `tests/test_app_settings.py`

**Frontend (`apps/web`):**
- Create `lib/settings/defaults.ts` — varsayılan ayarlar + tip
- Create `lib/settings/settings-context.tsx` — SettingsProvider + useSettings
- Modify `app/layout.tsx` — SettingsProvider mount
- Modify `app/admin/layout.tsx` — sol panel: ADMIN / SPORCU PANELİ grupları, İçerik→Ders
- Create `app/admin/settings/labels/page.tsx` — yazı editörü [Faz 1]
- Create `app/admin/settings/tabs/page.tsx` — sekme editörü [Faz 2]
- Create `app/admin/settings/board/page.tsx` — tahta renk + taş editörü [Faz 3-4]
- Modify `app/(child)/home/page.tsx` — yazıları/sekmeleri ayardan oku
- Modify `components/ui/AppNav.tsx` — (gerekirse) başlık ayardan
- Modify `lib/chess/boardSkin.tsx` — renk/taş ayardan override edilebilir hale getir
- Modify `components/ChessBoard.tsx` — ayar renk/taş uygula
- Test `tests/settings.test.ts`

---

## FAZ 1 — İskelet + Yazılar

### Task 1.1: AppSettings modeli + migration
**Files:** Create `chess_api/models/app_settings.py`, Modify `chess_api/models/__init__.py`,
Create `alembic/versions/AppSettings_create.py`

- [ ] Model: tek satır, `id` PK, `data: Mapped[dict]` (JSON), `updated_at`.
```python
from datetime import datetime
from sqlalchemy import DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from chess_api.database import Base

class AppSettings(Base):
    __tablename__ = "app_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```
- [ ] `__init__.py`'ye `from chess_api.models.app_settings import AppSettings` + `__all__`.
- [ ] Migration (down_revision='LessonPublished'): create_table app_settings. Yıkıcı değil.
- [ ] Test kapısı: `python -m pytest -q` (mevcutlar hâlâ geçmeli).

### Task 1.2: GET /settings (public) + PATCH /admin/settings (teacher)
**Files:** Create `chess_api/routers/settings.py`, Modify `chess_api/routers/admin.py`,
Modify `chess_api/main.py`, Test `tests/test_app_settings.py`

- [ ] `settings.py`: `GET /settings` → tek satırı getir; yoksa `{}` döndür (200).
- [ ] `admin.py`: `PATCH /admin/settings` (teacher-only `_ensure_admin`) → gelen dict'i mevcut
  `data` ile **deep-merge** eder, kaydeder, güncel data döner. Basit doğrulama: renk alanları
  `#rrggbb` regex; bilinmeyen üst anahtar reddedilmez ama loglanır (esnek JSON).
- [ ] `main.py`: `app.include_router(settings_router.router)`.
- [ ] Testler: public GET boşken {} döner; teacher PATCH yazar ve GET'te görünür; parent PATCH
  403; kısmi PATCH mevcut alanları korur (deep-merge); geçersiz renk 400.
- [ ] Test kapısı: pytest.

### Task 1.3: Frontend defaults + SettingsProvider
**Files:** Create `lib/settings/defaults.ts`, `lib/settings/settings-context.tsx`,
Modify `app/layout.tsx`

- [ ] `defaults.ts`: `AppSettingsData` tipi + `DEFAULT_SETTINGS` (bugünkü yazılar/renkler):
  labels.levels (1-4), labels.features (play/lessons/puzzle/badges), labels.sections
  (quickAccess/lessonsPick), tabs (play/puzzle/badges=true), board (lightSquare #eef0fb,
  darkSquare #c3c6ee, pieces {}). `mergeSettings(remote)` derin birleştirir.
- [ ] `settings-context.tsx`: SettingsProvider açılışta `GET ${API}/settings` çağırır,
  `mergeSettings` ile DEFAULT üstüne uygular; hata/boşta DEFAULT kalır. `useSettings()` döner.
- [ ] `app/layout.tsx`: `<SettingsProvider>` en dışa (ChessThemeProvider'ı sarar).
- [ ] Test: `tests/settings.test.ts` — mergeSettings boş remote'ta DEFAULT verir; kısmi remote
  sadece verileni override eder.
- [ ] Test kapısı: `npx tsc --noEmit && npx vitest run`.

### Task 1.4: Admin sol panel yeniden düzeni + İçerik→Ders
**Files:** Modify `app/admin/layout.tsx`

- [ ] NAV'ı iki gruba böl: `ADMIN` (Kullanıcılar) ve `SPORCU PANELİ` (Ders=/admin/content,
  Yazılar & Etiketler=/admin/settings/labels, Sekmeler=/admin/settings/tabs,
  Görünüm — Tahta & Taş=/admin/settings/board). Grup başlıkları küçük, muted, uppercase.
- [ ] "İçerik" etiketi "Ders" olur (href aynı /admin/content).
- [ ] Test kapısı: tsc + lint.

### Task 1.5: Yazı editörü sayfası
**Files:** Create `app/admin/settings/labels/page.tsx`

- [ ] Ayarı GET ile yükle (token'lı), form: düzey adları (4 input), feature adları (4),
  section başlıkları (2). Kaydet → `PATCH /admin/settings` body `{ labels: {...} }`.
- [ ] "Varsayılana dön" butonu (DEFAULT_SETTINGS.labels ile doldurur, kaydeder).
- [ ] Başarı/hata mesajı. neon-input/neon-card stilleri.
- [ ] Test kapısı: tsc + lint.

### Task 1.6: Sporcu home yazıları ayardan
**Files:** Modify `app/(child)/home/page.tsx`

- [ ] `const { settings } = useSettings();` LEVELS/FEATURES etiketleri ve section başlıkları
  `settings.labels...`'tan okunur; emoji/href kodda kalır. Ayar yoksa DEFAULT = bugünkü yazı.
- [ ] Test kapısı: tsc + lint + vitest. Canlı önizleme: home yazıları görünür.

**FAZ 1 KAPI:** tsc + lint + vitest + pytest GEÇ. Commit + push. Canlı doğrula.

---

## FAZ 2 — Sekme görünürlüğü

### Task 2.1: Sekme editörü
**Files:** Create `app/admin/settings/tabs/page.tsx`
- [ ] play/puzzle/badges için aç/kapa toggle. Kaydet → `PATCH { tabs: {...} }`.

### Task 2.2: Sporcu tarafında uygula
**Files:** Modify `app/(child)/home/page.tsx`
- [ ] `settings.tabs.play/puzzle/badges === false` ise ilgili kart render edilmez.
  Dersler her zaman açık (temel işlev). Ayar yoksa hepsi görünür (DEFAULT true).
- [ ] Test kapısı: tsc + lint + vitest. **FAZ 2 KAPI** → commit/push/doğrula.

---

## FAZ 3 — Tahta renkleri

### Task 3.1: boardSkin ayar override
**Files:** Modify `lib/chess/boardSkin.tsx`, `components/ChessBoard.tsx`, `components/BoardEditor.tsx`
- [ ] boardSkin sabitleri `let` yerine fonksiyon/param ile: `getBoardColors(settings)` →
  {light,dark}; ChessBoard ve BoardEditor `useSettings()` ile renkleri alır; ayar yoksa
  mevcut #eef0fb/#c3c6ee. (Not: BoardEditor admin içinde de useSettings kullanabilir.)

### Task 3.2: Tahta renk editörü
**Files:** Create `app/admin/settings/board/page.tsx`
- [ ] İki renk seçici (açık/koyu kare) + canlı önizleme tahtası (ChessBoard). Kaydet →
  `PATCH { board: { lightSquare, darkSquare } }`. Varsayılana dön.
- [ ] Test kapısı. **FAZ 3 KAPI** → commit/push/doğrula.

---

## FAZ 4 — Özel taş yükleme (en ağır)

**Depolama kararı (dürüstlük):** Railway object storage provizyonu ek altyapı/erişim gerektirir.
Bunu bloklamamak için taş görselleri **base64 data-URI** olarak `app_settings.data.board.pieces`
içinde saklanır (12 küçük PNG/SVG, her biri ≤64KB → toplam kabul edilebilir). Böylece normal
git push ile deploy edilir, ekstra servis gerekmez. İleride hacim sorun olursa object storage'a
taşınabilir.

### Task 4.1: Taş yükleme endpoint doğrulaması
**Files:** Modify `chess_api/routers/admin.py`
- [ ] PATCH /admin/settings board.pieces alanı: her değer `data:image/(png|svg+xml);base64,...`
  formatında ve ≤64KB olmalı; değilse 400. 12 bilinen anahtar (wK..bP) dışında anahtar reddet.
- [ ] Test: geçerli data-URI kabul, büyük/boyut aşımı 400, yanlış format 400.

### Task 4.2: Taş yükleme editörü
**Files:** Modify `app/admin/settings/board/page.tsx`
- [ ] 12 taş için dosya input; seçilince FileReader ile data-URI'ye çevir, önizle, boyut kontrol
  (≥64KB uyarı). Kaydet → `PATCH { board: { pieces: {...} } }`. Tek tek "sıfırla" (varsayılan SVG).

### Task 4.3: Sporcu/editör tahtası özel taşları render etsin
**Files:** Modify `lib/chess/boardSkin.tsx`, `components/ChessBoard.tsx`, `components/BoardEditor.tsx`
- [ ] `getPieceSet(settings)`: bir taş için data-URI varsa `<img src=...>` render eden bileşen,
  yoksa mevcut gömülü SVG. ChessBoard/BoardEditor bunu kullanır.
- [ ] Test kapısı. **FAZ 4 KAPI** → commit/push/doğrula.

---

## Self-Review notları
- Spec kapsamı: labels (Faz1), tabs (Faz2), board renk (Faz3), board taş (Faz4), sidebar (Task1.4),
  İçerik→Ders (Task1.4), otomatik senkron (SettingsProvider) — hepsi karşılanıyor.
- Fail-safe her fazda DEFAULT'a düşme ile sağlanıyor (KURAL #3).
- Migration yalnız yeni tablo; müfredat tablolarına dokunulmuyor (KURAL #4).

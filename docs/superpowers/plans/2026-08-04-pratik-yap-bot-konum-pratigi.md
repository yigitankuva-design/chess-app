# Pratik Yap — Bot Konum Pratiği Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Pratik Yap" özel sekmesinin alt sekmelerinde (Açılış Pratiği Yap hariç), Zafer
hoca'nın admin panelinden bir konum havuzu doldurabilmesi ve sporcunun o havuzdan
rastgele gelen bir konumla bota karşı pratik maçı yapabilmesi.

**Architecture:** `CustomTabSection` tablosuna `practice_positions` JSON kolonu eklenir
(yeni migration). Admin tarafında yeni `PositionPoolFields` bileşeni (mevcut `BoardEditor`
+ "Konumu Kaydet" deseninin sadeleştirilmiş hali) `admin/settings/tabs/page.tsx`'teki
Pratik Yap alt sekme kartına eklenir. Sporcu tarafında yeni `PositionPoolPractice`
bileşeni `custom/[id]/page.tsx`'te Pratik Yap'ın alt sekmelerinde (body/images yerine)
render edilir; `MatchCriteria` → `BotGame` akışını Açılış Pratiği Yap ile aynı şekilde
kullanır. `MatchLayout` ve `BotGame`'e SADECE birer yeni opsiyonel prop eklenir (geriye
dönük uyumlu) — 3-kart alt panel bu iki prop üzerinden mevcut draw/rematch yuvaları
yeniden etiketlenerek elde edilir, yeni bir alt panel bileşeni YAZILMAZ (DRY).

**Tech Stack:** Next.js/TypeScript (apps/web), FastAPI/SQLAlchemy async (apps/api),
Alembic migration, Vitest + Testing Library, pytest.

---

## Önemli teknik not (turn alanı)

Tasarım dosyasında (`docs/superpowers/specs/2026-08-04-pratik-yap-bot-konum-pratigi-design.md`)
her havuz öğesi `{id, fen, turn}` olarak tarif edilmişti. Planlama sırasında şu netleşti:
`BoardEditor`'ün ürettiği `fen` string'i zaten hamle sırasını içinde barındırır (FEN'in
aktif-renk alanı — `mapToFen()`'in `turn` parametresi tam olarak bunu yazar). Ayrıca bir
`turn` alanı tutmak veriyi tekrarlamak (DRY ihlali) olurdu. Bu yüzden havuz öğesi
**`{id: string, fen: string}`** olarak sadeleştirildi — `turn` FEN'in içinden okunabilir,
ayrıca saklanmaz. Bu, tasarımın davranışını DEĞİŞTİRMEZ (konum yine "kimin sırası"
bilgisiyle birlikte kaydedilir), sadece veri tekrarını önler.

---

### Task 1: Migration — `practice_positions` kolonu

**Files:**
- Create: `apps/api/alembic/versions/20260804_PracticePositions_add.py`

- [ ] **Step 1: Migration dosyasını yaz**

```python
"""custom_tab_sections.practice_positions kolonu — Pratik Yap bot konum havuzu

Revision ID: PracticePositions
Revises: CustomTabs

Yalnızca YENİ bir kolon ekler, server_default='[]' ile — mevcut satırlar
etkilenmez, hiçbir veri silinmez/değişmez (KURAL #3).
"""
import sqlalchemy as sa
from alembic import op

revision = "PracticePositions"
down_revision = "CustomTabs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "custom_tab_sections",
        sa.Column("practice_positions", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("custom_tab_sections", "practice_positions")
```

- [ ] **Step 2: Migration'ı çalıştır ve doğrula**

Run: `cd apps/api && python -m alembic upgrade head`
Expected: hatasız biter, `python -m alembic heads` çıktısı `PracticePositions (head)` gösterir.

- [ ] **Step 3: Commit**

```bash
git add apps/api/alembic/versions/20260804_PracticePositions_add.py
git commit -m "feat(api): custom_tab_sections.practice_positions kolonu (migration)"
```

---

### Task 2: Model — `CustomTabSection.practice_positions`

**Files:**
- Modify: `apps/api/chess_api/models/custom_tab.py:17-26`
- Test: `apps/api/tests/test_custom_tabs.py:9-14`

- [ ] **Step 1: Modeli güncelle**

`apps/api/chess_api/models/custom_tab.py` içinde `CustomTabSection` sınıfına yeni satır ekle:

```python
class CustomTabSection(Base):
    """Bir ozel sekmenin sayfasindaki tek bir bolum — baslik + yazi + gorseller.
    Pratik Yap sekmesi icin ayrica bir bot-pratigi konum havuzu tutar
    (practice_positions) — {id, fen} sozlukleri; turn FEN icinde zaten var."""

    __tablename__ = "custom_tab_sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    custom_tab_id: Mapped[int] = mapped_column(ForeignKey("custom_tabs.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    images: Mapped[list] = mapped_column(JSON, default=list)
    practice_positions: Mapped[list] = mapped_column(JSON, default=list)
```

- [ ] **Step 2: Mevcut model testini güncelle (RED önce)**

`apps/api/tests/test_custom_tabs.py:9-14` içindeki `cols` beklentisini güncelle:

```python
def test_custom_tab_section_modeli_tablo_adi_ve_alanlari():
    from chess_api.models import CustomTabSection

    assert CustomTabSection.__tablename__ == "custom_tab_sections"
    cols = set(CustomTabSection.__table__.columns.keys())
    assert cols == {"id", "custom_tab_id", "order_index", "title", "body", "images", "practice_positions"}
```

- [ ] **Step 3: Testi çalıştır, doğrula**

Run: `cd apps/api && python -m pytest tests/test_custom_tabs.py::test_custom_tab_section_modeli_tablo_adi_ve_alanlari -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/chess_api/models/custom_tab.py apps/api/tests/test_custom_tabs.py
git commit -m "feat(api): CustomTabSection.practice_positions alani"
```

---

### Task 3: Backend — PATCH doğrulaması ve kaydı

**Files:**
- Modify: `apps/api/chess_api/routers/admin.py:1254-1257` (CustomTabSectionUpdateRequest)
- Modify: `apps/api/chess_api/routers/admin.py:1343-1365` (update_custom_tab_section)
- Modify: `apps/api/chess_api/routers/admin.py:1332-1340` (create_custom_tab_section response — practice_positions ekle)
- Test: `apps/api/tests/test_custom_tabs.py`

- [ ] **Step 1: Pydantic modeline `PracticePosition` ve alanı ekle**

`apps/api/chess_api/routers/admin.py:1254` civarına (CustomTabSectionUpdateRequest'ten
hemen önce):

```python
class PracticePosition(BaseModel):
    id: str = Field(min_length=1)
    fen: str = Field(min_length=1)
```

`CustomTabSectionUpdateRequest`'i genişlet:

```python
class CustomTabSectionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = None
    images: list[str] | None = None
    practice_positions: list[PracticePosition] | None = None
```

- [ ] **Step 2: `update_custom_tab_section` içine kayıt mantığını ekle**

`apps/api/chess_api/routers/admin.py:1358` sonrasına (images bloğundan hemen sonra,
`await db.commit()` öncesine):

```python
    if payload.practice_positions is not None:
        section.practice_positions = [p.model_dump() for p in payload.practice_positions]
```

Aynı fonksiyonun `return` satırını (line ~1364-1365) güncelle — `practice_positions` de dönsün:

```python
    return {"id": section.id, "order_index": section.order_index, "title": section.title,
            "body": section.body, "images": section.images,
            "practice_positions": section.practice_positions}
```

- [ ] **Step 3: `create_custom_tab_section` yanıtına da ekle (tutarlılık için)**

`apps/api/chess_api/routers/admin.py:1339-1340` (create endpoint'in return satırı):

```python
    return {"id": section.id, "order_index": section.order_index, "title": section.title,
            "body": section.body, "images": section.images,
            "practice_positions": section.practice_positions}
```

- [ ] **Step 4: Başarısızlığı önce doğrula (RED)**

`apps/api/tests/test_custom_tabs.py` sonuna ekle:

```python
@pytest.mark.asyncio
async def test_konum_havuzu_kaydedilir(client):
    tok = await _teacher_token(client, "ctp1@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()
    assert section["practice_positions"] == []

    fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"
    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [{"id": "p1", "fen": fen}]})
    assert r.status_code == 200
    assert r.json()["practice_positions"] == [{"id": "p1", "fen": fen}]


@pytest.mark.asyncio
async def test_konum_havuzu_bos_id_reddedilir(client):
    tok = await _teacher_token(client, "ctp2@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()

    r = await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                           json={"practice_positions": [{"id": "", "fen": "8/8/8/8/8/8/8/8 w - - 0 1"}]})
    assert r.status_code == 422
```

Run: `cd apps/api && python -m pytest tests/test_custom_tabs.py -k konum_havuzu -v`
Expected: FAIL (alan henüz eklenmediyse `practice_positions` KeyError / 422 döner önce Step 1-3 uygulanmadıysa)

- [ ] **Step 5: Step 1-3'ü uygula, testi tekrar çalıştır**

Run: `cd apps/api && python -m pytest tests/test_custom_tabs.py -k konum_havuzu -v`
Expected: PASS (2 test)

- [ ] **Step 6: Tüm custom_tabs testlerini çalıştır (regresyon)**

Run: `cd apps/api && python -m pytest tests/test_custom_tabs.py -v`
Expected: hepsi PASS (mevcut `test_bolum_guncellenir` dahil — `practice_positions` alanı
None gönderilmediği için dokunulmaz kalmalı)

- [ ] **Step 7: Commit**

```bash
git add apps/api/chess_api/routers/admin.py apps/api/tests/test_custom_tabs.py
git commit -m "feat(api): konum havuzu (practice_positions) PATCH doğrulaması"
```

---

### Task 4: Backend — Sporcuya açık GET endpoint'i genişlet

**Files:**
- Modify: `apps/api/chess_api/routers/custom_tabs.py:27-37`
- Test: `apps/api/tests/test_custom_tabs.py`

- [ ] **Step 1: `get_custom_tab` dönen sözlüğe `practice_positions` ekle**

```python
@router.get("/custom-tabs/{tab_id}")
async def get_custom_tab(tab_id: int, db: AsyncSession = Depends(get_db)):
    """Bir sekmenin tüm bölümlerini (görsellerle) döner — sekme sayfası açılınca çağrılır."""
    tab = await db.get(CustomTab, tab_id)
    if not tab:
        raise HTTPException(status_code=404, detail="Custom tab not found")
    sections = (await db.execute(
        select(CustomTabSection).where(CustomTabSection.custom_tab_id == tab_id)
        .order_by(CustomTabSection.order_index)
    )).scalars().all()
    return {
        "id": tab.id, "label": tab.label, "emoji": tab.emoji,
        "sections": [
            {"id": s.id, "order_index": s.order_index, "title": s.title, "body": s.body,
             "images": s.images, "practice_positions": s.practice_positions}
            for s in sections
        ],
    }
```

- [ ] **Step 2: Testi yaz (RED önce)**

`apps/api/tests/test_custom_tabs.py` sonuna ekle:

```python
@pytest.mark.asyncio
async def test_genel_bolum_gorunumu_konum_havuzunu_icerir(client):
    tok = await _teacher_token(client, "ctp3@t.com")
    h = {"Authorization": f"Bearer {tok}"}
    tab = (await client.post("/admin/custom-tabs", headers=h, json={"label": "Pratik Yap"})).json()
    section = (await client.post(f"/admin/custom-tabs/{tab['id']}/sections", headers=h,
                                 json={"title": "Süresiz Pratik", "body": "", "images": []})).json()
    fen = "8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"
    await client.patch(f"/admin/custom-tab-sections/{section['id']}", headers=h,
                       json={"practice_positions": [{"id": "p1", "fen": fen}]})

    detail = (await client.get(f"/custom-tabs/{tab['id']}")).json()
    assert detail["sections"][0]["practice_positions"] == [{"id": "p1", "fen": fen}]
```

Run: `cd apps/api && python -m pytest tests/test_custom_tabs.py -k genel_bolum_gorunumu -v`
Expected: FAIL, sonra Step 1 uygulanınca PASS

- [ ] **Step 3: Tüm backend testlerini çalıştır**

Run: `cd apps/api && python -m pytest -q`
Expected: hepsi PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/chess_api/routers/custom_tabs.py apps/api/tests/test_custom_tabs.py
git commit -m "feat(api): genel sekme görünümü konum havuzunu döner"
```

---

### Task 5: `positionPool.ts` — saf rastgele seçim mantığı

**Files:**
- Create: `apps/web/lib/play/positionPool.ts`
- Test: `apps/web/tests/position-pool.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { pickRandomPosition, pickDifferentPosition } from '@/lib/play/positionPool';

const POOL = [
  { id: 'a', fen: 'fen-a' },
  { id: 'b', fen: 'fen-b' },
  { id: 'c', fen: 'fen-c' },
];

describe('positionPool', () => {
  it('pickRandomPosition havuzdan bir öğe döner', () => {
    const picked = pickRandomPosition(POOL);
    expect(POOL).toContainEqual(picked);
  });

  it('pickDifferentPosition havuzda 2+ öğe varsa hariç tutulanı DÖNDÜRMEZ', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const picked = pickDifferentPosition(POOL, 'a');
    expect(picked.id).not.toBe('a');
    vi.restoreAllMocks();
  });

  it('pickDifferentPosition havuzda tek öğe varsa aynısını döner', () => {
    const single = [{ id: 'only', fen: 'fen-only' }];
    const picked = pickDifferentPosition(single, 'only');
    expect(picked.id).toBe('only');
  });

  it('pickDifferentPosition excludeId null iken tüm havuzdan seçer', () => {
    const picked = pickDifferentPosition(POOL, null);
    expect(POOL).toContainEqual(picked);
  });
});
```

Run: `cd apps/web && npx vitest run tests/position-pool.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Uygula**

```typescript
export interface PoolPosition {
  id: string;
  fen: string;
}

/** Havuzdan tamamen rastgele bir konum seçer. Havuz boş olamaz (çağıran kontrol eder). */
export function pickRandomPosition(pool: PoolPosition[]): PoolPosition {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Havuzdan rastgele bir konum seçer; `excludeId` verilmişse VE havuzda 2+ öğe
 *  varsa o öğeyi hariç tutar (art arda aynı konum gelmesin — kullanıcı kararı). */
export function pickDifferentPosition(pool: PoolPosition[], excludeId: string | null): PoolPosition {
  if (excludeId === null || pool.length <= 1) return pickRandomPosition(pool);
  const candidates = pool.filter((p) => p.id !== excludeId);
  return pickRandomPosition(candidates);
}
```

- [ ] **Step 3: Testi çalıştır, doğrula**

Run: `cd apps/web && npx vitest run tests/position-pool.test.ts`
Expected: PASS (4 test)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/play/positionPool.ts apps/web/tests/position-pool.test.ts
git commit -m "feat: positionPool.ts — havuzdan rastgele/farklı konum seçimi"
```

---

### Task 6: `customTabsApi.ts` — tip ve istemci genişletmesi

**Files:**
- Modify: `apps/web/lib/customTabsApi.ts:12-18,92-106`

- [ ] **Step 1: `CustomTabSection` arayüzüne alan ekle**

```typescript
export interface CustomTabSection {
  id: number;
  order_index: number;
  title: string;
  body: string;
  images: string[];
  practice_positions: { id: string; fen: string }[];
}
```

- [ ] **Step 2: `updateCustomTabSection`'ın patch tipini genişlet**

```typescript
export async function updateCustomTabSection(
  sectionId: number,
  patch: { title?: string; body?: string; images?: string[]; practice_positions?: { id: string; fen: string }[] },
): Promise<boolean> {
```

(Fonksiyon gövdesi değişmiyor — zaten `JSON.stringify(patch)` ile ne verilirse onu gönderiyor.)

- [ ] **Step 3: Derleme kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: hata yok (bu adımda henüz kullanılmıyor olsa da tip uyumu bozulmamalı)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/customTabsApi.ts
git commit -m "feat: customTabsApi — practice_positions alanı"
```

---

### Task 7: `PositionPoolFields.tsx` — admin konum ekleme bileşeni

**Files:**
- Create: `apps/web/components/admin/PositionPoolFields.tsx`
- Test: `apps/web/tests/position-pool-fields.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PositionPoolFields } from '@/components/admin/PositionPoolFields';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('PositionPoolFields', () => {
  it('Konumu Kaydet tıklanınca onSavePosition çağrılır', () => {
    const onSavePosition = vi.fn();
    render(
      <PositionPoolFields
        fen={START_FEN} turn="w"
        onFenChange={() => {}} onTurnChange={() => {}}
        onSavePosition={onSavePosition}
        pool={[]} onDeletePosition={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Konumu Kaydet'));
    expect(onSavePosition).toHaveBeenCalled();
  });

  it('havuzdaki her konum için Sil butonu gösterir', () => {
    const onDeletePosition = vi.fn();
    render(
      <PositionPoolFields
        fen={START_FEN} turn="w"
        onFenChange={() => {}} onTurnChange={() => {}}
        onSavePosition={() => {}}
        pool={[{ id: 'p1', fen: START_FEN }, { id: 'p2', fen: START_FEN }]}
        onDeletePosition={onDeletePosition}
      />,
    );
    const delButtons = screen.getAllByText('Sil');
    expect(delButtons).toHaveLength(2);
    fireEvent.click(delButtons[0]);
    expect(onDeletePosition).toHaveBeenCalledWith('p1');
  });

  it('havuz boşsa bilgi metni gösterir', () => {
    render(
      <PositionPoolFields
        fen={START_FEN} turn="w"
        onFenChange={() => {}} onTurnChange={() => {}}
        onSavePosition={() => {}}
        pool={[]} onDeletePosition={() => {}}
      />,
    );
    expect(screen.getByText(/Henüz konum eklenmedi/)).toBeInTheDocument();
  });
});
```

Run: `cd apps/web && npx vitest run tests/position-pool-fields.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 2: Bileşeni uygula**

```tsx
'use client';
import { BoardEditor } from '@/components/BoardEditor';
import { SavedPositionBoard } from './SavedPositionBoard';

interface PoolPosition {
  id: string;
  fen: string;
}

interface Props {
  /** Dizme aşamasındaki FEN (havuza eklenmeden önce). */
  fen: string;
  turn: 'w' | 'b';
  onFenChange: (fen: string) => void;
  onTurnChange: (t: 'w' | 'b') => void;
  /** "Konumu Kaydet" — mevcut `fen`'i havuza ekler. */
  onSavePosition: () => void;
  pool: PoolPosition[];
  onDeletePosition: (id: string) => void;
}

/**
 * Pratik Yap alt sekmeleri için bot-pratiği konum havuzu girişi.
 *
 * "Taşı Oynat" (move_piece) akışının aksine hamle dizisi KAYDEDİLMEZ —
 * yalnızca konum (taşlar + hamle sırası, FEN içinde) havuza eklenir.
 */
export function PositionPoolFields({
  fen, turn, onFenChange, onTurnChange, onSavePosition, pool, onDeletePosition,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs n-muted text-center">
        Sporcunun bota karşı pratik yapacağı konumu diz, sırayı belirle, kaydet.
      </p>
      <BoardEditor fen={fen} turn={turn} onChange={onFenChange} onTurnChange={onTurnChange} />
      <button type="button" onClick={onSavePosition}
        className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
        Konumu Kaydet
      </button>

      <div className="pt-2 border-t border-white/10">
        <p className="text-xs font-bold n-muted uppercase tracking-widest mb-2">
          Konum Havuzu ({pool.length})
        </p>
        {pool.length === 0 ? (
          <p className="text-sm n-muted">Henüz konum eklenmedi.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {pool.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <SavedPositionBoard fen={p.fen} marked={[]} />
                <button type="button" onClick={() => onDeletePosition(p.id)}
                  className="text-xs text-rose-300 hover:text-rose-200">
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Testi çalıştır, doğrula**

Run: `cd apps/web && npx vitest run tests/position-pool-fields.test.tsx`
Expected: PASS (3 test)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/admin/PositionPoolFields.tsx apps/web/tests/position-pool-fields.test.tsx
git commit -m "feat: PositionPoolFields — admin konum havuzu girişi bileşeni"
```

---

### Task 8: Admin sayfası entegrasyonu

**Files:**
- Modify: `apps/web/app/admin/settings/tabs/page.tsx`
- Test: `apps/web/tests/admin-tabs-custom-subsections.test.tsx`

- [ ] **Step 1: State ve importları ekle**

`apps/web/app/admin/settings/tabs/page.tsx:1-14` importlarına ekle:

```typescript
import { PositionPoolFields } from '@/components/admin/PositionPoolFields';
import { START_FEN } from '@/components/BoardEditor';
```

Bileşenin en üst state bloğuna (satır ~74 civarı, `editImages` sonrasına) ekle:

```typescript
  /** Konum havuzu düzenleme dizme alanı — açık alt sekmeye ait, geçici (kaydedilmemiş) taslak. */
  const [poolFen, setPoolFen] = useState(START_FEN);
  const [poolTurn, setPoolTurn] = useState<'w' | 'b'>('w');
```

- [ ] **Step 2: `toggleCustomTab` içinde taslağı sıfırla**

`apps/web/app/admin/settings/tabs/page.tsx:126-136`'daki `toggleCustomTab` fonksiyonuna,
`cancelEditSection();` satırından sonra ekle:

```typescript
    setPoolFen(START_FEN); setPoolTurn('w');
```

- [ ] **Step 3: Kaydetme ve silme fonksiyonlarını ekle**

`saveEditSection` fonksiyonundan hemen sonra (satır ~195 civarı) ekle:

```typescript
  async function savePosition(tabId: number, sectionId: number) {
    const existing = customTabDetails[tabId]?.sections.find((s) => s.id === sectionId);
    if (!existing) return;
    const newPos = { id: crypto.randomUUID(), fen: poolFen };
    const nextPool = [...existing.practice_positions, newPos];
    const ok = await updateCustomTabSection(sectionId, { practice_positions: nextPool });
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setCustomTabDetails((prev) => {
      const tab = prev[tabId];
      if (!tab) return prev;
      return {
        ...prev,
        [tabId]: {
          ...tab,
          sections: tab.sections.map((s) => (s.id === sectionId ? { ...s, practice_positions: nextPool } : s)),
        },
      };
    });
    setPoolFen(START_FEN); setPoolTurn('w');
    setMsg('Kaydedildi ✓');
  }

  async function deletePosition(tabId: number, sectionId: number, positionId: string) {
    const existing = customTabDetails[tabId]?.sections.find((s) => s.id === sectionId);
    if (!existing) return;
    const nextPool = existing.practice_positions.filter((p) => p.id !== positionId);
    const ok = await updateCustomTabSection(sectionId, { practice_positions: nextPool });
    if (!ok) { setMsg('Silinemedi'); return; }
    setCustomTabDetails((prev) => {
      const tab = prev[tabId];
      if (!tab) return prev;
      return {
        ...prev,
        [tabId]: {
          ...tab,
          sections: tab.sections.map((s) => (s.id === sectionId ? { ...s, practice_positions: nextPool } : s)),
        },
      };
    });
    setMsg('Kaydedildi ✓');
  }
```

- [ ] **Step 4: JSX'e ekle — SADECE Pratik Yap alt sekmelerinde**

`apps/web/app/admin/settings/tabs/page.tsx:477-489`'daki `sOpen && (...)` bloğunun HEMEN
ALTINA (aynı `<div key={s.id}>` içinde, kapanmadan önce), `isPratikYap` true iken göster:

```tsx
                            {isPratikYap && sOpen && (
                              <div className="px-3 pb-3 border-t border-white/10 pt-3">
                                <PositionPoolFields
                                  fen={poolFen} turn={poolTurn}
                                  onFenChange={setPoolFen} onTurnChange={setPoolTurn}
                                  onSavePosition={() => savePosition(c.id, s.id)}
                                  pool={s.practice_positions}
                                  onDeletePosition={(posId) => deletePosition(c.id, s.id, posId)}
                                />
                              </div>
                            )}
```

(Not: bu blok `isEditing ? (...) : sOpen && (...)` üçlü ifadesinin dışında, yani hem
düzenleme modunda hem normal görünümde DEĞİL — sadece `sOpen` iken ve düzenleme modunda
DEĞİLKEN görünür olması için `sOpen && !isEditing` koşulu kullanılmalı. Doğru hali:)

```tsx
                            {isPratikYap && sOpen && !isEditing && (
                              <div className="px-3 pb-3 border-t border-white/10 pt-3">
                                <PositionPoolFields
                                  fen={poolFen} turn={poolTurn}
                                  onFenChange={setPoolFen} onTurnChange={setPoolTurn}
                                  onSavePosition={() => savePosition(c.id, s.id)}
                                  pool={s.practice_positions}
                                  onDeletePosition={(posId) => deletePosition(c.id, s.id, posId)}
                                />
                              </div>
                            )}
```

- [ ] **Step 5: Başarısız testi yaz (RED önce)**

`apps/web/tests/admin-tabs-custom-subsections.test.tsx` sonuna yeni bir `describe` bloğu ekle
(mevcut dosyanın mock/fetch desenini takip ederek — `getCustomTab` mock'unun döndürdüğü
section nesnelerine `practice_positions: []` eklemeyi UNUTMA, yoksa TypeScript hata verir):

```tsx
describe('Admin özel sekme — Pratik Yap konum havuzu', () => {
  it('Pratik Yap alt sekmesinde Konumu Kaydet ile havuza konum eklenir', async () => {
    vi.mocked(getCustomTab).mockResolvedValue({
      id: 1, label: 'Pratik Yap', emoji: '🎯',
      sections: [{ id: 10, order_index: 1, title: 'Süresiz Pratik', body: '', images: [], practice_positions: [] }],
    });
    vi.mocked(updateCustomTabSection).mockResolvedValue(true);
    vi.mocked(listCustomTabs).mockResolvedValue([{ id: 1, order_index: 1, label: 'Pratik Yap', emoji: '🎯' }]);

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText('1. Pratik Yap'));
    fireEvent.click(screen.getByLabelText('Pratik Yap sekmesini aç'));
    await waitFor(() => screen.getByText('Süresiz Pratik'));
    fireEvent.click(screen.getByText('Süresiz Pratik'));
    await waitFor(() => screen.getByText('Konum Havuzu (0)'));

    fireEvent.click(screen.getByText('Konumu Kaydet'));

    await waitFor(() => {
      expect(updateCustomTabSection).toHaveBeenCalledWith(
        10, expect.objectContaining({ practice_positions: expect.any(Array) }),
      );
    });
  });

  it('Pratik Yap OLMAYAN sekmede konum havuzu bölümü GÖRÜNMEZ', async () => {
    vi.mocked(getCustomTab).mockResolvedValue({
      id: 2, label: 'Bulmacalar', emoji: '🧩',
      sections: [{ id: 20, order_index: 1, title: 'Bölüm', body: 'x', images: [], practice_positions: [] }],
    });
    vi.mocked(listCustomTabs).mockResolvedValue([{ id: 2, order_index: 1, label: 'Bulmacalar', emoji: '🧩' }]);

    render(<AdminTabsPage />);
    await waitFor(() => screen.getByText('1. Bulmacalar'));
    fireEvent.click(screen.getByLabelText('Bulmacalar sekmesini aç'));
    await waitFor(() => screen.getByText('Bölüm'));
    fireEvent.click(screen.getByText('Bölüm'));

    await waitFor(() => screen.getByText('x'));
    expect(screen.queryByText(/Konum Havuzu/)).not.toBeInTheDocument();
  });
});
```

Run: `cd apps/web && npx vitest run tests/admin-tabs-custom-subsections.test.tsx`
Expected: FAIL (Step 1-4 uygulanmadıysa `Konum Havuzu` metni bulunamaz)

- [ ] **Step 6: Step 1-4'ü uygula, testi tekrar çalıştır**

Run: `cd apps/web && npx vitest run tests/admin-tabs-custom-subsections.test.tsx`
Expected: PASS (tüm dosya, eski + yeni testler)

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/admin/settings/tabs/page.tsx apps/web/tests/admin-tabs-custom-subsections.test.tsx
git commit -m "feat: admin Pratik Yap alt sekmesinde konum havuzu girişi"
```

---

### Task 9: `MatchLayout.tsx` — `rematchLabel` opsiyonel prop'u

**Files:**
- Modify: `apps/web/components/play/MatchLayout.tsx:33-36,148-159`

- [ ] **Step 1: Props arayüzüne ekle**

```typescript
  /** Verilmezse "Yeniden Oyna" butonu HİÇ render edilmez (insan-insan maçı). */
  onRematch?: () => void;
  rematchEnabled?: boolean;
  /** Rematch butonunun metni. Verilmezse "Yeniden Oyna" (geriye dönük uyumlu). */
  rematchLabel?: string;
```

- [ ] **Step 2: Fonksiyon imzasına ekle ve JSX'te kullan**

```typescript
export function MatchLayout({
  top, bottom, board, moveList, extra, over, resultSlot,
  drawLabel, drawDisabled, onOfferDraw, onResign, onRematch, rematchEnabled,
  rematchLabel = 'Yeniden Oyna',
}: Props) {
```

`apps/web/components/play/MatchLayout.tsx:156` (`>Yeniden Oyna</button>`) satırını değiştir:

```tsx
              {rematchLabel}
```

- [ ] **Step 3: Mevcut testleri çalıştır (regresyon — prop opsiyonel, davranış değişmemeli)**

Run: `cd apps/web && npx vitest run --grep "MatchLayout|BotGame|LiveGame|OpeningPractice"`
Expected: hepsi PASS (varsayılan değer sayesinde eski davranış korunuyor)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/play/MatchLayout.tsx
git commit -m "feat: MatchLayout — opsiyonel rematchLabel prop'u"
```

---

### Task 10: `BotGame.tsx` — `practiceActions` opsiyonel prop'u

**Files:**
- Modify: `apps/web/components/BotGame.tsx:33-44,354-410`
- Test: `apps/web/tests/bot-game-practice-actions.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

Mevcut `BotGame` testlerinin mock desenini kontrol et (`apps/web/tests/` içinde
`bot-game` ile başlayan dosyalara bak — StockfishEngine, fetch vb. neyin mock'landığını
gör) ve AYNI mock iskeletini kullanarak yeni dosyayı yaz:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BotGame } from '@/components/BotGame';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    setSkill: vi.fn(),
    bestMove: vi.fn().mockResolvedValue('(none)'),
    destroy: vi.fn(),
  })),
}));
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ game_id: 1 }) }));

describe('BotGame — practiceActions', () => {
  it('practiceActions verilince Beraberlik Teklif Et yerine Aynı Konumu Pratik Et görünür', async () => {
    const onPlaySame = vi.fn();
    const onPlayDifferent = vi.fn();
    render(
      <BotGame
        skillLevel={1} depth={1} studentColor="w"
        onGameEnd={() => {}}
        practiceActions={{ onPlaySame, onPlayDifferent }}
      />,
    );
    await waitFor(() => screen.getByText('Aynı Konumu Pratik Et'));
    expect(screen.queryByText(/Beraberlik Teklif Et/)).not.toBeInTheDocument();
    expect(screen.getByText('Farklı Bir Konumu Pratik Yap')).toBeInTheDocument();
  });

  it('practiceActions verilmezse eski Beraberlik Teklif Et davranışı korunur', async () => {
    render(<BotGame skillLevel={1} depth={1} studentColor="w" onGameEnd={() => {}} />);
    await waitFor(() => screen.getByText(/Beraberlik Teklif Et/));
  });
});
```

Run: `cd apps/web && npx vitest run tests/bot-game-practice-actions.test.tsx`
Expected: FAIL — `Aynı Konumu Pratik Et` metni yok

- [ ] **Step 2: Props arayüzüne ekle**

`apps/web/components/BotGame.tsx:33-44`:

```typescript
interface Props {
  skillLevel: number;
  depth: number;
  timeControl?: TimeControl | null;
  /** Sporcunun oynadigi renk (madde f). Varsayilan 'w' — eski cagrilar bozulmaz. */
  studentColor?: 'w' | 'b';
  /** Acilis pratigi icin baslangic pozisyonu. Verilmezse standart baslangic. */
  startFen?: string;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
  /** Verilirse maç bitince "Yeniden Oyna" butonu görünür ve aktif olur. */
  onRematch?: () => void;
  /** Verilirse Beraberlik Teklif Et YERİNE bu iki eylem gösterilir (Pratik Yap
   *  konum havuzu akışı — bota karşı serbest pratik, beraberlik teklifi anlamsız). */
  practiceActions?: {
    onPlaySame: () => void;
    onPlayDifferent: () => void;
  };
}
```

- [ ] **Step 3: Fonksiyon imzasını ve `MatchLayout` çağrısını güncelle**

```typescript
export function BotGame({
  skillLevel, depth, timeControl, studentColor = 'w', startFen, onGameEnd, onRematch, practiceActions,
}: Props) {
```

`apps/web/components/BotGame.tsx:354-410`'daki `<MatchLayout ... />` çağrısının
`drawLabel`/`drawDisabled`/`onOfferDraw`/`onRematch`/`rematchEnabled` satırlarını değiştir:

```tsx
      drawLabel={practiceActions ? 'Aynı Konumu Pratik Et' : `Beraberlik Teklif Et (${offersLeft(drawOffersUsed)})`}
      drawDisabled={practiceActions ? status !== 'over' : !canOfferDraw(drawOffersUsed)}
      onOfferDraw={practiceActions ? practiceActions.onPlaySame : offerDrawToBot}
      onResign={resignToBot}
      onRematch={practiceActions ? practiceActions.onPlayDifferent : onRematch}
      rematchEnabled={status === 'over'}
      rematchLabel={practiceActions ? 'Farklı Bir Konumu Pratik Yap' : 'Yeniden Oyna'}
```

- [ ] **Step 4: Testi çalıştır, doğrula**

Run: `cd apps/web && npx vitest run tests/bot-game-practice-actions.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 5: Mevcut BotGame/OpeningPractice testlerini çalıştır (regresyon)**

Run: `cd apps/web && npx vitest run --grep "BotGame|OpeningPractice"`
Expected: hepsi PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/BotGame.tsx apps/web/tests/bot-game-practice-actions.test.tsx
git commit -m "feat: BotGame — opsiyonel practiceActions (3 kartlı pratik modu)"
```

---

### Task 11: `PositionPoolPractice.tsx` — sporcu tarafı bileşeni

**Files:**
- Create: `apps/web/components/play/PositionPoolPractice.tsx`
- Test: `apps/web/tests/position-pool-practice.test.tsx`

- [ ] **Step 1: Başarısız testi yaz**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PositionPoolPractice } from '@/components/play/PositionPoolPractice';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    setSkill: vi.fn(),
    bestMove: vi.fn().mockResolvedValue('(none)'),
    destroy: vi.fn(),
  })),
}));
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ game_id: 1 }) }));

const POOL = [
  { id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
];

describe('PositionPoolPractice', () => {
  it('havuz boşsa bilgi mesajı gösterir, MatchCriteria hiç görünmez', () => {
    render(<PositionPoolPractice positions={[]} />);
    expect(screen.getByText(/Henüz konum eklenmedi/)).toBeInTheDocument();
    expect(screen.queryByText('Pratiğe Başla')).not.toBeInTheDocument();
  });

  it('havuz doluysa MatchCriteria gösterir, kriterler seçilince BotGame başlar', async () => {
    render(<PositionPoolPractice positions={POOL} />);
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
  });
});
```

Run: `cd apps/web && npx vitest run tests/position-pool-practice.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 2: Bileşeni uygula**

```tsx
'use client';
import { useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { pickRandomPosition, pickDifferentPosition } from '@/lib/play/positionPool';
import type { PoolPosition } from '@/lib/play/positionPool';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';

interface Props {
  positions: PoolPosition[];
}

/**
 * Pratik Yap alt sekmelerinde (Açılış Pratiği Yap hariç) bota karşı konum
 * pratiği. Havuzdan rastgele bir konumla başlar; maç bitince "Aynı Konumu
 * Pratik Et" / "Farklı Bir Konumu Pratik Yap" kartları (BotGame'in
 * practiceActions prop'u üzerinden) görünür. Puan/skor KAYDEDİLMEZ.
 */
export function PositionPoolPractice({ positions }: Props) {
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [color, setColor] = useState<PieceColor>('w');
  const [current, setCurrent] = useState<PoolPosition | null>(null);
  const [matchKey, setMatchKey] = useState(0);

  if (positions.length === 0) {
    return <p className="t-muted text-sm">Henüz konum eklenmedi.</p>;
  }

  if (!criteria || !current) {
    return (
      <MatchCriteria
        startLabel="Pratiğe Başla"
        onStart={(v) => {
          setCurrent(pickRandomPosition(positions));
          setCriteria(v);
          setColor(resolveColor(v.colorChoice));
        }}
      />
    );
  }

  return (
    <BotGame
      key={matchKey}
      skillLevel={criteria.level.skill}
      depth={criteria.level.depth}
      timeControl={criteria.timeControl}
      studentColor={color}
      startFen={current.fen}
      onGameEnd={() => {}}
      practiceActions={{
        onPlaySame: () => setMatchKey((k) => k + 1),
        onPlayDifferent: () => {
          const next = pickDifferentPosition(positions, current.id);
          setCurrent(next);
          setColor(resolveColor(criteria.colorChoice));
          setMatchKey((k) => k + 1);
        },
      }}
    />
  );
}
```

- [ ] **Step 3: Testi çalıştır, doğrula**

Run: `cd apps/web && npx vitest run tests/position-pool-practice.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/play/PositionPoolPractice.tsx apps/web/tests/position-pool-practice.test.tsx
git commit -m "feat: PositionPoolPractice — sporcu tarafı bot konum pratiği"
```

---

### Task 12: Sporcu sayfası entegrasyonu (`custom/[id]/page.tsx`)

**Files:**
- Modify: `apps/web/app/(child)/custom/[id]/page.tsx`
- Test: `apps/web/tests/custom-tab-view.test.tsx` (yoksa oluştur — dosya adını önce
  `apps/web/tests/` içinde `grep -rl "CustomTabViewPage"` ile doğrula)

- [ ] **Step 1: Mevcut testi bul, mock desenini incele**

Run: `cd apps/web && grep -rl "CustomTabViewPage" tests/`

Bulunan dosyayı oku, `getCustomTab` mock desenini ve section nesnelerinin şeklini not al
(yeni testler bu desenle tutarlı olmalı, `practice_positions: []` eklenmesi gerekecek).

- [ ] **Step 2: Başarısız testi ekle (RED önce)**

Bulunan test dosyasına (veya yoksa yeni `apps/web/tests/custom-tab-view.test.tsx`'e),
mevcut mock iskeletini kullanarak ekle:

```tsx
it('Pratik Yap alt sekmesi tıklanınca body/images yerine PositionPoolPractice görünür', async () => {
  vi.mocked(getCustomTab).mockResolvedValue({
    id: 1, label: 'Pratik Yap', emoji: '🎯',
    sections: [{
      id: 10, order_index: 1, title: 'Süresiz Pratik', body: 'bu metin görünmemeli', images: [],
      practice_positions: [{ id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }],
    }],
  });
  render(<CustomTabViewPage />);
  await waitFor(() => screen.getByText('Süresiz Pratik'));
  fireEvent.click(screen.getByText('Süresiz Pratik'));

  await waitFor(() => screen.getByText(/Pratiğe Başla/));
  expect(screen.queryByText('bu metin görünmemeli')).not.toBeInTheDocument();
});

it('Pratik Yap OLMAYAN sekmede alt sekme hâlâ body/images gösterir (regresyon)', async () => {
  vi.mocked(getCustomTab).mockResolvedValue({
    id: 2, label: 'Bulmacalar', emoji: '🧩',
    sections: [{ id: 20, order_index: 1, title: 'Bölüm', body: 'normal metin', images: [], practice_positions: [] }],
  });
  render(<CustomTabViewPage />);
  await waitFor(() => screen.getByText('Bölüm'));
  fireEvent.click(screen.getByText('Bölüm'));
  await waitFor(() => screen.getByText('normal metin'));
});
```

Run: `cd apps/web && npx vitest run tests/<bulunan-dosya>`
Expected: FAIL

- [ ] **Step 3: Sayfayı güncelle**

`apps/web/app/(child)/custom/[id]/page.tsx` içinde import ekle:

```typescript
import { PositionPoolPractice } from '@/components/play/PositionPoolPractice';
```

`{open && (...)}` bloğunu (satır 55-67) `isPratikYap`'a göre dallandır:

```tsx
                {open && (
                  <div className="px-4 pb-4 space-y-3">
                    {isPratikYap ? (
                      <PositionPoolPractice positions={s.practice_positions} />
                    ) : (
                      <>
                        {s.body && <p className="t-muted whitespace-pre-wrap">{s.body}</p>}
                        {s.images.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {s.images.map((uri, i) => (
                              <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                                className="rounded-lg w-full" style={{ objectFit: 'contain' }} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
```

- [ ] **Step 4: Testi çalıştır, doğrula**

Run: `cd apps/web && npx vitest run tests/<bulunan-dosya>`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(child)/custom/[id]/page.tsx" apps/web/tests/<bulunan-dosya>
git commit -m "feat: sporcu Pratik Yap alt sekmesinde bot konum pratiği akışı"
```

---

### Task 13: Tam test kapısı

**Files:** yok (sadece doğrulama)

- [ ] **Step 1: Backend testleri**

Run: `cd apps/api && python -m pytest -q`
Expected: hepsi PASS, 0 FAIL

- [ ] **Step 2: Frontend tip kontrolü**

Run: `cd apps/web && npx tsc --noEmit`
Expected: hata yok

- [ ] **Step 3: Frontend lint**

Run: `cd apps/web && npx next lint`
Expected: hata yok

- [ ] **Step 4: Frontend tüm testler**

Run: `cd apps/web && npx vitest run`
Expected: hepsi PASS

- [ ] **Step 5: Herhangi bir adım kalırsa dur, düzelt, Step 1'den tekrar başla**

---

### Task 14: Canlı doğrulama (KURAL #6)

**Files:** yok

- [ ] **Step 1: Kullanıcıya sor**

Kod tamamlandıktan sonra kullanıcıya Türkçe ve kısa şekilde sor: "Bunu canlı olarak test
edeyim mi?" — onay gelmeden bu görev YAPILMAZ.

- [ ] **Step 2: Onay gelirse — admin tarafı**

Mock backend (bu oturumda daha önce kurulan Node `http.createServer` deseni) ile
`/admin/settings/tabs` sayfasını aç, bir "Pratik Yap" özel sekmesi + bir alt sekme mock'la,
alt sekmeyi aç, `PositionPoolFields` ile bir konum diz, "Konumu Kaydet"e bas, PATCH
isteğinin `practice_positions` içerdiğini `read_network_requests` ile doğrula.

- [ ] **Step 3: Sporcu tarafı**

`/custom/[id]` sayfasını (mock `getCustomTab` verisiyle) aç, Pratik Yap alt sekmesine
tıkla, `MatchCriteria`'yı doldurup "Pratiğe Başla"ya bas, tahtanın göründüğünü, maç
bitirilince (örn. `resignToBot` — Terk Et'e basarak) "Aynı Konumu Pratik Et" ve "Farklı
Bir Konumu Pratik Yap" kartlarının aktifleştiğini `read_page`/`get_page_text` ile doğrula.

- [ ] **Step 4: Bulunan sorunları düzelt, Task 13'ü tekrar çalıştır**

- [ ] **Step 5: Sonucu kullanıcıya kısa ve net raporla — ne test edildi, ne edilemedi**

- [ ] **Step 6: Push onayı**

Kullanıcıya sor: "Ana koda göndereyim mi?" — açık onay olmadan `git push` YAPILMAZ.

# P6 — Puanlama ve Zincirleme Kilit Açma (Tasarım)

**Tarih:** 2026-07-26
**Kapsam:** Süresiz/Süreli/Test pratik modlarında puanlama, sonuç ekranı ve alt konu
bazlı zincirleme kilit açma.

---

## 1. Amaç

Öğrenci bir alt konunun pratiğini bitirince puan alsın, sonucu görsün; yeterince
başarılıysa (85+) bir sonraki mod ve nihayetinde bir sonraki alt konu açılsın.

Orijinal istek (d8):
- 20 soru/oturum, doğru 5 puan, yanlış/boş 0 puan
- Sonuç dökümü
- Eşik mesajları: `<50` "Çok Daha Fazla Pratik Yapmalısın", `50–80` "İyi Gidiyorsun…",
  `>80` "Tebrikler…"
- 85+ → Süreli Pratik açılır → zincirleme Kendini Test Et → sonraki alt konu

---

## 2. Doğrulanmış mevcut durum

Bu bölümdeki her madde kod okunarak doğrulandı (KURAL #1).

**Hiyerarşi:** Modül → Ders (`lessons`) → **Alt konu** → 3 pratik modu.
Alt konu bir ders değil, dersin içindeki bir **adımdır**: tipi `explanation` ve
`content_json.title` alanı dolu olan `lesson_steps` satırı
(`apps/web/app/(child)/home/page.tsx:138`, `:269-271`).
Üç pratik modu linki her alt konunun altında üretiliyor
(`app/(child)/home/page.tsx:624-628`), URL biçimi:
`/pratik/{mod}?konu={başlık}&step={stepId}&ders={lessonId}`.

**Üç mod tek route üzerinde:** `apps/web/app/(child)/pratik/[mode]/page.tsx:13-21`
`MODES` sözlüğü — `suresiz` (`board_exercises`, randomPick 20),
`sureli` (`board_exercises_timed`, 5 dk sayaç, `TIMED_SECONDS=300` satır 23),
`test` (`board_exercises_test`, `scored:true`). Sorular admin panelinde
`LessonStep.content_json` içindeki bu üç alana yazılıyor; ayrı soru havuzu tablosu yok.

**Puanlama yok:** `BoardExercise.tsx` sadece doğru/yanlış sayıyor.
`BoardExercise.tsx:313` yorumu: *"puanlama P6'ya bırakıldı"*.

**Kilit yok:** `app/(child)/modules/[id]/page.tsx:181-182` —
`isStepAccessible` her zaman `true` döner, üstünde yorum:
*"Kilitler kaldırıldı — tüm adımlar (alt konular) her zaman erişilebilir."*
Backend'de `LessonStatus.locked` enum değeri tanımlı
(`apps/api/chess_api/models/progress.py:9`) ama hiçbir yerde atanmıyor.

**Kalıcılık yok:** Pratik oturumu tamamen React state'inde; sayfa yenilenince kaybolur.
Pratik sayfası backend'e hiçbir şey yazmıyor, sadece `GET /lessons/{id}` okuyor
(`pratik/[mode]/page.tsx:65`).

**Çocuk kimliği hazır:** Normal kayıt akışı token'ı child token'ıyla değiştiriyor
(`app/(auth)/parent-signup/page.tsx:49-51` → `auth.login(ath.access_token, 'child', …)`),
token `localStorage['chess_app_token']` içinde (`lib/auth-storage.ts:1`).
Backend'de `get_current_child` bağımlılığı mevcut
(`apps/api/chess_api/dependencies/auth.py:30-44`).
**Ama** `(child)` alanında auth guard yok (`app/(child)/layout.tsx`) — token'sız
kullanıcı pratik sayfasına doğrudan girebilir.

**Sıralama alanı mevcut:** `LessonStep.order_index` (`models/module.py:36`).

---

## 3. Kararlar

| Konu | Karar |
|---|---|
| Kilit kapsamı | Sadece pratik zinciri kilitlenir. Ders adımlarının genel erişimi serbest kalır (`isStepAccessible` değişmez). |
| Kalıcılık | Backend'de kalıcı (yeni tablo). |
| Zincir birimi | **Alt konu (lesson_step)** — ders değil. |
| Zincir sonu | Test'te 85+ → aynı dersteki sonraki alt konu açılır. Son alt konuysa sonraki dersin ilk alt konusu açılır. |
| Hangi modlar puanlanır | Üçü de (Süresiz, Süreli, Test) aynı kuralla. |
| Tekrar deneme | Sınırsız. Kilit **en yüksek** skora göre; bir kez 85+ alındıysa kalıcı açık. |
| "Boş" cevap | Yok — her soru bir kez cevaplanır, ya doğru ya yanlış. |
| Token'sız kullanıcı | Kilit sistemi devre dışı, her şey açık; puan gösterilir ama kaydedilmez. |

---

## 4. Veri modeli

Yeni tablo — mevcut hiçbir tabloya dokunulmuyor:

```python
# apps/api/chess_api/models/practice.py (YENİ)
class ChildPracticeResult(Base):
    __tablename__ = "child_practice_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    child_id: Mapped[int] = mapped_column(ForeignKey("child_profiles.id"), index=True)
    lesson_step_id: Mapped[int] = mapped_column(ForeignKey("lesson_steps.id"), index=True)
    mode: Mapped[str] = mapped_column(String(16))          # suresiz | sureli | test
    best_score: Mapped[int] = mapped_column(Integer, default=0)     # 0..100
    best_correct: Mapped[int] = mapped_column(Integer, default=0)
    best_total: Mapped[int] = mapped_column(Integer, default=0)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("child_id", "lesson_step_id", "mode"),)
```

**Migration:** Yalnızca `CREATE TABLE`. Hiçbir `DROP`/`TRUNCATE`/`DELETE` yok;
müfredat tablolarına (`modules`, `lessons`, `lesson_steps`,
`child_lesson_progress`, `child_lesson_step_results`) dokunulmuyor — KURAL #4 uyumlu.

`child_lesson_progress` neden kullanılmıyor: o tablo ders bazlı ve adım indeksi
tutuyor; bizim ihtiyacımız alt konu × mod bazlı en-iyi-skor. Ayrı tablo, mevcut
satırları ve mevcut kodu hiç etkilemez.

---

## 5. Saf mantık (test edilebilir, DB'siz)

### 5.1 Puanlama — `apps/web/lib/practice/scoring.ts` (YENİ)

```ts
export function scorePercent(correct: number, total: number): number  // 0..100, total<=0 → 0
export function thresholdMessage(score: number): string
```

- `scorePercent = round(correct / total * 100)`
- Süresiz modda toplam 20 olduğu için ham puan (doğru×5) ile yüzde çakışır;
  öğrenciye "Puanın: X/100" gösterilir. Süreli/Test'te havuzun tamamı kullanıldığından
  toplam değişebilir — eşik kontrolü **her zaman yüzde** üzerinden yapılır.
- Eşik metinleri: `<50` → "Çok Daha Fazla Pratik Yapmalısın",
  `50–80` (dahil) → "İyi Gidiyorsun…", `>80` → "Tebrikler…".
  85 eşiği bundan **bağımsız** ayrı bir kontroldür (mesaj eşiği ile karıştırılmaz).

### 5.2 Kilit zinciri — `apps/web/lib/practice/unlock.ts` (YENİ)

```ts
export const UNLOCK_THRESHOLD = 85;
export type Mode = 'suresiz' | 'sureli' | 'test';
export type ScoreMap = Record<number, Partial<Record<Mode, number>>>; // stepId → mod → en iyi skor

export function isModeUnlocked(stepId: number, mode: Mode, scores: ScoreMap): boolean
export function isSubtopicUnlocked(orderedStepIds: number[], stepId: number, scores: ScoreMap): boolean
```

Kurallar:
- `suresiz`: alt konu açıksa her zaman açık
- `sureli`: `scores[stepId].suresiz >= 85`
- `test`: `scores[stepId].sureli >= 85`
- Alt konu açık ⟺ listedeki **ilk** alt konu, **veya** bir önceki alt konunun
  `test` skoru `>= 85`

**Kilit mantığı neden frontend'de:** "Alt konu = başlıklı `explanation` adımı" kuralı
şu an sadece frontend'de tanımlı (`home/page.tsx:270`). Bu kuralı backend'de
tekrarlamak iki ayrı doğruluk kaynağı yaratır ve sapma riski taşır. Bu yüzden
**backend saf bir skor deposudur**, kilit kararını sıralı listeyi zaten bilen
frontend verir. Bu, bölüm 4'te ilk konuştuğumuz "backend `unlocked` döndürsün"
yaklaşımından bilinçli bir sapmadır.

**Kabul edilen sınır:** Kilitler pedagojik yönlendirmedir, güvenlik sınırı değildir.
URL'yi elle yazan biri kilitli moda girebilir. Bu zaten "token'sız kullanıcıda her şey
açık" kararıyla da tutarlı. Skorların kendisi yine sunucuda hesaplanır (bkz. 6.1).

---

## 6. Backend API — `apps/api/chess_api/routers/practice.py` (YENİ)

Her iki uç da `get_current_child` gerektirir (401 → frontend kilitsiz moda düşer).

### 6.1 `POST /practice/steps/{step_id}/submit`

Body: `{ "mode": "suresiz"|"sureli"|"test", "correct": int, "total": int }`

- Doğrulama: `mode` üç değerden biri; `0 <= correct <= total`; `total > 0`;
  `step_id` var olmalı — aksi halde 400/404.
- **Puanı sunucu hesaplar** (`round(correct/total*100)`), istemciden puan kabul edilmez.
- Upsert: kayıt yoksa oluşturur; varsa `attempts_count += 1`, `last_played_at` güncellenir
  ve **yalnızca yeni skor daha yüksekse** `best_*` alanları güncellenir.
- Yanıt: `{ "score": int, "best_score": int, "improved": bool }`

### 6.2 `GET /practice/lessons/{lesson_id}/scores`

- O dersin tüm adımları için bu çocuğa ait kayıtları döner:
  `{ "scores": [ { "step_id": int, "mode": str, "best_score": int } ] }`
- Frontend bunu `ScoreMap`'e çevirip kilitleri hesaplar.

---

## 7. Frontend

### 7.1 Sonuç ekranı — `apps/web/components/practice/PracticeResult.tsx` (YENİ)

Oturum bitince soru ekranının yerini alır:
- "X/Y doğru" ve "Puanın: N/100"
- Eşik mesajı (5.1)
- Bu oturumda bir kilit açıldıysa kutlama satırı: "🔓 Süreli Pratik açıldı!" /
  "🔓 Kendini Test Et açıldı!" / "🔓 Sonraki alt konu açıldı!"
- "Tekrar Dene" ve ana sayfaya dönüş bağlantısı

### 7.2 `pratik/[mode]/page.tsx` değişiklikleri

- Oturum bitişini yakalar (tüm sorular cevaplandı **veya** süreli modda süre doldu),
  doğru/toplam sayısını `POST /practice/steps/{step_id}/submit` ile gönderir,
  `PracticeResult` gösterir.
- Sayfa açılışında `GET /practice/lessons/{lesson_id}/scores` ile kilit durumunu alır;
  istenen mod kilitliyse soru yerine "Bu mod henüz kilitli — önce {önceki mod}'da 85+ al"
  uyarısı gösterir.
- Token yoksa: her iki çağrı da atlanır, kilit kontrolü yapılmaz, puan gösterilir
  ama kaydedilmez (mevcut davranış birebir korunur).

### 7.3 `home/page.tsx` değişiklikleri

- Bir ders açıldığında `GET /practice/lessons/{id}/scores` çekilir.
- Kilitli mod kartları: asma kilit ikonu, soluk görünüm, `Link` yerine tıklanamaz kutu.
- Kilitli alt konu: aynı şekilde soluk + kilit ikonu.
- Token yoksa: hepsi eskisi gibi açık.

### 7.4 `BoardExercise.tsx` değişikliği

Şu an yanlış cevaplar sayılmıyor; oturum sonunda doğru/toplam bilgisini yukarı
verecek bir `onFinish({ correct, total })` callback'i eklenir. Mevcut `onCorrect`
davranışı korunur (geriye uyumluluk).

---

## 8. Geriye uyumluluk ve riskler (KURAL #3)

- **Bilinçli davranış değişikliği:** Süreli Pratik, Kendini Test Et ve sonraki alt
  konular şu an serbest; bu değişiklikten sonra 85+ alınana kadar kilitli görünecek.
  Kullanıcı bunu açıkça kabul etti.
- Ders adımlarının genel erişimi (`isStepAccessible`) **değişmiyor**.
- Migration yalnızca yeni tablo ekliyor; mevcut veri hiç okunmuyor/yazılmıyor.
- Yeni endpoint'ler ek; `/lessons/{id}` gibi mevcut uçlara dokunulmuyor.
- Token'sız kullanıcı için davranış **birebir eskisi gibi** kalır.
- Skor kaydı başarısız olursa (ağ hatası/401) sonuç ekranı yine gösterilir; sadece
  kalıcı kayıt ve kilit açma atlanır. Oturum asla hata yüzünden kaybolmaz.

---

## 9. Test stratejisi

**Saf mantık (vitest):** `scoring.ts` — sınır değerleri 0, 49, 50, 80, 81, 84, 85, 100;
`total=0` koruması. `unlock.ts` — ilk alt konu her zaman açık; 84 açmaz, 85 açar;
zincirin ortasından atlama engellenir; boş `ScoreMap`.

**Backend (pytest):** upsert davranışı (düşük skor `best_score`'u düşürmez),
`attempts_count` artışı, sunucu tarafı skor hesabı (istemci puanı yok sayılır),
geçersiz `mode`/`correct>total` → 400, token'sız → 401, başka çocuğun kaydına
erişilemez.

**Bileşen (vitest + RTL):** `PracticeResult` üç eşik metnini ve kilit açma satırını
doğru gösterir. `pratik/[mode]` sayfası kilitli modda uyarı gösterir, token'sız
durumda kilit uygulamaz.

**Canlı doğrulama (KURAL #6):** Gerçek tarayıcıda bir alt konuda Süresiz Pratik
oynanır, düşük skorla Süreli'nin kilitli kaldığı, 85+ ile açıldığı ve sayfa
yenilendikten sonra kilidin açık kaldığı (kalıcılık) doğrulanır. Prod test verisi
sonunda silinir.

---

## 10. Kapsam dışı

- Mevcut `child_lesson_progress` / `child_lesson_step_results` tablolarının pratik
  akışına bağlanması
- Modül/ders seviyesinde genel kilit sisteminin geri getirilmesi
- Rozet/ödül sistemi entegrasyonu
- Öğretmen panelinde skor raporu
- Oturumun yarıda kalıp sonradan devam ettirilmesi (oturum hâlâ React state'inde)

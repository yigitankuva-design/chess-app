# A Grubu — Pratiği Bırakma, Sade Geribildirim, Kare Halkaları

> Kullanıcının altı maddelik isteğinin **A grubu**. Sıra kullanıcı tarafından onaylandı:
> A (sporcu ekranı) → B (panel kolaylığı) → C (yeni soru tipi "Taşa Tıkla").

## Kapsam

| # | İş |
|---|---|
| 1 | "Pratik Yapmayı Bırak" butonu — pratik yarıda bırakılabilsin, kaydedilmesin |
| 2 | Geribildirim kartında yazı kalksın, sadece ✓/✗ kalsın |
| 7 | Tıklanan karelerde halka görünsün (kare boyanmasın) |

## Kullanıcı Kararları (onaylandı)

| Konu | Karar |
|---|---|
| Bırak butonu nerede | **Üç pratikte de** (Süresiz, Süreli, Kendini Test Et) |
| Kare boyaması | **Tıklama/sonuç göstergeleri halkaya döner** |
| Bırakırken onay | **Sorulur** — "Emin misin? Bu pratik kaydedilmeyecek." |
| 7. maddedeki yeni kural | **Tüm sorulara** uygulanır (eski/yeni ayrımı yok) |

---

## İş 1 — Pratiği Bırakma

### Yer ve yazı

Buton, talimat kartının **hemen altında**, `pg-content` alanında durur. Yazı moda göre değişir:

| Mod | Buton yazısı |
|---|---|
| `suresiz` | Süresiz Pratik Yapmayı Bırak |
| `sureli` | Süreli Pratik Yapmayı Bırak |
| `test` | Testi Bırak |

Yazı `MODES` sabitine eklenecek yeni bir `quitLabel` alanından gelir
(`apps/web/app/(child)/pratik/[mode]/page.tsx:29-33`). Başlıktan türetme yapılmaz —
"Kendini Test Et" → "Testi Bırak" dönüşümü kural dışıdır, açıkça yazmak daha güvenli.

### Davranış

1. Basılınca onay sorulur (mevcut `confirm()` deseni — `MatchLayout`'un "Terk Et"i de
   aynısını kullanıyor).
2. Onaylanırsa:
   - `clearSession(sessionKey(stepId, slug))` — kayıtlı oturum silinir
   - **`submitPracticeResult` ÇAĞRILMAZ** — sunucuya hiçbir şey yazılmaz, pratik
     yapılmamış sayılır
   - `router.push('/home')` — hızlı erişim ana sayfasına dönülür

### Neden `handleFinish`'ten ayrı

`handleFinish` (page.tsx:164) puanı sunucuya yazar, kilit açar, sonuç ekranı gösterir.
Bırakma bunların **hiçbirini** yapmaz. Ayrı bir `handleQuit` fonksiyonu yazılır; mevcut
bitiş akışına dokunulmaz (KURAL #3 — canlı sporcuların biten pratikleri etkilenmez).

### Bileşen sınırı

`BoardExercise` pratik moduna dair hiçbir şey bilmiyor (hangi mod, hangi ders). Bu yüzden
buton **`BoardExercise` içinde üretilmez**; sayfa bir `quitSlot` (isteğe bağlı ReactNode)
geçirir, `BoardExercise` onu talimat kartının altına koyar. Böylece bileşen moddan
bağımsız kalır ve ders anlatımı içindeki alıştırmalarda (mod yokken) buton hiç çıkmaz.

---

## İş 2 — Geribildirim Kartında Sadece İşaret

`BoardExercise.tsx`'teki geribildirim kartında şu an iki şey var: büyük ✓/✗ işareti ve
altında metin (`success_msg ?? 'Aferin! Doğru yaptın! 👏'` veya `feedback`). Metin satırı
kaldırılır, işaret kalır ve biraz büyütülür.

**Etkilenmeyen:** "Sonraki Soruya Geç" kartı aynen kalır. Yanlış cevaptan sonra çıkan
geçici sarsılan uyarı şeridi (`status === 'fail' && !showNext`) da aynen kalır — o ayrı
bir öğe, tekrar deneme mümkün olduğunda çıkıyor.

**Dikkat:** Zafer Hoca'nın soruya yazdığı `success_msg`/`fail_msg` metinleri artık sporcuya
GÖSTERİLMEZ. Veri silinmiyor, sadece bu kartta görünmüyor.

---

## İş 7 — Kare Halkaları

### Mevcut durum (gerçek kodda doğrulandı)

İstenen **mantık zaten çalışıyor**:
- `lib/play/multiSquareCheck.ts` → `evaluateClick()` `'wrong' | 'partial' | 'complete'` döner
- `BoardExercise.tsx:384-391` → `click_mode === 'all'` iken yanlış kare `failNoRetry` çağırır
  (soru yanlış sayılır, tekrar deneme yok); tüm kareler tamamlanınca `succeed()` çağrılır

**Eksik olan tek şey:** `multiClicked` dizisi `styles` nesnesine hiç yansıtılmıyor —
sporcu hangi karelere tıkladığını göremiyor. Bu iş sadece o görsel eksiği kapatır ve
boyamayı halkaya çevirir.

### Halka nasıl çizilir

Yeni saf yardımcı: `apps/web/lib/chess/squareMarker.ts` → `ringStyle(color: string)`.
`radial-gradient` ile içi boş bir halka üretir; kare rengi değişmez, taş halkanın içinden
görünmeye devam eder.

### Hangi kareler değişir

| Yer | Şu an | Olacak |
|---|---|---|
| Çoklu tıklamada tıklanan kareler | **hiç gösterilmiyor** | **mavi halka** (yeni) |
| Tıklanan kare — doğru (`click_square`) | yeşil arka plan | yeşil halka |
| Tıklanan kare — yanlış (`click_square`) | kırmızı arka plan | kırmızı halka |
| Seçili taş (`move_piece` eski format) | mavi arka plan | mavi halka |
| `move_piece` doğru cevap kareleri | yeşil arka plan | yeşil halka |

### Değişmeyenler — bilinçli

İpucu kareleri (`hint_squares`, sarı) ve `identify_piece` vurgu karesi (sarı) **arka plan
olarak kalır**. Bunlar sporcunun tıklamasına verilen geri bildirim değil, sorunun kendisine
ait "buraya bak" işaretleri. Halkaya çevrilirse tıklama göstergeleriyle karışırlar.

---

## Test Planı

- **Saf mantık:** `ringStyle()` bilinen renk için beklenen `backgroundImage` üretir.
- **Bileşen — bırakma:** buton görünür; onay reddedilirse hiçbir şey olmaz; onaylanırsa
  `clearSession` çağrılır, `submitPracticeResult` ÇAĞRILMAZ, `/home`'a yönlendirilir.
- **Bileşen — geribildirim:** doğru cevapta ✓ görünür ama "Aferin" metni GÖRÜNMEZ;
  yanlışta ✗ görünür ama fail metni görünmez; "Sonraki Soruya Geç" kartı hâlâ vardır.
- **Bileşen — halkalar:** çoklu kare sorusunda ilk doğru tıklamadan sonra o karenin
  stilinde halka vardır ve `backgroundColor` YOKTUR; ikinci doğru tıklamada soru biter.
- **Regresyon:** mevcut `board-exercise-*` ve `click-mode-select` testleri geçmeli.
  **Güncellenecek testler (tarandı, tam liste):** `/Aferin/` metnini arayan 5 iddia —
  `tests/board-exercise-click-square.test.tsx` satır 21, 36, 49, 177 ve
  `tests/board-exercise-move-piece-placeholder.test.tsx` satır 60. Bu iddialar "doğru
  cevaplandı" kontrolü için metne bakıyor; metin kaldırıldığı için ✓ işaretine bakacak
  şekilde güncellenir. Testin **amacı** korunur, sadece neye baktığı değişir.
- Tam kapı: `npx tsc --noEmit && npx next lint && npx vitest run` + `python -m pytest -q`.
- Gerçek tarayıcı doğrulaması (KURAL #6): bırakma akışı, halkaların görünümü, çoklu kare
  sorusunda ilerleme.

## Kapsam Dışı

- B ve C grupları (panel kolaylığı, "Taşa Tıkla" tipi) — ayrı spec'ler.
- Puanlama, kilit ve zorluk mantığı değişmiyor.
- `success_msg`/`fail_msg` alanları veritabanından silinmiyor.

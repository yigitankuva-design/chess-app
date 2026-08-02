# B Grubu — Soru Havuzu Açılır Kartı ve Cevap Seçerken Konum Önizleme

> Kullanıcının altı maddelik isteğinin **B grubu**. Sıra: A (bitti, yayında) → **B** → C.
> Her ikisi de Zafer Hoca'nın panel kullanım şikayetlerinden doğdu.

## Kapsam

| # | İş |
|---|---|
| 5 | "Doğru Kare(leri) Seç" adımında kaydedilmiş konum sağda görünsün |
| 6 | Kaydedilmiş sorular açılır "Soru Havuzu" kartında toplansın |

## Kullanıcı Kararları (onaylandı)

| Konu | Karar |
|---|---|
| Havuz kartı hangi bölümlerde | **Üçünde de** — Süresiz, Süreli, Kendini Test Et |
| Kart başlangıç durumu | **Kapalı** — tıklayınca açılır |

---

## İş 6 — Soru Havuzu Açılır Kartı

### Mevcut durum

`apps/web/app/admin/content/lesson/[lessonId]/page.tsx` satır 337-359: kaydedilmiş
sorular 12 sütunlu bir ızgarada dairesel kod kartları olarak listeleniyor. Soru sayısı
arttıkça bu ızgara çok satır kaplıyor ve soru ekleme formunu aşağı itiyor — şikayet
edilen kalabalık bu.

Bölüm bilgisi `EX_MODES` sabitinde (satır 16-18): her modun `label` (örn. "Süresiz
Pratik Yap"), `emoji` ve `color` alanı var.

### Olacak

Dairesel kartlar açılır bir kartın içine alınır:

- Başlık: `{mode.label} Soru Havuzu` → "Süresiz Pratik Yap Soru Havuzu"
- Başlıkta soru sayısı: "(27 soru)"
- **Kapalı başlar.** Tıklayınca açılır, tekrar tıklayınca kapanır.
- Hiç soru yoksa kart açılmaz; bugünkü "Bu modda henüz soru yok." yazısı kalır.

**Bir soru düzenlenirken kart AÇIK kalır.** Zafer Hoca bir daireye tıkladığında altta
düzenleme formu açılıyor; havuz kapanırsa hangi soruda olduğunu göremez. Bu yüzden
düzenleme başlarken kart kendiliğinden açılır ve açık kalır.

### Yeni bileşen

`apps/web/components/admin/CollapsibleCard.tsx` — admin temasına uygun basit açılır kart.

**Neden `components/play/StepCard.tsx` yeniden kullanılmıyor:** O bileşen sporcu
temasının sınıflarını (`t-card-i`) ve adım numarası/kilit mantığını taşıyor; admin
paneli farklı bir görsel dil (neon) kullanıyor. Sporcu bileşenine admin desteği eklemek
iki ekranı birbirine bağlardı.

---

## İş 5 — Cevap Seçerken Konum Önizleme

### Mevcut durum

`apps/web/components/admin/ExerciseForm.tsx`:
- `SquarePicker` (satır 78-98): 8×8 kare **isimleri** ızgarası, `maxWidth: 280`.
  Tıklanan kare seçili/seçilmemiş olarak renklenir; altında "Seçili: e4, d5" satırı var.
- Kullanıldığı yer (satır 361): "Kareye Tıkla" tipinin 5. adımı, konum kaydedildikten
  sonra görünen blok.

Zafer Hoca burada kaydettiği konumu göremiyor — hangi karede hangi taş var bilmeden
cevap kurmak zorunda.

### Olacak

`SquarePicker`'ın **sağına** kaydedilmiş konumu gösteren salt-okunur bir tahta konur.
İkisi yan yana durur; dar ekranda alt alta iner.

- Tahta `savedFen`'i gösterir — yani "Konumu Kaydet" ile kilitlenen konum.
- **Tahta tıklanabilir DEĞİL.** Kare seçimi ızgaradan yapılmaya devam eder; iki ayrı
  tıklama yolu olması hangi tıklamanın ne yaptığını belirsizleştirir.
- Seçili kareler tahtada da **halka** ile işaretlenir — A grubunda eklenen
  `ringStyle()` (`lib/chess/squareMarker.ts`) yeniden kullanılır, yeni bir görsel dil
  icat edilmez.

---

## Kapsam Dışı

- C grubu ("Taşa Tıkla" soru tipi) — ayrı spec.
- Soru silme/sıralama düğmeleri bugünkü yerinde kalır.
- Soru içeriği, kodlama ve kaydetme mantığı değişmez (KURAL #4 — müfredat içeriği
  kullanıcı verisidir; bu iş yalnızca GÖRÜNÜM değiştirir, veri yazmaz).

## Test Planı

- **CollapsibleCard:** kapalı başlar; başlığa tıklayınca içerik görünür; tekrar
  tıklayınca gizlenir; `open` dışarıdan zorlanabilir.
- **Havuz kartı:** başlıkta mod adı ve soru sayısı görünür; kapalıyken daire kartlar
  DOM'da yok; açılınca hepsi var; bir soru düzenlenirken kart açık.
- **Konum önizleme:** konum kaydedilmeden tahta yok; kaydedildikten sonra `savedFen`'i
  gösteren tahta var; seçilen kare tahtada halka alıyor; tahtaya tıklamak seçimi
  DEĞİŞTİRMİYOR.
- Regresyon: mevcut `exercise-form-*`, `click-mode-select`, `admin-lesson-*` testleri
  geçmeli.
- Tam kapı: `npx tsc --noEmit && npx next lint && npx vitest run` + `python -m pytest -q`.
- Gerçek tarayıcı doğrulaması (KURAL #6): panelde havuzu açıp kapama, bir soruya
  tıklayıp düzenlemeye girme, cevap seçerken tahtanın göründüğünü görme.

# Alt Konu Bazlı Soru Sayısı — Tasarım

## Kapsam

Süresiz Pratik Yap / Süreli Pratik Yap / Kendini Test Et modlarında şu an TÜM alt
konular için sabit 20 soru rastgele seçiliyor (`randomPick: 20`,
`apps/web/app/(child)/pratik/[mode]/page.tsx`). Bu tasarım, Zafer hoca'nın her alt
konu + her mod için AYRI bir soru sayısı belirleyebilmesini sağlar.

## Veri Modeli

`LessonStep.content_json` (zaten `board_exercises`/`_timed`/`_test` dizilerini
tutuyor) yeni bir `question_counts` anahtarı alır:

```json
{ "question_counts": { "board_exercises": 15, "board_exercises_timed": 8 } }
```

Alan adları mevcut dizi alan adlarıyla AYNI (`board_exercises`, `board_exercises_timed`,
`board_exercises_test`) — eşleşme kolaylaşır. Değer yoksa/tanımsızsa mod eskisi gibi
20 soru sorar (geriye dönük uyumluluk, KURAL #3).

## Backend

`_validate_step_content`'in `explanation` dalına, mevcut `board_exercises` doğrulama
döngüsünden SONRA yeni bir kontrol eklenir: `question_counts` içindeki her değer
pozitif tam sayı olmalı VE aynı kayıtta gönderilen ilgili dizinin (`board_exercises`
vb.) uzunluğunu AŞAMAZ — aşarsa 400 hatası döner ("Soru sayısı havuzdaki soru
sayısından fazla olamaz"). Bu, kaydetme anında Zafer hoca'nın havuzdan fazla sayı
girmesini engeller (kullanıcı kararı).

## Admin Arayüzü

`apps/web/app/admin/content/lesson/[lessonId]/page.tsx`'te, açık mod sekmesinin
(Süresiz/Süreli/Test) başlığı ile soru havuzu listesi arasına "Soru Sayısını Belirle"
kutusu eklenir: bir sayı input'u + Kaydet butonu. Girilen değer o modun havuz
uzunluğunu aşarsa Kaydet başarısız olur, kırmızı bir uyarı metni gösterilir
(backend'in 400 hatası aynen ekrana yansıtılır). Kaydedilmiş bir sayı, sonradan
havuzun altına inerse (hoca soru sildiyse), kutunun yanında sarı bir not belirir:
"Belirlediğin sayı (N) havuzdaki soru sayısından (M) fazla — sporcuya M soru
sorulacak" — bu SADECE bilgilendirme, kaydetmeyi engellemez.

## Sporcu Tarafı

`apps/web/lib/play/questionPicker.ts`'e yeni bir `scaleMix(mix, targetCount)`
fonksiyonu eklenir: `UNTIMED_MIX`/`TIMED_MIX`/`TEST_MIX` oranlarını (10:7:3 gibi)
koruyarak toplamı `targetCount`'a ölçekler (en büyük kalan yöntemiyle yuvarlama).
`pratik/[mode]/page.tsx`'teki `MODES` config'i artık `randomPick` sabiti TAŞIMAZ;
her render'da o alt konunun `content_json.question_counts[field] ?? 20` değeri
okunur, `Math.min(count, pool.length)` ile havuzla sınırlanır, `scaleMix` ile
ölçeklenen mix `pickWeighted`'e verilir. `isSessionStale` çağrısına da aynı
çözümlenmiş sayı geçirilir (madde 4/9 — sayfa yenilemede tutarlılık).

## Puanlama

`scorePercent` zaten sayıdan bağımsız (`correct/total*100`) — değişiklik gerekmez.

## Test Planı

- `questionPicker.ts`: `scaleMix` birim testleri (oranın korunması, toplamın hedefe
  eşit olması, küçük/büyük hedeflerde sıfıra düşen kovaların olmaması).
- Backend: `question_counts` içinde havuzdan büyük değer reddedilir; geçerli değer
  kabul edilir; alan yoksa eski davranış (sınırsız/20) korunur.
- Admin sayfası: Kaydet ile sayı kaydedilir; havuzdan büyük girilirse hata gösterilir
  ve kaydedilmez; havuz sayıdan küçük düşünce uyarı metni görünür.
- Sporcu `pratik/[mode]/page.tsx`: `question_counts` set edilmiş alt konuda o kadar
  soru gösterilir; set edilmemiş alt konuda eskisi gibi 20 soru gösterilir
  (regresyon testi).

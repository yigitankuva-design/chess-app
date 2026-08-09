# Bota Karşı Oynama — 10 Seviyeli Zorluk Sistemi — Tasarım

Tarih: 2026-08-09

## Amaç

Şu an bota karşı oynarken en kolay seviye bile (Stockfish skill 0) yaklaşık 1320 Elo
gücünde — anaokulu/başlangıç seviyesindeki bir çocuk için çok zor. Zafer hoca'nın
belirlediği 10 seviyeli yeni bir sistem kurulacak:

| Seviye | Elo aralığı | Yöntem |
|---|---|---|
| 1 | 400-600 | Bot + kasıtlı hata |
| 2 | 600-800 | Bot + kasıtlı hata |
| 3 | 800-1000 | Bot + kasıtlı hata |
| 4 | 1000-1200 | Bot + kasıtlı hata |
| 5 | 1200-1400 | Bot + kasıtlı hata (çok az) |
| 6 | 1400-1600 | Motorun kendi ayarı |
| 7 | 1600-1800 | Motorun kendi ayarı |
| 8 | 1800-2000 | Motorun kendi ayarı |
| 9 | 2000-2200 | Motorun kendi ayarı |
| 10 | 2200+ | Motorun kendi ayarı (en güçlü) |

**Önemli sınırlama (dürüstlük notu):** Stockfish'in "skill 0 ≈ 1320 Elo" dışındaki
skill seviyelerinin tam olarak kaç Elo'ya denk geldiği motorun resmi belgelerinde
YAZMIYOR. Bu yüzden 6-10. seviyelerin Elo aralıkları KESİN GARANTİ değil, mevcut
8 seviyelik tablonun (skill 0→20 arası kademeli artış) uzantısına dayanan makul bir
tahmindir. 1-5. seviyeler ise bizim kendi kurduğumuz "kasıtlı hata" mekanizmasıyla
kontrol edildiği için daha güvenilir şekilde ayarlanabilir.

## 1-5. Seviyeler — "Kasıtlı Hata" Mekanizması

Bot her hamlesinde motordan TEK bir "en iyi hamle" yerine birkaç aday hamle ister
(motorun kendi ürettiği alternatifler — MultiPV tekniği). Her seviyeye ait bir
**hata ihtimali** vardır; bu ihtimalle bot en iyi adayı DEĞİL, adaylar arasından
daha zayıf birini rastgele oynar. İhtimal dışında kalan durumlarda her zaman en iyi
hamle oynanır.

Hata ihtimali seviyeler arasında EŞİT ADIMLARLA azalır:

| Seviye | Elo | Hata ihtimali |
|---|---|---|
| 1 | 400-600 | %60 |
| 2 | 600-800 | %45 |
| 3 | 800-1000 | %30 |
| 4 | 1000-1200 | %15 |
| 5 | 1200-1400 | %5 |

Aday hamle sayısı sabit 4 olacak (en iyi + 3 alternatif). Hata durumunda bu 4
adaydan (1. hariç, yani 2-3-4. sıradakilerden) rastgele biri seçilir.

**Teknik risk notu:** Kullandığımız Stockfish motorunun (tarayıcıda çalışan WASM
sürümü) MultiPV özelliğini desteklediği doğrulanmamıştır — standart Stockfish'te
vardır ama bizim motor dosyamızda test edilmemiş. Uygulama planının İLK adımı bunu
küçük bir denemeyle doğrulamak olacak; desteklemiyorsa yedek yöntem "adayları
aramadan, düşük derinlikte + rastgele hamle karışımı" olacak (kullanıcıya bu durumda
haber verilecek).

## 6-10. Seviyeler — Motorun Kendi Ayarı

Mevcut sistemin üst ucundaki mantık (skill ve derinliğin kademeli artışı) 5 basamağa
yayılarak devam eder — skill 20 ve en yüksek derinlik en üstte (Seviye 10) kalır.

## Düzey Seçme Ekranı (MatchCriteria.tsx)

Mevcut tasarım (10 yuvarlak düğme, sadece rakam) AYNEN korunur, sadece buton sayısı
8'den 10'a çıkar. Elo aralığı yazısı EKLENMEZ (kullanıcı kararı).

## Devam Eden Maçlar

`botGameSession.ts`'teki oturum anahtarı zaten motorun ham `skillLevel` (sayısal
Stockfish değeri) üzerinden kuruluyor, seviye numarası (1-10) üzerinden DEĞİL. Bu
yüzden devam eden bir maç varken sistem değişse bile mevcut oturumlar bozulmaz —
ayrıca bir önlem gerekmiyor.

## Etkilenmeyen Yerler

`MovePieceSolver.tsx` (alıştırma çözümünde motoru kullanan ayrı bir yer) bu
değişiklikten ETKİLENMEZ — sadece bota karşı maç akışı (`BotGame.tsx` ve
`levels.ts`) değişir.

## Test Kapsamı (özet)

- Yeni saf mantık dosyası (örn. `blunder.ts`): hata ihtimaline göre aday hamle
  seçme fonksiyonu — deterministik test için `Math.random` mock'lanacak.
- `levels.ts`: 10 seviyelik yeni `LEVELS` dizisi + her seviyenin blunder ihtimali.
- `BotGame.tsx`: MultiPV destekleniyorsa aday hamle isteme + hata ihtimaliyle seçme;
  desteklenmiyorsa yedek yöntem.
- `MatchCriteria.tsx`: 10 buton render testi.
- Tam test kapısı + kullanıcı onayıyla canlı doğrulama.
